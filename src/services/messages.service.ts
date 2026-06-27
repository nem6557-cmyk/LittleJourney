import { supabase } from '../lib/supabase';
import { withRetry, isOnline, cacheData, getCachedData, queueMutation } from '../lib/offline';
import type { Database } from '../types/database';

type MessageInsert = Database['public']['Tables']['messages']['Insert'];

export const messagesService = {
  getConversations: async (userId: string) => {
    const cacheKey = `conversations_${userId}`;

    const online = await isOnline();
    if (!online) {
      const cached = await getCachedData<any[]>(cacheKey);
      if (cached) return cached;
      throw new Error('No network connection and no cached data available');
    }

    return withRetry(async () => {
      const { data, error } = await supabase
        .from('conversation_members')
        .select(`
          conversation_id,
          last_read_at,
          is_muted,
          conversations(
            id, type, title, updated_at,
            conversation_members(user_id, profiles(id, first_name, last_name, avatar_url, role))
          )
        `)
        .eq('user_id', userId)
        .order('conversations(updated_at)', { ascending: false });
      if (error) throw error;
      await cacheData(cacheKey, data);
      return data;
    });
  },

  getMessages: async (conversationId: string, options?: { limit?: number; before?: string }) => {
    const cacheKey = `messages_${conversationId}_${JSON.stringify(options ?? {})}`;

    const online = await isOnline();
    if (!online) {
      const cached = await getCachedData<any[]>(cacheKey);
      if (cached) return cached;
      throw new Error('No network connection and no cached data available');
    }

    return withRetry(async () => {
      let query = supabase
        .from('messages')
        .select(`
          *,
          sender:profiles!sender_id(id, first_name, last_name, avatar_url, role)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false });

      if (options?.limit) query = query.limit(options.limit);
      if (options?.before) query = query.lt('created_at', options.before);

      const { data, error } = await query;
      if (error) throw error;
      const result = data?.reverse() || [];
      await cacheData(cacheKey, result);
      return result;
    });
  },

  sendMessage: async (message: MessageInsert) => {
    const online = await isOnline();
    if (!online) {
      await queueMutation({ table: 'messages', operation: 'insert', data: message as Record<string, unknown> });
      return { ...message, id: `offline_${Date.now()}`, created_at: new Date().toISOString() };
    }
    return withRetry(async () => {
      const { data, error } = await supabase
        .from('messages')
        .insert(message)
        .select('*, sender:profiles!sender_id(id, first_name, last_name, avatar_url, role)')
        .single();
      if (error) throw error;
      return data;
    });
  },

  markRead: async (conversationId: string, userId: string) => {
    return withRetry(async () => {
      const { error } = await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);
      if (error) throw error;
    });
  },

  createConversation: async (daycareId: string, type: 'direct' | 'group' | 'announcement', title: string | null, memberIds: string[]) => {
    return withRetry(async () => {
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({ daycare_id: daycareId, type, title })
        .select()
        .single();
      if (convError || !conv) throw convError;

      const members = memberIds.map((userId) => ({
        conversation_id: conv.id,
        user_id: userId,
      }));
      const { error: memError } = await supabase.from('conversation_members').insert(members);
      if (memError) throw memError;

      return conv;
    });
  },

  // Atomic, RLS-safe conversation creation via the SECURITY DEFINER RPC.
  // Caller is added automatically; participants are validated to be same-daycare.
  createConversationRpc: async (
    participantIds: string[],
    type: 'direct' | 'group' | 'announcement' = 'direct',
    title: string | null = null,
  ): Promise<string> => {
    const { data, error } = await supabase.rpc('create_conversation', {
      p_participant_ids: participantIds,
      p_type: type,
      p_title: title,
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    if (!data?.conversation_id) throw new Error('No conversation id returned');
    return data.conversation_id as string;
  },

  // List potential message recipients in the same daycare (excludes self).
  listDaycareContacts: async (daycareId: string, excludeUserId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, role, avatar_url')
      .eq('daycare_id', daycareId)
      .neq('id', excludeUserId)
      .order('first_name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  subscribeToConversation: (conversationId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`messages:${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, callback)
      .subscribe();
  },
};

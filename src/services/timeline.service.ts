import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type TimelineInsert = Database['public']['Tables']['timeline_entries']['Insert'];
type TimelineUpdate = Database['public']['Tables']['timeline_entries']['Update'];

export const timelineService = {
  getEntries: async (childId: string, options?: { limit?: number; offset?: number; type?: string }) => {
    let query = supabase
      .from('timeline_entries')
      .select(`
        *,
        author:profiles!author_id(id, first_name, last_name, avatar_url, role),
        comments(*, author:profiles!author_id(id, first_name, last_name, avatar_url, role)),
        reactions(*)
      `)
      .eq('child_id', childId)
      .order('created_at', { ascending: false });

    if (options?.type) {
      query = query.eq('activity_type', options.type);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }
    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  // Get entries for all children in a daycare (caregiver view)
  getDaycareEntries: async (daycareId: string, options?: { limit?: number; date?: string }) => {
    let query = supabase
      .from('timeline_entries')
      .select(`
        *,
        author:profiles!author_id(id, first_name, last_name, avatar_url, role),
        child:children!child_id(id, first_name, last_name, avatar_url),
        comments(*, author:profiles!author_id(id, first_name, last_name, avatar_url, role)),
        reactions(*)
      `)
      .eq('daycare_id', daycareId)
      .order('created_at', { ascending: false });

    if (options?.date) {
      query = query.gte('created_at', `${options.date}T00:00:00`).lte('created_at', `${options.date}T23:59:59`);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  addEntry: async (entry: TimelineInsert) => {
    const { data, error } = await supabase
      .from('timeline_entries')
      .insert(entry)
      .select(`
        *,
        author:profiles!author_id(id, first_name, last_name, avatar_url, role)
      `)
      .single();
    if (error) throw error;
    return data;
  },

  updateEntry: async (entryId: string, updates: TimelineUpdate) => {
    const { data, error } = await supabase
      .from('timeline_entries')
      .update(updates)
      .eq('id', entryId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteEntry: async (entryId: string) => {
    const { error } = await supabase
      .from('timeline_entries')
      .delete()
      .eq('id', entryId);
    if (error) throw error;
  },

  // Comments
  addComment: async (entryId: string, authorId: string, text: string) => {
    const { data, error } = await supabase
      .from('comments')
      .insert({ timeline_entry_id: entryId, author_id: authorId, text })
      .select('*, author:profiles!author_id(id, first_name, last_name, avatar_url, role)')
      .single();
    if (error) throw error;
    return data;
  },

  deleteComment: async (commentId: string) => {
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);
    if (error) throw error;
  },

  // Reactions
  toggleReaction: async (entryId: string, userId: string, emoji: string) => {
    // Check if reaction exists
    const { data: existing } = await supabase
      .from('reactions')
      .select('id')
      .eq('timeline_entry_id', entryId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .single();

    if (existing) {
      // Remove reaction
      await supabase.from('reactions').delete().eq('id', existing.id);
      return null;
    } else {
      // Add reaction
      const { data, error } = await supabase
        .from('reactions')
        .insert({ timeline_entry_id: entryId, user_id: userId, emoji })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  },

  // Real-time subscription
  subscribeToChild: (childId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`timeline:${childId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'timeline_entries',
        filter: `child_id=eq.${childId}`,
      }, callback)
      .subscribe();
  },

  subscribeToDaycare: (daycareId: string, callback: (payload: any) => void) => {
    return supabase
      .channel(`timeline:daycare:${daycareId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'timeline_entries',
        filter: `daycare_id=eq.${daycareId}`,
      }, callback)
      .subscribe();
  },
};

import { useState, useEffect, useCallback, useMemo } from 'react';
import { messagesService } from '../services/messages.service';

/**
 * Hook for managing messages and conversations.
 * In demo mode, uses local state.
 * In production, fetches from Supabase with real-time subscriptions.
 */
export function useMessages(userId?: string, daycareId?: string, isDemoMode = false) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (isDemoMode || !daycareId) return;
    setIsLoading(true);
    try {
      const data = await messagesService.getConversations(daycareId);
      setConversations(data);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }, [daycareId, isDemoMode]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    if (isDemoMode) return;
    try {
      const data = await messagesService.getMessages(conversationId);
      setMessages(data);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [isDemoMode]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (activeConversationId && !isDemoMode) {
      fetchMessages(activeConversationId);
    }
  }, [activeConversationId, fetchMessages, isDemoMode]);

  // Real-time message subscription
  useEffect(() => {
    if (isDemoMode || !activeConversationId) return;

    const subscription = messagesService.subscribeToConversation(activeConversationId, (payload) => {
      if (payload.eventType === 'INSERT') {
        setMessages((prev) => [...prev, payload.new]);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [activeConversationId, isDemoMode]);

  const unreadCount = useMemo(() => {
    if (isDemoMode) {
      return messages.filter((m) => !m.read && m.senderId !== userId).length;
    }
    return conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  }, [messages, conversations, userId, isDemoMode]);

  const sendMessage = useCallback(async (text: string, isUrgent = false, conversationId?: string) => {
    const convId = conversationId || activeConversationId;
    if (!convId || !userId) return;

    if (isDemoMode) {
      const newMsg = {
        id: `m${Date.now()}`,
        conversationId: convId,
        senderId: userId,
        text,
        timestamp: new Date().toISOString(),
        read: false,
        isUrgent,
      };
      setMessages((prev) => [...prev, newMsg]);
      return;
    }

    await messagesService.sendMessage({
      conversation_id: convId,
      sender_id: userId,
      text,
      attachments: [],
    });
  }, [activeConversationId, userId, isDemoMode]);

  const markMessagesRead = useCallback(async (conversationId?: string) => {
    const convId = conversationId || activeConversationId;
    if (!convId || !userId) return;

    if (isDemoMode) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.senderId === userId || m.read) return m;
          if (m.conversationId !== convId) return m;
          return { ...m, read: true };
        })
      );
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unreadCount: 0 } : c))
      );
      return;
    }

    await messagesService.markRead(convId, userId);
  }, [activeConversationId, userId, isDemoMode]);

  return {
    conversations,
    messages,
    activeConversationId,
    setActiveConversation: setActiveConversationId,
    sendMessage,
    markMessagesRead,
    unreadCount,
    isLoading,
    refetch: fetchConversations,
    setConversations, // For demo mode
    setMessages, // For demo mode
  };
}

import { useState, useEffect, useCallback } from 'react';
import { timelineService } from '../services/timeline.service';

/**
 * Hook for managing timeline entries.
 * In demo mode, uses local state.
 * In production, fetches from Supabase with real-time subscriptions.
 */
export function useTimeline(childId?: string, daycareId?: string, isDemoMode = false) {
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEntries = useCallback(async () => {
    if (isDemoMode || !childId) return;
    setIsLoading(true);
    try {
      const data = await timelineService.getEntries(childId);
      setEntries(data);
    } catch (err) {
      console.error('Failed to fetch timeline:', err);
    } finally {
      setIsLoading(false);
    }
  }, [childId, isDemoMode]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Real-time subscription
  useEffect(() => {
    if (isDemoMode || !childId) return;

    const subscription = timelineService.subscribeToChild(childId, (payload) => {
      if (payload.eventType === 'INSERT') {
        setEntries((prev) => [...prev, payload.new]);
      } else if (payload.eventType === 'UPDATE') {
        setEntries((prev) => prev.map((e) => (e.id === payload.new.id ? payload.new : e)));
      } else if (payload.eventType === 'DELETE') {
        setEntries((prev) => prev.filter((e) => e.id !== payload.old.id));
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [childId, isDemoMode]);

  const addEntry = useCallback(async (entry: any) => {
    if (isDemoMode) {
      const newEntry = { ...entry, id: `t${Date.now()}`, created_at: new Date().toISOString() };
      setEntries((prev) => [...prev, newEntry]);
      return newEntry;
    }
    try {
      const result = await timelineService.addEntry(entry);
      return result;
    } catch (err) {
      console.error('Failed to add entry:', err);
      throw err;
    }
  }, [isDemoMode]);

  const deleteEntry = useCallback(async (entryId: string) => {
    if (isDemoMode) {
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      return;
    }
    await timelineService.deleteEntry(entryId);
  }, [isDemoMode]);

  const addComment = useCallback(async (entryId: string, text: string, authorId: string) => {
    if (isDemoMode) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, comments: [...(e.comments || []), { id: `cm${Date.now()}`, text, author_id: authorId, created_at: new Date().toISOString() }] }
            : e
        )
      );
      return;
    }
    await timelineService.addComment(entryId, authorId, text);
  }, [isDemoMode]);

  const deleteComment = useCallback(async (entryId: string, commentId: string) => {
    if (isDemoMode) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, comments: (e.comments || []).filter((c: any) => c.id !== commentId) }
            : e
        )
      );
      return;
    }
    await timelineService.deleteComment(commentId);
  }, [isDemoMode]);

  const toggleReaction = useCallback(async (entryId: string, emoji: string, userId: string) => {
    if (isDemoMode) {
      setEntries((prev) =>
        prev.map((e) => {
          if (e.id !== entryId) return e;
          const existing = (e.reactions || []).find((r: any) => r.user_id === userId && r.emoji === emoji);
          if (existing) {
            return { ...e, reactions: (e.reactions || []).filter((r: any) => r !== existing) };
          }
          return { ...e, reactions: [...(e.reactions || []), { user_id: userId, emoji, created_at: new Date().toISOString() }] };
        })
      );
      return;
    }
    await timelineService.toggleReaction(entryId, userId, emoji);
  }, [isDemoMode]);

  return {
    entries,
    isLoading,
    addEntry,
    deleteEntry,
    addComment,
    deleteComment,
    toggleReaction,
    refetch: fetchEntries,
    setEntries, // For demo mode injection
  };
}

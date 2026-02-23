import { useState, useEffect, useCallback, useMemo } from 'react';
import { notificationsService } from '../services/notifications.service';

/**
 * Hook for managing notifications.
 * In demo mode, uses local state.
 * In production, fetches from Supabase with real-time subscriptions.
 */
export function useNotifications(userId?: string, daycareId?: string, isDemoMode = false) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (isDemoMode || !userId) return;
    setIsLoading(true);
    try {
      const data = await notificationsService.getNotifications(userId);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isDemoMode]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Real-time subscription
  useEffect(() => {
    if (isDemoMode || !userId) return;

    const subscription = notificationsService.subscribeToNotifications(userId, (payload) => {
      if (payload.eventType === 'INSERT') {
        setNotifications((prev) => [payload.new, ...prev]);
      } else if (payload.eventType === 'UPDATE') {
        setNotifications((prev) => prev.map((n) => (n.id === payload.new.id ? payload.new : n)));
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [userId, isDemoMode]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read && !n.read_at).length;
  }, [notifications]);

  const markRead = useCallback(async (id: string) => {
    if (isDemoMode) {
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true, read_at: new Date().toISOString() } : n)));
      return;
    }
    await notificationsService.markRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }, [isDemoMode]);

  const markAllRead = useCallback(async () => {
    if (isDemoMode) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() })));
      return;
    }
    if (!userId) return;
    await notificationsService.markAllRead(userId);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
  }, [userId, isDemoMode]);

  const addNotification = useCallback((notif: any) => {
    const newNotif = {
      ...notif,
      id: notif.id || `n${Date.now()}`,
      timestamp: notif.timestamp || new Date().toISOString(),
      created_at: notif.created_at || new Date().toISOString(),
    };
    setNotifications((prev) => [newNotif, ...prev]);
  }, []);

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    addNotification,
    isLoading,
    refetch: fetchNotifications,
    setNotifications, // For demo mode
  };
}

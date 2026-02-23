import { useState, useEffect, useCallback } from 'react';
import { childrenService } from '../services/children.service';
import { DbChild } from '../types/database';

/**
 * Hook for managing children data.
 * In demo mode, uses the provided sample data.
 * In production, fetches from Supabase.
 */
export function useChildren(daycareId?: string, isDemoMode = false) {
  const [children, setChildren] = useState<DbChild[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  const fetchChildren = useCallback(async () => {
    if (!daycareId || isDemoMode) return;
    setIsLoading(true);
    try {
      const data = await childrenService.getChildren();
      setChildren(data);
      if (data.length > 0 && !selectedChildId) {
        setSelectedChildId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch children:', err);
    } finally {
      setIsLoading(false);
    }
  }, [daycareId, isDemoMode, selectedChildId]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const selectedChild = children.find((c) => c.id === selectedChildId) || children[0] || null;

  const selectChild = useCallback((id: string) => {
    setSelectedChildId(id);
  }, []);

  const addChild = useCallback(async (child: Parameters<typeof childrenService.createChild>[0]) => {
    if (isDemoMode) return;
    try {
      const newChild = await childrenService.createChild(child);
      if (newChild) {
        setChildren((prev) => [...prev, newChild]);
      }
    } catch (err) {
      console.error('Failed to add child:', err);
      throw err;
    }
  }, [isDemoMode]);

  return {
    children,
    selectedChild,
    selectedChildId,
    selectChild,
    addChild,
    isLoading,
    refetch: fetchChildren,
    setChildren, // Allow demo mode to inject sample data
  };
}

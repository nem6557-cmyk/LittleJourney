import { useState, useEffect, useCallback } from 'react';
import { milestonesService } from '../services/milestones.service';

/**
 * Hook for managing child milestones.
 */
export function useMilestones(childId?: string, isDemoMode = false) {
  const [milestones, setMilestones] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMilestones = useCallback(async () => {
    if (isDemoMode || !childId) return;
    setIsLoading(true);
    try {
      const data = await milestonesService.getMilestones(childId);
      setMilestones(data);
    } catch (err) {
      console.error('Failed to fetch milestones:', err);
    } finally {
      setIsLoading(false);
    }
  }, [childId, isDemoMode]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  const addMilestone = useCallback(async (milestone: any) => {
    if (isDemoMode) {
      const newMilestone = { ...milestone, id: `ms${Date.now()}`, created_at: new Date().toISOString() };
      setMilestones((prev) => [...prev, newMilestone]);
      return newMilestone;
    }
    const result = await milestonesService.addMilestone(milestone);
    if (result) setMilestones((prev) => [...prev, result]);
    return result;
  }, [isDemoMode]);

  const markAchieved = useCallback(async (milestoneId: string) => {
    if (isDemoMode) {
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? { ...m, achieved_at: new Date().toISOString() } : m))
      );
      return;
    }
    await milestonesService.markAchieved(milestoneId, '');
    fetchMilestones();
  }, [isDemoMode, fetchMilestones]);

  return {
    milestones,
    isLoading,
    addMilestone,
    markAchieved,
    refetch: fetchMilestones,
    setMilestones,
  };
}

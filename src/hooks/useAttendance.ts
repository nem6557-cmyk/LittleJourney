import { useState, useEffect, useCallback } from 'react';
import { attendanceService } from '../services/attendance.service';

/**
 * Hook for managing attendance records.
 */
export function useAttendance(daycareId?: string, isDemoMode = false) {
  const [attendance, setAttendance] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAttendance = useCallback(async (date?: string) => {
    if (isDemoMode || !daycareId) return;
    setIsLoading(true);
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const data = await attendanceService.getAttendance(daycareId, targetDate);
      setAttendance(data);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [daycareId, isDemoMode]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const checkIn = useCallback(async (childId: string, userId: string) => {
    if (isDemoMode) {
      setAttendance((prev) =>
        prev.map((a) =>
          a.childId === childId
            ? { ...a, checkInTime: new Date().toISOString(), status: 'present' }
            : a
        )
      );
      return;
    }
    if (!daycareId) return;
    await attendanceService.checkIn({
      child_id: childId,
      daycare_id: daycareId,
      date: new Date().toISOString().split('T')[0],
      check_in_at: new Date().toISOString(),
      check_in_by: userId,
      status: 'present',
    });
    fetchAttendance();
  }, [daycareId, isDemoMode, fetchAttendance]);

  const checkOut = useCallback(async (childId: string, userId: string) => {
    if (isDemoMode) {
      setAttendance((prev) =>
        prev.map((a) =>
          a.childId === childId
            ? { ...a, checkOutTime: new Date().toISOString(), status: 'present' }
            : a
        )
      );
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    await attendanceService.checkOut(childId, today, userId);
    fetchAttendance();
  }, [attendance, daycareId, isDemoMode, fetchAttendance]);

  const updateRecord = useCallback((childId: string, update: any) => {
    setAttendance((prev) =>
      prev.map((a) => (a.childId === childId || a.child_id === childId ? { ...a, ...update } : a))
    );
  }, []);

  return {
    attendance,
    isLoading,
    checkIn,
    checkOut,
    updateRecord,
    refetch: fetchAttendance,
    setAttendance, // For demo mode
  };
}

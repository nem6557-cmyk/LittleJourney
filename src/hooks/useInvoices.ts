import { useState, useEffect, useCallback } from 'react';
import { invoicesService } from '../services/invoices.service';

/**
 * Hook for managing invoices.
 */
export function useInvoices(
  userId?: string,
  daycareId?: string,
  role: 'parent' | 'admin' | 'caregiver' = 'parent',
  isDemoMode = false
) {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchInvoices = useCallback(async () => {
    if (isDemoMode || !userId) return;
    setIsLoading(true);
    try {
      const data = role === 'parent'
        ? await invoicesService.getParentInvoices(userId)
        : daycareId
          ? await invoicesService.getDaycareInvoices(daycareId)
          : [];
      setInvoices(data);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, daycareId, role, isDemoMode]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const payInvoice = useCallback(async (invoiceId: string) => {
    if (isDemoMode) {
      setInvoices((prev) =>
        prev.map((inv) =>
          inv.id === invoiceId
            ? { ...inv, status: 'paid', paidDate: new Date().toISOString().split('T')[0], paid_at: new Date().toISOString() }
            : inv
        )
      );
      return;
    }
    await invoicesService.updateInvoiceStatus(invoiceId, 'paid');
    fetchInvoices();
  }, [isDemoMode, fetchInvoices]);

  return {
    invoices,
    isLoading,
    payInvoice,
    refetch: fetchInvoices,
    setInvoices, // For demo mode
  };
}

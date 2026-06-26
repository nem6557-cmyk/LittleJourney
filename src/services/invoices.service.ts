import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

export const invoicesService = {
  getParentInvoices: async (parentId: string) => {
    const { data, error } = await supabase
      .from('invoices')
      .select('*, child:children!child_id(first_name, last_name)')
      .eq('parent_id', parentId)
      .order('due_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  getDaycareInvoices: async (daycareId: string, options?: { status?: Database['public']['Tables']['invoices']['Row']['status'] }) => {
    let query = supabase
      .from('invoices')
      .select('*, parent:profiles!parent_id(first_name, last_name, email), child:children!child_id(first_name, last_name)')
      .eq('daycare_id', daycareId)
      .order('due_date', { ascending: false });
    if (options?.status) query = query.eq('status', options.status);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  createInvoice: async (invoice: {
    daycare_id: string; parent_id: string; child_id: string;
    amount_cents: number; due_date: string; description: string;
    line_items: { description: string; amount: number }[];
  }) => {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoice)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateInvoiceStatus: async (
    invoiceId: string,
    status: Database['public']['Tables']['invoices']['Row']['status'],
    paidAt?: string,
  ) => {
    const updates: Database['public']['Tables']['invoices']['Update'] = { status };
    if (paidAt) updates.paid_at = paidAt;
    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', invoiceId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

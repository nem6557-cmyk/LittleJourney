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
    status?: 'draft' | 'pending';
  }) => {
    const { data, error } = await supabase
      .from('invoices')
      .insert(invoice)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Parents/guardians linked to a child (for choosing who to bill). Admin-scoped by RLS. */
  getChildBillingParents: async (childId: string) => {
    const { data, error } = await supabase
      .from('parent_children')
      .select('parent_id, relationship, parent:profiles!parent_id(first_name, last_name, email)')
      .eq('child_id', childId);
    if (error) throw error;
    return (data ?? []) as unknown as Array<{
      parent_id: string;
      relationship: string;
      parent: { first_name: string; last_name: string; email: string } | null;
    }>;
  },

  /** Unsent invoices can be deleted; sent ones are immutable (DB policy + trigger). */
  deleteUnsentInvoice: async (invoiceId: string) => {
    const { error } = await supabase.from('invoices').delete().eq('id', invoiceId).is('stripe_invoice_id', null);
    if (error) throw error;
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

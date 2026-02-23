import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type AttendanceInsert = Database['public']['Tables']['attendance']['Insert'];
type AttendanceUpdate = Database['public']['Tables']['attendance']['Update'];

export const attendanceService = {
  getAttendance: async (daycareId: string, date: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .select('*, child:children!child_id(id, first_name, last_name, avatar_url, classroom_id)')
      .eq('daycare_id', daycareId)
      .eq('date', date)
      .order('child(first_name)');
    if (error) throw error;
    return data;
  },

  getChildAttendance: async (childId: string, options?: { from?: string; to?: string }) => {
    let query = supabase
      .from('attendance')
      .select('*')
      .eq('child_id', childId)
      .order('date', { ascending: false });

    if (options?.from) query = query.gte('date', options.from);
    if (options?.to) query = query.lte('date', options.to);

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  checkIn: async (record: AttendanceInsert) => {
    const { data, error } = await supabase
      .from('attendance')
      .upsert(record, { onConflict: 'child_id,date' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  checkOut: async (childId: string, date: string, checkOutBy: string) => {
    const { data, error } = await supabase
      .from('attendance')
      .update({
        check_out_at: new Date().toISOString(),
        check_out_by: checkOutBy,
      })
      .eq('child_id', childId)
      .eq('date', date)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateAttendance: async (id: string, updates: AttendanceUpdate) => {
    const { data, error } = await supabase
      .from('attendance')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

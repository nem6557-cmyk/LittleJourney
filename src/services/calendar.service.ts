import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type CalendarEventInsert = Database['public']['Tables']['calendar_events']['Insert'];

export const calendarService = {
  getEvents: async (daycareId: string, options?: { from?: string; to?: string; classroomId?: string }) => {
    let query = supabase
      .from('calendar_events')
      .select('*, creator:profiles!created_by(first_name, last_name)')
      .eq('daycare_id', daycareId)
      .order('start_at');
    if (options?.from) query = query.gte('start_at', options.from);
    if (options?.to) query = query.lte('start_at', options.to);
    if (options?.classroomId) query = query.or(`classroom_id.eq.${options.classroomId},classroom_id.is.null`);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  createEvent: async (event: CalendarEventInsert) => {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(event)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteEvent: async (eventId: string) => {
    const { error } = await supabase.from('calendar_events').delete().eq('id', eventId);
    if (error) throw error;
  },
};

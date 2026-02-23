import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type IncidentInsert = Database['public']['Tables']['incidents']['Insert'];

export const incidentsService = {
  getIncidents: async (daycareId: string, options?: { childId?: string }) => {
    let query = supabase
      .from('incidents')
      .select('*, child:children!child_id(first_name, last_name), reporter:profiles!reported_by(first_name, last_name)')
      .eq('daycare_id', daycareId)
      .order('created_at', { ascending: false });
    if (options?.childId) query = query.eq('child_id', options.childId);
    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  createIncident: async (incident: IncidentInsert) => {
    const { data, error } = await supabase
      .from('incidents')
      .insert(incident)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  notifyParent: async (incidentId: string) => {
    const { error } = await supabase
      .from('incidents')
      .update({ parent_notified_at: new Date().toISOString() })
      .eq('id', incidentId);
    if (error) throw error;
  },
};

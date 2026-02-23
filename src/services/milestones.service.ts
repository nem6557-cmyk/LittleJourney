import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type MilestoneInsert = Database['public']['Tables']['milestones']['Insert'];

export const milestonesService = {
  getMilestones: async (childId: string) => {
    const { data, error } = await supabase
      .from('milestones')
      .select('*')
      .eq('child_id', childId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  addMilestone: async (milestone: MilestoneInsert) => {
    const { data, error } = await supabase
      .from('milestones')
      .insert(milestone)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  markAchieved: async (milestoneId: string, notedBy: string) => {
    const { data, error } = await supabase
      .from('milestones')
      .update({ achieved_at: new Date().toISOString(), noted_by: notedBy })
      .eq('id', milestoneId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};

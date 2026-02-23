import { supabase } from '../lib/supabase';
import type { Profile } from '../types/database';

export const authService = {
  getProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  updateProfile: async (userId: string, updates: Partial<Profile>) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updatePushToken: async (userId: string, pushToken: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ push_token: pushToken })
      .eq('id', userId);
    if (error) throw error;
  },

  recordCoppaConsent: async (userId: string) => {
    const { error } = await supabase
      .from('profiles')
      .update({ coppa_consent_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw error;
  },
};

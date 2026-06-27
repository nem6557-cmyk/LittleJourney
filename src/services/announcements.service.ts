import { supabase } from '../lib/supabase';

export interface Announcement {
  id: string;
  daycare_id: string;
  author_id: string;
  title: string;
  body: string;
  audience: 'all' | 'parents' | 'caregivers';
  created_at: string;
}

export const announcementsService = {
  list: async (daycareId: string): Promise<Announcement[]> => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('daycare_id', daycareId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []) as Announcement[];
  },

  create: async (input: {
    daycare_id: string;
    author_id: string;
    title: string;
    body: string;
    audience?: 'all' | 'parents' | 'caregivers';
  }) => {
    const { data, error } = await supabase
      .from('announcements')
      .insert({
        daycare_id: input.daycare_id,
        author_id: input.author_id,
        title: input.title,
        body: input.body,
        audience: input.audience ?? 'all',
      })
      .select()
      .single();
    if (error) throw error;
    return data as Announcement;
  },
};

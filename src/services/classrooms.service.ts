import { supabase } from '../lib/supabase';

export interface Classroom {
  id: string;
  daycare_id: string;
  name: string;
  age_group: string | null;
  capacity: number;
  created_at: string;
}

export const classroomsService = {
  list: async (daycareId: string): Promise<Classroom[]> => {
    const { data, error } = await supabase
      .from('classrooms')
      .select('*')
      .eq('daycare_id', daycareId)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data || []) as Classroom[];
  },

  create: async (input: { daycare_id: string; name: string; age_group?: string | null; capacity?: number }) => {
    const { data, error } = await supabase
      .from('classrooms')
      .insert({
        daycare_id: input.daycare_id,
        name: input.name,
        age_group: input.age_group ?? null,
        capacity: input.capacity ?? 12,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Classroom;
  },

  update: async (id: string, updates: { name?: string; age_group?: string | null; capacity?: number }) => {
    const { data, error } = await supabase
      .from('classrooms')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Classroom;
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('classrooms').delete().eq('id', id);
    if (error) throw error;
  },
};

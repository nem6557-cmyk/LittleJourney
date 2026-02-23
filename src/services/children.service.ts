import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';

type ChildInsert = Database['public']['Tables']['children']['Insert'];
type ChildUpdate = Database['public']['Tables']['children']['Update'];

export const childrenService = {
  // Get children visible to current user (parents see linked, staff see daycare-wide)
  getChildren: async () => {
    const { data, error } = await supabase
      .from('children')
      .select('*, classrooms(name, age_group)')
      .order('first_name');
    if (error) throw error;
    return data;
  },

  getChild: async (childId: string) => {
    const { data, error } = await supabase
      .from('children')
      .select('*, classrooms(name, age_group)')
      .eq('id', childId)
      .single();
    if (error) throw error;
    return data;
  },

  createChild: async (child: ChildInsert) => {
    const { data, error } = await supabase
      .from('children')
      .insert(child)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateChild: async (childId: string, updates: ChildUpdate) => {
    const { data, error } = await supabase
      .from('children')
      .update(updates)
      .eq('id', childId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteChild: async (childId: string) => {
    const { error } = await supabase
      .from('children')
      .delete()
      .eq('id', childId);
    if (error) throw error;
  },

  // Parent-child relationship management
  linkParentChild: async (parentId: string, childId: string, relationship: 'parent' | 'guardian' | 'family' | 'pediatrician' = 'parent') => {
    const { data, error } = await supabase
      .from('parent_children')
      .insert({ parent_id: parentId, child_id: childId, relationship })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getParentChildren: async (parentId: string) => {
    const { data, error } = await supabase
      .from('parent_children')
      .select('*, children(*, classrooms(name, age_group))')
      .eq('parent_id', parentId);
    if (error) throw error;
    return data;
  },
};

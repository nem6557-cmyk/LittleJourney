import { supabase } from '../lib/supabase';
import type { AuthorizedPickup } from '../types/database';

interface CreateAuthorizedPickupInput {
  childId: string;
  daycareId: string;
  name: string;
  relationship: string;
  phone: string;
  createdBy?: string | null;
}

export const authorizedPickupsService = {
  listByChildIds: async (childIds: string[]): Promise<AuthorizedPickup[]> => {
    if (childIds.length === 0) return [];

    const { data, error } = await supabase
      .from('authorized_pickups')
      .select('*')
      .in('child_id', childIds)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  createPickup: async ({
    childId,
    daycareId,
    name,
    relationship,
    phone,
    createdBy = null,
  }: CreateAuthorizedPickupInput): Promise<AuthorizedPickup> => {
    const { data, error } = await supabase
      .from('authorized_pickups')
      .insert({
        child_id: childId,
        daycare_id: daycareId,
        name,
        relationship,
        phone,
        created_by: createdBy,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

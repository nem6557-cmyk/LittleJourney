import { supabase } from '../lib/supabase';

// Current COPPA policy version. Bump when the policy text changes so each
// consent record is tied to the exact version the parent agreed to.
export const COPPA_POLICY_VERSION = '2026-06-01';

export const consentsService = {
  // Record a consent audit row for the parent (optionally per child).
  record: async (params: {
    parentId: string;
    daycareId?: string | null;
    childId?: string | null;
    signedName: string;
    consented?: boolean;
  }) => {
    const { error } = await supabase.from('coppa_consents').insert({
      parent_id: params.parentId,
      daycare_id: params.daycareId ?? null,
      child_id: params.childId ?? null,
      policy_version: COPPA_POLICY_VERSION,
      signed_name: params.signedName,
      consented: params.consented ?? true,
    });
    if (error) throw error;
  },
};

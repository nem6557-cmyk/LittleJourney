import { supabase } from '../lib/supabase';
import type { InviteCode } from '../types/database';

export type InviteCodeRole = InviteCode['role'];

interface CreateInviteCodeInput {
  daycareId: string;
  createdBy: string;
  role: InviteCodeRole;
  childId?: string | null;
  classroomId?: string | null;
}

export const inviteCodesService = {
  createInviteCode: async ({
    daycareId,
    createdBy,
    role,
    childId = null,
    classroomId = null,
  }: CreateInviteCodeInput): Promise<InviteCode> => {
    const { data, error } = await supabase
      .from('invite_codes')
      .insert({
        daycare_id: daycareId,
        created_by: createdBy,
        role,
        child_id: childId,
        classroom_id: classroomId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

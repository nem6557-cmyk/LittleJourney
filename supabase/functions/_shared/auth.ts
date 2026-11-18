import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { HttpError } from './http.ts';

/** Service-role client: bypasses RLS. Only ever used after authenticating the caller. */
export const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

export interface CallerProfile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  role: 'parent' | 'caregiver' | 'admin' | 'family';
  daycare_id: string | null;
  stripe_customer_id: string | null;
}

export interface Caller {
  user: { id: string; email?: string | null };
  profile: CallerProfile;
}

/** Verify the bearer JWT and load the caller's profile. Throws HttpError 401/403. */
export async function requireCaller(req: Request): Promise<Caller> {
  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new HttpError(401, 'Unauthorized');

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Unauthorized');

  const { data: profile } = await admin
    .from('profiles')
    .select('id, email, first_name, last_name, role, daycare_id, stripe_customer_id')
    .eq('id', data.user.id)
    .single();
  if (!profile) throw new HttpError(403, 'Profile not found');

  return { user: data.user, profile: profile as CallerProfile };
}

export function requireAdmin(caller: Caller): string {
  if (caller.profile.role !== 'admin' || !caller.profile.daycare_id) {
    throw new HttpError(403, 'Only a daycare administrator can do this.');
  }
  return caller.profile.daycare_id;
}

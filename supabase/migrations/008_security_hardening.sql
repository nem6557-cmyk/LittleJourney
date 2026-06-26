-- ============================================================
-- 008: Security hardening — close privilege-escalation & fake-payment holes
-- ============================================================
-- Three CRITICAL issues found in the June 2026 audit:
--   1. profiles UPDATE had no WITH CHECK -> any user could self-promote to
--      role='admin' or move to any daycare_id.
--   2. handle_new_user copied client-controlled raw_user_meta_data.role ->
--      anyone could sign up as admin.
--   3. invoices had a parent UPDATE policy -> a parent could set status='paid'
--      with no money movement.

-- ── 1. profiles UPDATE: forbid changing role or daycare_id ──
-- Role/daycare changes must go through redeem_invite_code / join_demo_daycare
-- (SECURITY DEFINER), never a direct client UPDATE.
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    -- role and daycare_id must match the row's existing values
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
    AND daycare_id IS NOT DISTINCT FROM (SELECT p.daycare_id FROM profiles p WHERE p.id = auth.uid())
  );

-- ── 2. handle_new_user: never trust client-supplied role ──
-- New users are always 'parent'; real roles are assigned only via the
-- invite-redemption / daycare-creation RPCs.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    'parent'  -- always parent at signup; elevated roles require an invite
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. invoices: parents may never write invoice rows ──
-- Status transitions (paid / overdue) come only from the stripe-webhook,
-- which runs with the service role and bypasses RLS.
DROP POLICY IF EXISTS "Parents can update own invoices (pay)" ON invoices;

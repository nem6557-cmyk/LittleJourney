-- ============================================================
-- 009: Backend polish — MEDIUM audit findings
-- ============================================================

-- ── 1. Conversations: only staff may create them ──
-- The old INSERT policy allowed any user in the daycare (incl. parents) to
-- create conversation rows. Scope creation to caregivers/admins, consistent
-- with admin-managed membership.
DROP POLICY IF EXISTS "Staff can create conversations" ON conversations;

CREATE POLICY "Staff can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (
    daycare_id = get_user_daycare_id()
    AND get_user_role() IN ('caregiver', 'admin')
  );

-- ── 2. timeline_entries.author_id nullable ──
-- GDPR/CCPA account deletion anonymizes authored entries by setting author_id
-- to NULL, but the column was NOT NULL, so deletion errored mid-way. Allow
-- NULL (the FK already ON DELETE CASCADE / SET semantics are handled by the
-- deletion function, which now sets NULL for anonymization).
ALTER TABLE timeline_entries ALTER COLUMN author_id DROP NOT NULL;

-- ── 3. create_daycare RPC (atomic onboarding) ──
-- Client-side createDaycare did 3 separate writes (daycare, profile link,
-- subscription) with no transaction, and the profile link is now blocked by
-- the 008 WITH CHECK (role/daycare_id can't change via direct UPDATE). Do it
-- all atomically server-side. The caller becomes admin of the new daycare.
CREATE OR REPLACE FUNCTION create_daycare(
  p_name TEXT,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_zip TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing_daycare UUID;
  v_daycare_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- A user may only create a daycare if they aren't already attached to one.
  SELECT daycare_id INTO v_existing_daycare FROM profiles WHERE id = v_uid;
  IF v_existing_daycare IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'You already belong to a daycare');
  END IF;

  INSERT INTO daycares (name, address, city, state, zip, phone, email)
  VALUES (p_name, p_address, p_city, p_state, p_zip, p_phone, p_email)
  RETURNING id INTO v_daycare_id;

  UPDATE profiles SET daycare_id = v_daycare_id, role = 'admin' WHERE id = v_uid;

  INSERT INTO subscriptions (daycare_id, plan_tier, status, current_period_end)
  VALUES (v_daycare_id, 'starter', 'trialing', NOW() + INTERVAL '14 days');

  RETURN jsonb_build_object('error', NULL, 'daycare_id', v_daycare_id);
END;
$$;

REVOKE ALL ON FUNCTION create_daycare(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_daycare(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ── 4. Demo daycare safety note ──
-- join_demo_daycare (migration 004) attaches the caller to the seeded demo
-- tenant. It is intended for development/pilot only. In a real production
-- project this function should be dropped so users can't self-join the demo
-- daycare. Left in place here but flagged; revoke in a prod-only migration:
--   REVOKE EXECUTE ON FUNCTION join_demo_daycare() FROM authenticated;
-- (Not executed automatically so local/dev pilots keep working.)

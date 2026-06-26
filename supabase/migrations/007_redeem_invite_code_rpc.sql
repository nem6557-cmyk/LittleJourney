-- ============================================================
-- 007: Secure invite-code redemption via SECURITY DEFINER RPC
-- ============================================================
-- Previously the client read invite_codes directly with a SELECT policy that
-- let ANY authenticated user enumerate every unused code platform-wide, and
-- redemption relied on the client to set its own role/daycare_id. This moves
-- the whole flow server-side: exact-code lookup + redeem + profile link happen
-- atomically, the caller cannot choose an arbitrary role, and the permissive
-- SELECT policy is dropped so codes can no longer be listed.

-- 1. Drop the enumeration-prone SELECT policy. Lookups now go through the RPC.
DROP POLICY IF EXISTS "Authenticated users can lookup invite codes" ON invite_codes;

-- 2. Redemption RPC. Runs as definer so it can read/update invite_codes and
--    write the profile + link rows without exposing the table to clients.
CREATE OR REPLACE FUNCTION redeem_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_invite invite_codes%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Exact-match lookup of an unused, unexpired code. Row-lock to avoid two
  -- users redeeming the same code concurrently.
  SELECT * INTO v_invite
  FROM invite_codes
  WHERE code = upper(p_code)
    AND used_by IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid or expired invite code');
  END IF;

  -- Mark the code as used.
  UPDATE invite_codes
  SET used_by = v_uid, used_at = NOW()
  WHERE id = v_invite.id;

  -- Link the caller to the daycare with the role baked into the invite
  -- (the caller cannot influence this).
  UPDATE profiles
  SET daycare_id = v_invite.daycare_id,
      role = v_invite.role::user_role
  WHERE id = v_uid;

  -- Parent invite with a specific child -> parent-child link.
  IF v_invite.role = 'parent' AND v_invite.child_id IS NOT NULL THEN
    INSERT INTO parent_children (parent_id, child_id, relationship)
    VALUES (v_uid, v_invite.child_id, 'parent')
    ON CONFLICT (parent_id, child_id) DO NOTHING;
  END IF;

  -- Caregiver invite with a specific classroom -> assignment.
  IF v_invite.role = 'caregiver' AND v_invite.classroom_id IS NOT NULL THEN
    INSERT INTO caregiver_classrooms (caregiver_id, classroom_id)
    VALUES (v_uid, v_invite.classroom_id)
    ON CONFLICT (caregiver_id, classroom_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('error', NULL, 'daycare_id', v_invite.daycare_id, 'role', v_invite.role);
END;
$$;

-- Only authenticated users may call it.
REVOKE ALL ON FUNCTION redeem_invite_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_invite_code(TEXT) TO authenticated;

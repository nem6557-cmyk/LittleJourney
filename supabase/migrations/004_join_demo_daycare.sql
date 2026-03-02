-- ============================================================
-- Migration 004: join_demo_daycare RPC
-- Allows authenticated users to join the seeded Sunshine Academy
-- demo daycare during pilot/onboarding.
-- ============================================================

CREATE OR REPLACE FUNCTION public.join_demo_daycare()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id       uuid := auth.uid();
  _role          user_role;
  _demo_daycare  uuid := 'd0000000-0000-0000-0000-000000000001';
  _profile       profiles%ROWTYPE;
BEGIN
  -- Must be authenticated
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- Get current profile
  SELECT * INTO _profile FROM profiles WHERE id = _user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;

  -- Already linked to a daycare
  IF _profile.daycare_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'Already linked to a daycare');
  END IF;

  -- Verify demo daycare exists (requires seed data)
  IF NOT EXISTS (SELECT 1 FROM daycares WHERE id = _demo_daycare) THEN
    RETURN jsonb_build_object('error', 'Demo daycare not found. Please run seed data first.');
  END IF;

  _role := _profile.role;

  -- Link profile to demo daycare
  UPDATE profiles
  SET daycare_id = _demo_daycare,
      updated_at = NOW()
  WHERE id = _user_id;

  -- Role-specific linking
  IF _role = 'parent' OR _role = 'family' THEN
    -- Link parent to demo children (Layla & Adam Ahmed)
    INSERT INTO parent_children (parent_id, child_id, relationship)
    VALUES
      (_user_id, 'a0000000-0000-0000-0000-000000000001', 'parent'),
      (_user_id, 'a0000000-0000-0000-0000-000000000002', 'parent')
    ON CONFLICT (parent_id, child_id) DO NOTHING;

  ELSIF _role = 'caregiver' THEN
    -- Assign caregiver to Butterflies classroom
    INSERT INTO caregiver_classrooms (caregiver_id, classroom_id, is_lead)
    VALUES (_user_id, 'c0000000-0000-0000-0000-000000000001', FALSE)
    ON CONFLICT (caregiver_id, classroom_id) DO NOTHING;

  END IF;
  -- Admins just get daycare link (already done above)

  RETURN jsonb_build_object('daycare_id', _demo_daycare);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.join_demo_daycare() TO authenticated;

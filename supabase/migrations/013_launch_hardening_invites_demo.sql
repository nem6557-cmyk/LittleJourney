-- ============================================================
-- 013: Launch hardening for invites, pickups, and demo access
-- ============================================================

-- Staff invites can legitimately target admins. Redemption remains safe because
-- only existing daycare admins can create invite_codes, and redeem_invite_code
-- assigns the role embedded in the server-side invite row.
ALTER TYPE invite_role ADD VALUE IF NOT EXISTS 'admin';

-- Increase invite-code entropy from 32 bits (8 hex chars) to 128 bits
-- (32 hex chars). The client accepts both old and new lengths during rollout,
-- but all newly generated codes use the stronger format.
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := UPPER(ENCODE(gen_random_bytes(16), 'hex'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Validate tenant-scoped invite links at the database boundary. An invite for a
-- daycare must never point to a child/classroom owned by a different daycare.
CREATE OR REPLACE FUNCTION validate_invite_code_scope()
RETURNS TRIGGER AS $$
DECLARE
  v_child_daycare UUID;
  v_classroom_daycare UUID;
BEGIN
  IF NEW.child_id IS NOT NULL THEN
    SELECT daycare_id INTO v_child_daycare FROM children WHERE id = NEW.child_id;
    IF v_child_daycare IS DISTINCT FROM NEW.daycare_id THEN
      RAISE EXCEPTION 'Invite child must belong to the invite daycare';
    END IF;
  END IF;

  IF NEW.classroom_id IS NOT NULL THEN
    SELECT daycare_id INTO v_classroom_daycare FROM classrooms WHERE id = NEW.classroom_id;
    IF v_classroom_daycare IS DISTINCT FROM NEW.daycare_id THEN
      RAISE EXCEPTION 'Invite classroom must belong to the invite daycare';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_invite_code_scope ON invite_codes;
CREATE TRIGGER tr_invite_code_scope
  BEFORE INSERT OR UPDATE OF daycare_id, child_id, classroom_id ON invite_codes
  FOR EACH ROW EXECUTE FUNCTION validate_invite_code_scope();

-- Recreate redemption so invite codes cannot be used to move an already-linked
-- account across tenants. Cross-tenant transfers must be a deliberate admin
-- workflow that cleans up old relationships atomically.
CREATE OR REPLACE FUNCTION redeem_invite_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_invite invite_codes%ROWTYPE;
  v_profile profiles%ROWTYPE;
  v_child_daycare UUID;
  v_classroom_daycare UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Profile not found');
  END IF;
  IF v_profile.daycare_id IS NOT NULL THEN
    RETURN jsonb_build_object('error', 'This account already belongs to a daycare');
  END IF;

  SELECT * INTO v_invite
  FROM invite_codes
  WHERE code = upper(p_code)
    AND used_by IS NULL
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Invalid or expired invite code');
  END IF;

  IF v_invite.child_id IS NOT NULL THEN
    SELECT daycare_id INTO v_child_daycare FROM children WHERE id = v_invite.child_id;
    IF v_child_daycare IS DISTINCT FROM v_invite.daycare_id THEN
      RETURN jsonb_build_object('error', 'Invalid invite child scope');
    END IF;
  END IF;

  IF v_invite.classroom_id IS NOT NULL THEN
    SELECT daycare_id INTO v_classroom_daycare FROM classrooms WHERE id = v_invite.classroom_id;
    IF v_classroom_daycare IS DISTINCT FROM v_invite.daycare_id THEN
      RETURN jsonb_build_object('error', 'Invalid invite classroom scope');
    END IF;
  END IF;

  UPDATE invite_codes
  SET used_by = v_uid, used_at = NOW()
  WHERE id = v_invite.id;

  UPDATE profiles
  SET daycare_id = v_invite.daycare_id,
      role = v_invite.role::text::user_role
  WHERE id = v_uid;

  IF v_invite.role IN ('parent', 'family') AND v_invite.child_id IS NOT NULL THEN
    INSERT INTO parent_children (parent_id, child_id, relationship)
    VALUES (v_uid, v_invite.child_id, v_invite.role::text::relationship_type)
    ON CONFLICT (parent_id, child_id) DO NOTHING;
  END IF;

  IF v_invite.role = 'caregiver' AND v_invite.classroom_id IS NOT NULL THEN
    INSERT INTO caregiver_classrooms (caregiver_id, classroom_id)
    VALUES (v_uid, v_invite.classroom_id)
    ON CONFLICT (caregiver_id, classroom_id) DO NOTHING;
  END IF;

  RETURN jsonb_build_object('error', NULL, 'daycare_id', v_invite.daycare_id, 'role', v_invite.role);
END;
$$;

REVOKE ALL ON FUNCTION redeem_invite_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION redeem_invite_code(TEXT) TO authenticated;

-- Move RLS helper use to a non-exposed schema so arbitrary-ID SECURITY DEFINER
-- helpers are not callable as public RPC endpoints.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE OR REPLACE FUNCTION app_private.current_daycare_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT daycare_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION app_private.current_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION app_private.child_daycare_id(p_child_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT daycare_id FROM children WHERE id = p_child_id;
$$;

CREATE OR REPLACE FUNCTION app_private.is_parent_of_child(p_child_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM parent_children
    WHERE parent_id = auth.uid()
    AND child_id = p_child_id
  );
$$;

CREATE OR REPLACE FUNCTION app_private.is_conversation_member(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE user_id = auth.uid()
    AND conversation_id = p_conversation_id
  );
$$;

CREATE OR REPLACE FUNCTION app_private.conversation_daycare_id(p_conversation_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT daycare_id FROM conversations WHERE id = p_conversation_id;
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_private TO authenticated;

DROP POLICY IF EXISTS "Parents can view own children" ON children;
CREATE POLICY "Parents can view own children"
  ON children FOR SELECT
  USING (
    app_private.is_parent_of_child(id)
    AND daycare_id = app_private.current_daycare_id()
  );

DROP POLICY IF EXISTS "Admins can manage relationships" ON parent_children;
CREATE POLICY "Admins can manage relationships"
  ON parent_children FOR ALL
  USING (
    app_private.child_daycare_id(child_id) = app_private.current_daycare_id()
    AND app_private.current_role() = 'admin'
  )
  WITH CHECK (
    app_private.child_daycare_id(child_id) = app_private.current_daycare_id()
    AND app_private.current_role() = 'admin'
  );

DROP POLICY IF EXISTS "Parents can view own children timeline" ON timeline_entries;
CREATE POLICY "Parents can view own children timeline"
  ON timeline_entries FOR SELECT
  USING (
    app_private.is_parent_of_child(child_id)
    AND daycare_id = app_private.current_daycare_id()
  );

DROP POLICY IF EXISTS "Parents can view own children attendance" ON attendance;
CREATE POLICY "Parents can view own children attendance"
  ON attendance FOR SELECT
  USING (
    app_private.is_parent_of_child(child_id)
    AND daycare_id = app_private.current_daycare_id()
  );

DROP POLICY IF EXISTS "Parents can view own children incidents" ON incidents;
CREATE POLICY "Parents can view own children incidents"
  ON incidents FOR SELECT
  USING (
    app_private.is_parent_of_child(child_id)
    AND daycare_id = app_private.current_daycare_id()
  );

DROP POLICY IF EXISTS "Staff can view and manage daycare milestones" ON milestones;
CREATE POLICY "Staff can view and manage daycare milestones"
  ON milestones FOR ALL
  USING (
    app_private.child_daycare_id(child_id) = app_private.current_daycare_id()
    AND app_private.current_role() IN ('caregiver', 'admin')
  )
  WITH CHECK (
    app_private.child_daycare_id(child_id) = app_private.current_daycare_id()
    AND app_private.current_role() IN ('caregiver', 'admin')
  );

DROP POLICY IF EXISTS "Parents can view own children milestones" ON milestones;
CREATE POLICY "Parents can view own children milestones"
  ON milestones FOR SELECT
  USING (
    app_private.is_parent_of_child(child_id)
    AND app_private.child_daycare_id(child_id) = app_private.current_daycare_id()
  );

DROP POLICY IF EXISTS "Users can view comments on visible entries" ON comments;
CREATE POLICY "Users can view comments on visible entries"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM timeline_entries te
      WHERE te.id = comments.timeline_entry_id
      AND (
        (
          te.daycare_id = app_private.current_daycare_id()
          AND app_private.current_role() IN ('caregiver', 'admin')
        )
        OR (
          app_private.is_parent_of_child(te.child_id)
          AND te.daycare_id = app_private.current_daycare_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can add comments" ON comments;
CREATE POLICY "Users can add comments"
  ON comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM timeline_entries te
      WHERE te.id = comments.timeline_entry_id
      AND (
        (
          te.daycare_id = app_private.current_daycare_id()
          AND app_private.current_role() IN ('caregiver', 'admin')
        )
        OR (
          app_private.is_parent_of_child(te.child_id)
          AND te.daycare_id = app_private.current_daycare_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can view reactions on visible entries" ON reactions;
CREATE POLICY "Users can view reactions on visible entries"
  ON reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM timeline_entries te
      WHERE te.id = reactions.timeline_entry_id
      AND (
        (
          te.daycare_id = app_private.current_daycare_id()
          AND app_private.current_role() IN ('caregiver', 'admin')
        )
        OR (
          app_private.is_parent_of_child(te.child_id)
          AND te.daycare_id = app_private.current_daycare_id()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Members can view conversations" ON conversations;
CREATE POLICY "Members can view conversations"
  ON conversations FOR SELECT
  USING (app_private.is_conversation_member(id));

DROP POLICY IF EXISTS "Members can view membership" ON conversation_members;
CREATE POLICY "Members can view membership"
  ON conversation_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR app_private.is_conversation_member(conversation_id)
  );

DROP POLICY IF EXISTS "Admins can manage memberships" ON conversation_members;
CREATE POLICY "Admins can manage memberships"
  ON conversation_members FOR ALL
  USING (
    app_private.current_role() = 'admin'
    AND app_private.conversation_daycare_id(conversation_id) = app_private.current_daycare_id()
  )
  WITH CHECK (
    app_private.current_role() = 'admin'
    AND app_private.conversation_daycare_id(conversation_id) = app_private.current_daycare_id()
  );

DROP POLICY IF EXISTS "Members can view messages" ON messages;
CREATE POLICY "Members can view messages"
  ON messages FOR SELECT
  USING (app_private.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "Members can send messages" ON messages;
CREATE POLICY "Members can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND app_private.is_conversation_member(conversation_id)
  );

-- Authorized pickup people are child-scoped operational data. Parents can view
-- and propose pickups for their own child; staff/admins can view/manage daycare
-- pickups. New pickups default to unverified until daycare staff confirms.
CREATE TABLE IF NOT EXISTS authorized_pickups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT NOT NULL,
  photo_url TEXT,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authorized_pickups_child ON authorized_pickups(child_id);
CREATE INDEX IF NOT EXISTS idx_authorized_pickups_daycare ON authorized_pickups(daycare_id);

ALTER TABLE authorized_pickups ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON authorized_pickups TO authenticated;

CREATE OR REPLACE FUNCTION validate_authorized_pickup_scope()
RETURNS TRIGGER AS $$
BEGIN
  IF app_private.child_daycare_id(NEW.child_id) IS DISTINCT FROM NEW.daycare_id THEN
    RAISE EXCEPTION 'Authorized pickup child must belong to the pickup daycare';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, app_private;

DROP TRIGGER IF EXISTS tr_authorized_pickups_scope ON authorized_pickups;
CREATE TRIGGER tr_authorized_pickups_scope
  BEFORE INSERT OR UPDATE OF child_id, daycare_id ON authorized_pickups
  FOR EACH ROW EXECUTE FUNCTION validate_authorized_pickup_scope();

DROP POLICY IF EXISTS "Parents can view own child pickups" ON authorized_pickups;
CREATE POLICY "Parents can view own child pickups"
  ON authorized_pickups FOR SELECT
  USING (
    app_private.is_parent_of_child(child_id)
    AND daycare_id = app_private.current_daycare_id()
  );

DROP POLICY IF EXISTS "Parents can propose own child pickups" ON authorized_pickups;
CREATE POLICY "Parents can propose own child pickups"
  ON authorized_pickups FOR INSERT
  WITH CHECK (
    app_private.is_parent_of_child(child_id)
    AND daycare_id = app_private.child_daycare_id(child_id)
    AND daycare_id = app_private.current_daycare_id()
    AND created_by = auth.uid()
    AND verified = FALSE
  );

DROP POLICY IF EXISTS "Staff can view daycare pickups" ON authorized_pickups;
CREATE POLICY "Staff can view daycare pickups"
  ON authorized_pickups FOR SELECT
  USING (
    daycare_id = app_private.current_daycare_id()
    AND app_private.current_role() IN ('caregiver', 'admin')
  );

DROP POLICY IF EXISTS "Admins can manage daycare pickups" ON authorized_pickups;
CREATE POLICY "Admins can manage daycare pickups"
  ON authorized_pickups FOR ALL
  USING (
    daycare_id = app_private.current_daycare_id()
    AND child_id IS NOT NULL
    AND app_private.child_daycare_id(child_id) = app_private.current_daycare_id()
    AND app_private.current_role() = 'admin'
  )
  WITH CHECK (
    daycare_id = app_private.current_daycare_id()
    AND app_private.child_daycare_id(child_id) = app_private.current_daycare_id()
    AND app_private.current_role() = 'admin'
  );

DROP TRIGGER IF EXISTS tr_authorized_pickups_updated_at ON authorized_pickups;
CREATE TRIGGER tr_authorized_pickups_updated_at
  BEFORE UPDATE ON authorized_pickups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

REVOKE ALL ON FUNCTION public.get_child_daycare_id(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_parent_of_child(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_conversation_member(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_conversation_daycare_id(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_child_daycare_id(UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_parent_of_child(UUID, UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(UUID, UUID) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_conversation_daycare_id(UUID) FROM anon, authenticated;

-- The seeded demo daycare is useful in local/pilot environments, but should not
-- be callable by arbitrary authenticated users in a production project. Projects
-- that intentionally run the pilot can grant this back outside production.
REVOKE ALL ON FUNCTION public.join_demo_daycare() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_demo_daycare() FROM authenticated;

COMMENT ON FUNCTION public.join_demo_daycare() IS
  'Development/pilot helper. Keep EXECUTE revoked in production; grant only in controlled non-production projects.';

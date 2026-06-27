-- ============================================================
-- 010: Feature support — preferences, conversation creation, announcements
-- ============================================================

-- ── 1. Per-user preferences blob ──
-- Stores notification/privacy/language toggles so they persist across devices
-- instead of living only in AsyncStorage.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ── 2. create_conversation RPC (atomic, RLS-safe) ──
-- Creates a conversation in the caller's daycare and adds the caller + the
-- given participants as members. Returns the new conversation id. Runs as
-- definer so the multi-row insert (conversation + members) is atomic and not
-- blocked by member-visibility RLS during creation.
CREATE OR REPLACE FUNCTION create_conversation(
  p_participant_ids UUID[],
  p_type conversation_type DEFAULT 'direct',
  p_title TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_daycare UUID;
  v_conv_id UUID;
  v_member UUID;
  v_all_members UUID[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT daycare_id INTO v_daycare FROM profiles WHERE id = v_uid;
  IF v_daycare IS NULL THEN
    RETURN jsonb_build_object('error', 'You are not attached to a daycare');
  END IF;

  -- Caller is always a member; dedup the participant list.
  v_all_members := ARRAY(SELECT DISTINCT unnest(p_participant_ids || v_uid));

  -- Every participant must belong to the same daycare (no cross-tenant threads).
  IF EXISTS (
    SELECT 1 FROM unnest(v_all_members) m
    WHERE NOT EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = m AND p.daycare_id = v_daycare
    )
  ) THEN
    RETURN jsonb_build_object('error', 'All participants must be in your daycare');
  END IF;

  INSERT INTO conversations (daycare_id, type, title)
  VALUES (v_daycare, p_type, p_title)
  RETURNING id INTO v_conv_id;

  FOREACH v_member IN ARRAY v_all_members LOOP
    INSERT INTO conversation_members (conversation_id, user_id)
    VALUES (v_conv_id, v_member)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('error', NULL, 'conversation_id', v_conv_id);
END;
$$;

REVOKE ALL ON FUNCTION create_conversation(UUID[], conversation_type, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_conversation(UUID[], conversation_type, TEXT) TO authenticated;

-- ── 3. Announcements (admin broadcast) ──
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'all', -- all | parents | caregivers
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_daycare ON announcements(daycare_id);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Everyone in the daycare can read announcements.
CREATE POLICY "Daycare members can read announcements"
  ON announcements FOR SELECT
  USING (daycare_id = get_user_daycare_id());

-- Only admins can create/manage them.
CREATE POLICY "Admins can manage announcements"
  ON announcements FOR ALL
  USING (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin')
  WITH CHECK (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');

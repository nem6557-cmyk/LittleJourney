-- ============================================================
-- 011: Deferred-feature support — message edit/delete, COPPA audit, reports
-- ============================================================

-- ── 1. Message edit / soft-delete ──
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- A sender may edit/delete their OWN messages (and only within a conversation
-- they belong to). We use UPDATE for both (delete is a soft-delete via deleted_at).
CREATE POLICY "Senders can update own messages"
  ON messages FOR UPDATE
  USING (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id
      AND cm.user_id = auth.uid()
    )
  )
  WITH CHECK (sender_id = auth.uid());

-- ── 2. Per-child COPPA consent audit trail ──
-- One row per consent action with the policy version + signed name, so consent
-- is defensible and recorded per child (not just a single profile-level flag).
CREATE TABLE IF NOT EXISTS coppa_consents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  daycare_id UUID REFERENCES daycares(id) ON DELETE SET NULL,
  policy_version TEXT NOT NULL,
  signed_name TEXT NOT NULL,
  consented BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_coppa_consents_parent ON coppa_consents(parent_id);
CREATE INDEX IF NOT EXISTS idx_coppa_consents_child ON coppa_consents(child_id);

ALTER TABLE coppa_consents ENABLE ROW LEVEL SECURITY;

-- A parent can read and create their own consent records.
CREATE POLICY "Parents can view own consents"
  ON coppa_consents FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can record own consents"
  ON coppa_consents FOR INSERT
  WITH CHECK (parent_id = auth.uid());

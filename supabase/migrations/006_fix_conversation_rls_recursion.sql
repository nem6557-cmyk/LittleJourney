-- ============================================================
-- Migration 006: Fix conversation_members ↔ conversations
-- infinite RLS recursion
-- ============================================================
-- Problem: conversation_members admin policy references conversations,
-- and conversations member policy references conversation_members,
-- creating infinite recursion (Postgres error 42P17).
--
-- Solution: Use SECURITY DEFINER helper functions to break the cycle.
-- ============================================================

-- Helper: Check if a user is a member of a conversation (bypasses RLS)
CREATE OR REPLACE FUNCTION is_conversation_member(p_user_id UUID, p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM conversation_members
    WHERE user_id = p_user_id
    AND conversation_id = p_conversation_id
  );
$$;

-- Helper: Get a conversation's daycare_id (bypasses RLS)
CREATE OR REPLACE FUNCTION get_conversation_daycare_id(p_conversation_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT daycare_id FROM conversations WHERE id = p_conversation_id;
$$;

-- ============================================================
-- Fix CONVERSATIONS policy: use is_conversation_member()
-- ============================================================

DROP POLICY IF EXISTS "Members can view conversations" ON conversations;
CREATE POLICY "Members can view conversations"
  ON conversations FOR SELECT
  USING (is_conversation_member(auth.uid(), id));

-- ============================================================
-- Fix CONVERSATION_MEMBERS policies: use helper functions
-- ============================================================

DROP POLICY IF EXISTS "Members can view membership" ON conversation_members;
CREATE POLICY "Members can view membership"
  ON conversation_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR is_conversation_member(auth.uid(), conversation_id)
  );

DROP POLICY IF EXISTS "Admins can manage memberships" ON conversation_members;
CREATE POLICY "Admins can manage memberships"
  ON conversation_members FOR ALL
  USING (
    get_user_role() = 'admin'
    AND get_conversation_daycare_id(conversation_id) = get_user_daycare_id()
  );

-- ============================================================
-- Fix MESSAGES policy: references conversation_members
-- ============================================================

DROP POLICY IF EXISTS "Members can view messages" ON messages;
CREATE POLICY "Members can view messages"
  ON messages FOR SELECT
  USING (is_conversation_member(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Members can send messages" ON messages;
CREATE POLICY "Members can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND is_conversation_member(auth.uid(), conversation_id)
  );

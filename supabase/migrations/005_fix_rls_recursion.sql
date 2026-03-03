-- ============================================================
-- Migration 005: Fix infinite recursion in RLS policies
-- ============================================================
-- Problem: parent_children policies reference children table,
-- and children policies reference parent_children table,
-- creating an infinite recursion loop (Postgres error 42P17).
--
-- Solution: Create SECURITY DEFINER helper functions that bypass
-- RLS when checking cross-table relationships, breaking the cycle.
-- ============================================================

-- Helper: Get a child's daycare_id without triggering RLS on children
CREATE OR REPLACE FUNCTION get_child_daycare_id(p_child_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT daycare_id FROM children WHERE id = p_child_id;
$$;

-- Helper: Check if a user is a parent of a given child without triggering RLS on parent_children
CREATE OR REPLACE FUNCTION is_parent_of_child(p_parent_id UUID, p_child_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM parent_children
    WHERE parent_id = p_parent_id
    AND child_id = p_child_id
  );
$$;

-- ============================================================
-- Fix CHILDREN policies: use is_parent_of_child() instead of
-- direct subquery on parent_children
-- ============================================================

DROP POLICY IF EXISTS "Parents can view own children" ON children;
CREATE POLICY "Parents can view own children"
  ON children FOR SELECT
  USING (is_parent_of_child(auth.uid(), id));

-- ============================================================
-- Fix PARENT_CHILDREN policies: use get_child_daycare_id()
-- instead of direct subquery on children
-- ============================================================

DROP POLICY IF EXISTS "Admins can manage relationships" ON parent_children;
CREATE POLICY "Admins can manage relationships"
  ON parent_children FOR ALL
  USING (
    get_child_daycare_id(child_id) = get_user_daycare_id()
    AND get_user_role() = 'admin'
  );

-- ============================================================
-- Fix MILESTONES policy: uses children table which could also
-- trigger the cycle via parent RLS on children
-- ============================================================

DROP POLICY IF EXISTS "Staff can view and manage daycare milestones" ON milestones;
CREATE POLICY "Staff can view and manage daycare milestones"
  ON milestones FOR ALL
  USING (
    get_child_daycare_id(child_id) = get_user_daycare_id()
    AND get_user_role() IN ('caregiver', 'admin')
  );

-- ============================================================
-- Fix TIMELINE_ENTRIES parent policy: references parent_children
-- which references children which references parent_children...
-- ============================================================

DROP POLICY IF EXISTS "Parents can view own children timeline" ON timeline_entries;
CREATE POLICY "Parents can view own children timeline"
  ON timeline_entries FOR SELECT
  USING (is_parent_of_child(auth.uid(), child_id));

-- ============================================================
-- Fix ATTENDANCE parent policy: same pattern
-- ============================================================

DROP POLICY IF EXISTS "Parents can view own children attendance" ON attendance;
CREATE POLICY "Parents can view own children attendance"
  ON attendance FOR SELECT
  USING (is_parent_of_child(auth.uid(), child_id));

-- ============================================================
-- Fix INCIDENTS parent policy: same pattern
-- ============================================================

DROP POLICY IF EXISTS "Parents can view own children incidents" ON incidents;
CREATE POLICY "Parents can view own children incidents"
  ON incidents FOR SELECT
  USING (is_parent_of_child(auth.uid(), child_id));

-- ============================================================
-- Fix MILESTONES parent policy: same pattern
-- ============================================================

DROP POLICY IF EXISTS "Parents can view own children milestones" ON milestones;
CREATE POLICY "Parents can view own children milestones"
  ON milestones FOR SELECT
  USING (is_parent_of_child(auth.uid(), child_id));

-- ============================================================
-- Fix COMMENTS policy: references timeline_entries which
-- references parent_children
-- ============================================================

DROP POLICY IF EXISTS "Users can view comments on visible entries" ON comments;
CREATE POLICY "Users can view comments on visible entries"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM timeline_entries te
      WHERE te.id = comments.timeline_entry_id
      AND (
        te.daycare_id = get_user_daycare_id()
        OR is_parent_of_child(auth.uid(), te.child_id)
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
        te.daycare_id = get_user_daycare_id()
        OR is_parent_of_child(auth.uid(), te.child_id)
      )
    )
  );

-- ============================================================
-- Fix REACTIONS policy: same pattern as comments
-- ============================================================

DROP POLICY IF EXISTS "Users can view reactions on visible entries" ON reactions;
CREATE POLICY "Users can view reactions on visible entries"
  ON reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM timeline_entries te
      WHERE te.id = reactions.timeline_entry_id
      AND (
        te.daycare_id = get_user_daycare_id()
        OR is_parent_of_child(auth.uid(), te.child_id)
      )
    )
  );

-- ============================================================
-- LittleJourney Row Level Security Policies
-- Migration 002: RLS for multi-tenant daycare data isolation
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE daycares ENABLE ROW LEVEL SECURITY;
ALTER TABLE classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE caregiver_classrooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DAYCARES
-- ============================================================

-- Users can read their own daycare
CREATE POLICY "Users can view own daycare"
  ON daycares FOR SELECT
  USING (id = get_user_daycare_id());

-- Admins can update their daycare
CREATE POLICY "Admins can update own daycare"
  ON daycares FOR UPDATE
  USING (id = get_user_daycare_id() AND get_user_role() = 'admin');

-- Anyone can create a daycare (during signup/onboarding)
CREATE POLICY "Users can create daycares"
  ON daycares FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- CLASSROOMS
-- ============================================================

CREATE POLICY "Users can view classrooms in own daycare"
  ON classrooms FOR SELECT
  USING (daycare_id = get_user_daycare_id());

CREATE POLICY "Admins can manage classrooms"
  ON classrooms FOR ALL
  USING (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');

-- ============================================================
-- PROFILES
-- ============================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can read profiles in same daycare (for messaging, etc.)
CREATE POLICY "Users can read profiles in same daycare"
  ON profiles FOR SELECT
  USING (daycare_id = get_user_daycare_id() AND daycare_id IS NOT NULL);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Profile insert handled by trigger (handle_new_user), but allow self-insert
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ============================================================
-- CHILDREN
-- ============================================================

-- Parents can see their own children
CREATE POLICY "Parents can view own children"
  ON children FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_children
      WHERE parent_children.child_id = children.id
      AND parent_children.parent_id = auth.uid()
    )
  );

-- Caregivers/admins can see children in their daycare
CREATE POLICY "Staff can view daycare children"
  ON children FOR SELECT
  USING (
    daycare_id = get_user_daycare_id()
    AND get_user_role() IN ('caregiver', 'admin')
  );

-- Admins can manage children
CREATE POLICY "Admins can insert children"
  ON children FOR INSERT
  WITH CHECK (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');

CREATE POLICY "Admins can update children"
  ON children FOR UPDATE
  USING (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');

CREATE POLICY "Admins can delete children"
  ON children FOR DELETE
  USING (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');

-- ============================================================
-- PARENT-CHILDREN RELATIONSHIPS
-- ============================================================

CREATE POLICY "Users can view own relationships"
  ON parent_children FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Admins can manage relationships"
  ON parent_children FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM children c
      WHERE c.id = parent_children.child_id
      AND c.daycare_id = get_user_daycare_id()
    )
    AND get_user_role() = 'admin'
  );

-- ============================================================
-- CAREGIVER-CLASSROOMS
-- ============================================================

CREATE POLICY "Users can view caregiver assignments in own daycare"
  ON caregiver_classrooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = caregiver_classrooms.classroom_id
      AND c.daycare_id = get_user_daycare_id()
    )
  );

CREATE POLICY "Admins can manage caregiver assignments"
  ON caregiver_classrooms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM classrooms c
      WHERE c.id = caregiver_classrooms.classroom_id
      AND c.daycare_id = get_user_daycare_id()
    )
    AND get_user_role() = 'admin'
  );

-- ============================================================
-- TIMELINE ENTRIES
-- ============================================================

-- Parents see their children's entries
CREATE POLICY "Parents can view own children timeline"
  ON timeline_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.child_id = timeline_entries.child_id
      AND pc.parent_id = auth.uid()
    )
  );

-- Staff see all entries in their daycare
CREATE POLICY "Staff can view daycare timeline"
  ON timeline_entries FOR SELECT
  USING (
    daycare_id = get_user_daycare_id()
    AND get_user_role() IN ('caregiver', 'admin')
  );

-- Caregivers and admins can create entries
CREATE POLICY "Staff can create timeline entries"
  ON timeline_entries FOR INSERT
  WITH CHECK (
    daycare_id = get_user_daycare_id()
    AND get_user_role() IN ('caregiver', 'admin')
    AND author_id = auth.uid()
  );

-- Authors can update their own entries
CREATE POLICY "Authors can update own entries"
  ON timeline_entries FOR UPDATE
  USING (author_id = auth.uid());

-- Authors and admins can delete entries
CREATE POLICY "Authors and admins can delete entries"
  ON timeline_entries FOR DELETE
  USING (
    author_id = auth.uid()
    OR (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin')
  );

-- ============================================================
-- COMMENTS
-- ============================================================

-- Anyone who can see the timeline entry can see comments
CREATE POLICY "Users can view comments on visible entries"
  ON comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM timeline_entries te
      WHERE te.id = comments.timeline_entry_id
      AND (
        te.daycare_id = get_user_daycare_id()
        OR EXISTS (
          SELECT 1 FROM parent_children pc
          WHERE pc.child_id = te.child_id AND pc.parent_id = auth.uid()
        )
      )
    )
  );

-- Authenticated users can add comments on visible entries
CREATE POLICY "Users can add comments"
  ON comments FOR INSERT
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM timeline_entries te
      WHERE te.id = comments.timeline_entry_id
      AND (
        te.daycare_id = get_user_daycare_id()
        OR EXISTS (
          SELECT 1 FROM parent_children pc
          WHERE pc.child_id = te.child_id AND pc.parent_id = auth.uid()
        )
      )
    )
  );

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON comments FOR DELETE
  USING (author_id = auth.uid());

-- ============================================================
-- REACTIONS
-- ============================================================

CREATE POLICY "Users can view reactions on visible entries"
  ON reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM timeline_entries te
      WHERE te.id = reactions.timeline_entry_id
      AND (
        te.daycare_id = get_user_daycare_id()
        OR EXISTS (
          SELECT 1 FROM parent_children pc
          WHERE pc.child_id = te.child_id AND pc.parent_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can manage own reactions"
  ON reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove own reactions"
  ON reactions FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- CONVERSATIONS & MESSAGES
-- ============================================================

CREATE POLICY "Members can view conversations"
  ON conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = conversations.id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (daycare_id = get_user_daycare_id());

CREATE POLICY "Members can view membership"
  ON conversation_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM conversation_members cm2
      WHERE cm2.conversation_id = conversation_members.conversation_id
      AND cm2.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own membership"
  ON conversation_members FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage memberships"
  ON conversation_members FOR ALL
  USING (get_user_role() = 'admin' AND EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = conversation_members.conversation_id
    AND c.daycare_id = get_user_daycare_id()
  ));

CREATE POLICY "Members can view messages"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can send messages"
  ON messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_members cm
      WHERE cm.conversation_id = messages.conversation_id
      AND cm.user_id = auth.uid()
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Staff can create notifications for users in their daycare
CREATE POLICY "Staff can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    get_user_role() IN ('caregiver', 'admin')
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = user_id
        AND p.daycare_id = get_user_daycare_id()
    )
  );

-- ============================================================
-- ATTENDANCE
-- ============================================================

-- Parents see their children's attendance
CREATE POLICY "Parents can view own children attendance"
  ON attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.child_id = attendance.child_id
      AND pc.parent_id = auth.uid()
    )
  );

-- Staff see all attendance in their daycare
CREATE POLICY "Staff can view daycare attendance"
  ON attendance FOR SELECT
  USING (
    daycare_id = get_user_daycare_id()
    AND get_user_role() IN ('caregiver', 'admin')
  );

-- Staff can manage attendance
CREATE POLICY "Staff can manage attendance"
  ON attendance FOR ALL
  USING (
    daycare_id = get_user_daycare_id()
    AND get_user_role() IN ('caregiver', 'admin')
  );

-- ============================================================
-- INCIDENTS
-- ============================================================

CREATE POLICY "Parents can view own children incidents"
  ON incidents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.child_id = incidents.child_id
      AND pc.parent_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view daycare incidents"
  ON incidents FOR SELECT
  USING (
    daycare_id = get_user_daycare_id()
    AND get_user_role() IN ('caregiver', 'admin')
  );

CREATE POLICY "Staff can create incidents"
  ON incidents FOR INSERT
  WITH CHECK (
    daycare_id = get_user_daycare_id()
    AND get_user_role() IN ('caregiver', 'admin')
    AND reported_by = auth.uid()
  );

-- ============================================================
-- MILESTONES
-- ============================================================

CREATE POLICY "Parents can view own children milestones"
  ON milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.child_id = milestones.child_id
      AND pc.parent_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view and manage daycare milestones"
  ON milestones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM children c
      WHERE c.id = milestones.child_id
      AND c.daycare_id = get_user_daycare_id()
    )
    AND get_user_role() IN ('caregiver', 'admin')
  );

-- ============================================================
-- INVOICES
-- ============================================================

CREATE POLICY "Parents can view own invoices"
  ON invoices FOR SELECT
  USING (parent_id = auth.uid());

CREATE POLICY "Parents can update own invoices (pay)"
  ON invoices FOR UPDATE
  USING (parent_id = auth.uid());

CREATE POLICY "Admins can manage daycare invoices"
  ON invoices FOR ALL
  USING (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');

-- ============================================================
-- CALENDAR EVENTS
-- ============================================================

CREATE POLICY "Users can view daycare calendar"
  ON calendar_events FOR SELECT
  USING (daycare_id = get_user_daycare_id());

CREATE POLICY "Staff can manage calendar events"
  ON calendar_events FOR ALL
  USING (
    daycare_id = get_user_daycare_id()
    AND get_user_role() IN ('caregiver', 'admin')
  );

-- ============================================================
-- LEARNING PLANS
-- ============================================================

CREATE POLICY "Users can view daycare learning plans"
  ON learning_plans FOR SELECT
  USING (daycare_id = get_user_daycare_id());

CREATE POLICY "Staff can manage learning plans"
  ON learning_plans FOR ALL
  USING (
    daycare_id = get_user_daycare_id()
    AND get_user_role() IN ('caregiver', 'admin')
  );

-- ============================================================
-- SUBSCRIPTIONS
-- ============================================================

CREATE POLICY "Users can view own daycare subscription"
  ON subscriptions FOR SELECT
  USING (daycare_id = get_user_daycare_id());

-- Admins can view/update own daycare subscription
CREATE POLICY "Admins can update own daycare subscription"
  ON subscriptions FOR UPDATE
  USING (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');

-- Only admins can create subscriptions for their daycare
CREATE POLICY "Admins can insert daycare subscription"
  ON subscriptions FOR INSERT
  WITH CHECK (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');

-- ============================================================
-- PARENT SUBSCRIPTIONS
-- ============================================================

CREATE POLICY "Parents can view own subscription"
  ON parent_subscriptions FOR SELECT
  USING (parent_id = auth.uid());

-- Parents can update their own subscription
CREATE POLICY "Parents can update own subscription"
  ON parent_subscriptions FOR UPDATE
  USING (parent_id = auth.uid());

-- Parents can create their own subscription
CREATE POLICY "Parents can insert own subscription"
  ON parent_subscriptions FOR INSERT
  WITH CHECK (parent_id = auth.uid());

-- ============================================================
-- INVITE CODES
-- ============================================================

-- Anyone with an auth session can look up invite codes (for joining)
CREATE POLICY "Authenticated users can lookup invite codes"
  ON invite_codes FOR SELECT
  USING (auth.uid() IS NOT NULL AND used_by IS NULL AND expires_at > NOW());

-- Admins can create and manage invite codes
CREATE POLICY "Admins can manage invite codes"
  ON invite_codes FOR ALL
  USING (daycare_id = get_user_daycare_id() AND get_user_role() = 'admin');

-- Allow updating invite codes when redeemed
CREATE POLICY "Users can redeem invite codes"
  ON invite_codes FOR UPDATE
  USING (used_by IS NULL AND expires_at > NOW())
  WITH CHECK (used_by = auth.uid());

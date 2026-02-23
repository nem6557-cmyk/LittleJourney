-- ============================================================
-- LittleJourney Database Schema
-- Migration 001: Initial schema with all core tables
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('parent', 'caregiver', 'admin', 'family', 'pediatrician');
CREATE TYPE activity_type AS ENUM ('meal', 'nap', 'diaper', 'activity', 'milestone', 'photo', 'note', 'medication', 'checkin', 'checkout', 'mood', 'incident');
CREATE TYPE mood_type AS ENUM ('happy', 'calm', 'sleepy', 'fussy', 'playful');
CREATE TYPE conversation_type AS ENUM ('direct', 'group', 'announcement');
CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'late', 'excused');
CREATE TYPE incident_type AS ENUM ('fall', 'bite', 'scratch', 'bump', 'allergic_reaction', 'illness', 'other');
CREATE TYPE severity_level AS ENUM ('minor', 'moderate', 'serious');
CREATE TYPE calendar_event_type AS ENUM ('event', 'holiday', 'conference', 'vaccination', 'closure', 'birthday');
CREATE TYPE milestone_category AS ENUM ('cognitive', 'motor', 'social', 'language', 'self_care');
CREATE TYPE notification_type AS ENUM ('message', 'activity', 'milestone', 'alert', 'reminder', 'announcement', 'incident');
CREATE TYPE invoice_status AS ENUM ('draft', 'pending', 'paid', 'overdue', 'void');
CREATE TYPE subscription_tier AS ENUM ('trial', 'starter', 'professional', 'enterprise');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing');
CREATE TYPE parent_plan AS ENUM ('free', 'premium');
CREATE TYPE parent_sub_status AS ENUM ('active', 'past_due', 'canceled');
CREATE TYPE relationship_type AS ENUM ('parent', 'guardian', 'family', 'pediatrician');
CREATE TYPE invite_role AS ENUM ('parent', 'caregiver', 'family');

-- ============================================================
-- CORE TABLES
-- ============================================================

-- Daycares (tenants)
CREATE TABLE daycares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  stripe_account_id TEXT,
  stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  subscription_tier subscription_tier NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  max_children INTEGER NOT NULL DEFAULT 20,
  max_classrooms INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Classrooms
CREATE TABLE classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age_group TEXT,
  capacity INTEGER NOT NULL DEFAULT 12,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_classrooms_daycare ON classrooms(daycare_id);

-- User profiles (linked to auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'parent',
  daycare_id UUID REFERENCES daycares(id) ON DELETE SET NULL,
  push_token TEXT,
  coppa_consent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_daycare ON profiles(daycare_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- Children
CREATE TABLE children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  avatar_url TEXT,
  allergies TEXT[] NOT NULL DEFAULT '{}',
  medical_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_children_daycare ON children(daycare_id);
CREATE INDEX idx_children_classroom ON children(classroom_id);

-- Parent-Child relationships
CREATE TABLE parent_children (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  relationship relationship_type NOT NULL DEFAULT 'parent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parent_id, child_id)
);

CREATE INDEX idx_parent_children_parent ON parent_children(parent_id);
CREATE INDEX idx_parent_children_child ON parent_children(child_id);

-- Caregiver-Classroom assignments
CREATE TABLE caregiver_classrooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caregiver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  is_lead BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(caregiver_id, classroom_id)
);

CREATE INDEX idx_caregiver_classrooms_caregiver ON caregiver_classrooms(caregiver_id);
CREATE INDEX idx_caregiver_classrooms_classroom ON caregiver_classrooms(classroom_id);

-- ============================================================
-- FEATURE TABLES
-- ============================================================

-- Timeline entries (the core feed)
CREATE TABLE timeline_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  activity_type activity_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  mood mood_type,
  metadata JSONB NOT NULL DEFAULT '{}',
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timeline_child ON timeline_entries(child_id);
CREATE INDEX idx_timeline_daycare ON timeline_entries(daycare_id);
CREATE INDEX idx_timeline_created ON timeline_entries(created_at DESC);
CREATE INDEX idx_timeline_type ON timeline_entries(activity_type);

-- Comments on timeline entries
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timeline_entry_id UUID NOT NULL REFERENCES timeline_entries(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_entry ON comments(timeline_entry_id);

-- Reactions on timeline entries
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timeline_entry_id UUID NOT NULL REFERENCES timeline_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(timeline_entry_id, user_id, emoji)
);

CREATE INDEX idx_reactions_entry ON reactions(timeline_entry_id);

-- Conversations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  type conversation_type NOT NULL DEFAULT 'direct',
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_conversations_daycare ON conversations(daycare_id);

-- Conversation members
CREATE TABLE conversation_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  is_muted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_conv_members_user ON conversation_members(user_id);
CREATE INDEX idx_conv_members_conv ON conversation_members(conversation_id);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  attachments TEXT[] NOT NULL DEFAULT '{}',
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conv ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  daycare_id UUID REFERENCES daycares(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;

-- Attendance records
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  check_in_at TIMESTAMPTZ,
  check_in_by UUID REFERENCES profiles(id),
  check_out_at TIMESTAMPTZ,
  check_out_by UUID REFERENCES profiles(id),
  status attendance_status NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(child_id, date)
);

CREATE INDEX idx_attendance_child ON attendance(child_id);
CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_daycare ON attendance(daycare_id);

-- Incident reports
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type incident_type NOT NULL,
  severity severity_level NOT NULL DEFAULT 'minor',
  location TEXT,
  description TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  parent_notified_at TIMESTAMPTZ,
  witness_name TEXT,
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incidents_child ON incidents(child_id);
CREATE INDEX idx_incidents_daycare ON incidents(daycare_id);

-- Milestones
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  category milestone_category NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  age_range TEXT,
  achieved_at TIMESTAMPTZ,
  noted_by UUID REFERENCES profiles(id),
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_milestones_child ON milestones(child_id);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  amount_cents INTEGER NOT NULL,
  status invoice_status NOT NULL DEFAULT 'pending',
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  description TEXT NOT NULL,
  line_items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_parent ON invoices(parent_id);
CREATE INDEX idx_invoices_daycare ON invoices(daycare_id);
CREATE INDEX idx_invoices_status ON invoices(status);

-- Calendar events
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  type calendar_event_type NOT NULL DEFAULT 'event',
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  all_day BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calendar_daycare ON calendar_events(daycare_id);
CREATE INDEX idx_calendar_date ON calendar_events(start_at);

-- Learning plans
CREATE TABLE learning_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  classroom_id UUID NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE,
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  theme TEXT,
  activities JSONB NOT NULL DEFAULT '[]',
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_plans_classroom ON learning_plans(classroom_id);

-- ============================================================
-- SUBSCRIPTION & PAYMENT TABLES
-- ============================================================

-- Daycare subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE UNIQUE,
  stripe_subscription_id TEXT,
  plan_tier subscription_tier NOT NULL DEFAULT 'starter',
  status subscription_status NOT NULL DEFAULT 'trialing',
  current_period_end TIMESTAMPTZ,
  child_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Parent premium subscriptions
CREATE TABLE parent_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  parent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT,
  plan parent_plan NOT NULL DEFAULT 'free',
  status parent_sub_status NOT NULL DEFAULT 'active',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(parent_id, daycare_id)
);

-- Invite codes for onboarding
CREATE TABLE invite_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daycare_id UUID NOT NULL REFERENCES daycares(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  role invite_role NOT NULL,
  child_id UUID REFERENCES children(id) ON DELETE SET NULL,
  classroom_id UUID REFERENCES classrooms(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  used_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invite_codes_code ON invite_codes(code);
CREATE INDEX idx_invite_codes_daycare ON invite_codes(daycare_id);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get current user's daycare_id
CREATE OR REPLACE FUNCTION get_user_daycare_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT daycare_id FROM profiles WHERE id = auth.uid();
$$;

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_daycares_updated_at BEFORE UPDATE ON daycares FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_children_updated_at BEFORE UPDATE ON children FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_timeline_updated_at BEFORE UPDATE ON timeline_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_parent_subs_updated_at BEFORE UPDATE ON parent_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'parent')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update conversation updated_at when new message arrives
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_message_conv_update
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Update child count on subscription when children are added/removed
CREATE OR REPLACE FUNCTION update_subscription_child_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE subscriptions
  SET child_count = (SELECT COUNT(*) FROM children WHERE daycare_id = COALESCE(NEW.daycare_id, OLD.daycare_id))
  WHERE daycare_id = COALESCE(NEW.daycare_id, OLD.daycare_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_children_count_insert AFTER INSERT ON children FOR EACH ROW EXECUTE FUNCTION update_subscription_child_count();
CREATE TRIGGER tr_children_count_delete AFTER DELETE ON children FOR EACH ROW EXECUTE FUNCTION update_subscription_child_count();

-- Generate random invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code = UPPER(SUBSTRING(encode(gen_random_bytes(4), 'hex') FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_invite_code_generate
  BEFORE INSERT ON invite_codes
  FOR EACH ROW EXECUTE FUNCTION generate_invite_code();

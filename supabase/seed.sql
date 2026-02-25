-- ============================================================
-- LittleJourney Seed Data
-- Development/demo data for testing
-- ============================================================
-- NOTE: Run this AFTER creating test users in Supabase Auth.
-- The UUIDs below must match auth.users IDs.
-- For development, use Supabase Dashboard to create users first,
-- then update these UUIDs accordingly.
-- ============================================================

-- Demo daycare
INSERT INTO daycares (id, name, address, city, state, zip, phone, email, subscription_tier, trial_ends_at, max_children, max_classrooms) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'Sunshine Academy', '123 Learning Lane', 'Austin', 'TX', '78701', '(512) 555-0100', 'admin@sunshineacademy.com', 'professional', NOW() + INTERVAL '30 days', 50, 5);

-- Demo classrooms
INSERT INTO classrooms (id, daycare_id, name, age_group, capacity) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Butterflies', 'Toddlers (1-2)', 12),
  ('c0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'Ladybugs', 'Preschool (3-4)', 15),
  ('c0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'Caterpillars', 'Infants (0-1)', 8);

-- Demo children
INSERT INTO children (id, daycare_id, classroom_id, first_name, last_name, date_of_birth, allergies) VALUES
  ('a0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Layla', 'Ahmed', '2023-03-15', ARRAY['Peanuts']),
  ('a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Adam', 'Ahmed', '2021-11-20', '{}'),
  ('a0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Sophia', 'Johnson', '2023-06-10', '{}'),
  ('a0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Noah', 'Kim', '2023-01-05', '{}'),
  ('a0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Aria', 'Singh', '2022-05-17', ARRAY['Gluten']),
  ('a0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000002', 'Liam', 'Brown', '2022-07-30', '{}'),
  ('a0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Mia', 'Chen', '2023-04-12', '{}'),
  ('a0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Ethan', 'Davis', '2024-09-25', ARRAY['Eggs']);

-- Demo subscription
INSERT INTO subscriptions (daycare_id, plan_tier, status, current_period_end, child_count) VALUES
  ('d0000000-0000-0000-0000-000000000001', 'professional', 'trialing', NOW() + INTERVAL '30 days', 8);

-- NOTE: Profile records, parent_children links, and caregiver_classrooms
-- will be auto-created when you create auth users and run the onboarding flow.
-- For quick development, create these manually after setting up auth users:
--
-- INSERT INTO profiles (id, email, first_name, last_name, role, daycare_id) VALUES
--   ('<parent-auth-uid>', 'parent@demo.com', 'Noor', 'Ahmed', 'parent', 'd0000000-0000-0000-0000-000000000001'),
--   ('<caregiver-auth-uid>', 'caregiver@demo.com', 'Sarah', 'Johnson', 'caregiver', 'd0000000-0000-0000-0000-000000000001'),
--   ('<admin-auth-uid>', 'admin@demo.com', 'Director', 'Smith', 'admin', 'd0000000-0000-0000-0000-000000000001');
--
-- INSERT INTO parent_children (parent_id, child_id, relationship) VALUES
--   ('<parent-auth-uid>', 'a0000000-0000-0000-0000-000000000001', 'parent'),
--   ('<parent-auth-uid>', 'a0000000-0000-0000-0000-000000000002', 'parent');
--
-- INSERT INTO caregiver_classrooms (caregiver_id, classroom_id, is_lead) VALUES
--   ('<caregiver-auth-uid>', 'c0000000-0000-0000-0000-000000000001', TRUE);

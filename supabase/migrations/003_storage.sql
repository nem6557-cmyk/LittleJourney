-- ============================================================
-- LittleJourney Storage Buckets & Policies
-- Migration 003: File storage for photos, documents, avatars
-- ============================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', TRUE, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp']),
  ('timeline-photos', 'timeline-photos', FALSE, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']),
  ('documents', 'documents', FALSE, 20971520, ARRAY['application/pdf', 'image/jpeg', 'image/png']),
  ('daycare-assets', 'daycare-assets', TRUE, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']);

-- ============================================================
-- AVATARS (public bucket)
-- Path pattern: avatars/{user_id}/{filename}
-- ============================================================

-- Anyone can view avatars (public bucket)
CREATE POLICY "Public avatar access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

-- ============================================================
-- TIMELINE PHOTOS (private bucket)
-- Path pattern: timeline-photos/{daycare_id}/{child_id}/{filename}
-- ============================================================

-- Parents can view their children's photos
CREATE POLICY "Parents can view children photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'timeline-photos'
    AND EXISTS (
      SELECT 1 FROM parent_children pc
      JOIN children c ON c.id = pc.child_id
      WHERE pc.parent_id = auth.uid()
      AND c.daycare_id::TEXT = (storage.foldername(name))[1]
    )
  );

-- Staff can view all photos in their daycare
CREATE POLICY "Staff can view daycare photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'timeline-photos'
    AND (storage.foldername(name))[1] = (SELECT daycare_id::TEXT FROM profiles WHERE id = auth.uid())
  );

-- Staff can upload photos to their daycare
CREATE POLICY "Staff can upload daycare photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'timeline-photos'
    AND (storage.foldername(name))[1] = (SELECT daycare_id::TEXT FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('caregiver', 'admin')
  );

-- Staff can delete photos in their daycare
CREATE POLICY "Staff can delete daycare photos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'timeline-photos'
    AND (storage.foldername(name))[1] = (SELECT daycare_id::TEXT FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('caregiver', 'admin')
  );

-- ============================================================
-- DOCUMENTS (private bucket)
-- Path pattern: documents/{daycare_id}/{type}/{filename}
-- ============================================================

-- Staff can manage documents in their daycare
CREATE POLICY "Staff can manage daycare documents"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = (SELECT daycare_id::TEXT FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('caregiver', 'admin')
  );

-- Parents can view documents related to their children
CREATE POLICY "Parents can view daycare documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM parent_children pc
      JOIN children c ON c.id = pc.child_id
      WHERE pc.parent_id = auth.uid()
      AND c.daycare_id::TEXT = (storage.foldername(name))[1]
    )
  );

-- ============================================================
-- DAYCARE ASSETS (public bucket)
-- Path pattern: daycare-assets/{daycare_id}/{filename}
-- ============================================================

-- Anyone can view daycare assets (public)
CREATE POLICY "Public daycare asset access"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'daycare-assets');

-- Admins can manage their daycare's assets
CREATE POLICY "Admins can manage daycare assets"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'daycare-assets'
    AND (storage.foldername(name))[1] = (SELECT daycare_id::TEXT FROM profiles WHERE id = auth.uid())
    AND (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

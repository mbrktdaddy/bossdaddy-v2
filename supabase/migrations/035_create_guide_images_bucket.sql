-- Migration 035: Create guide-images storage bucket
-- Mirrors the article-images bucket settings.
-- Run BEFORE the copy script and BEFORE migration 036.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'guide-images',
  'guide-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop first so this migration is safe to re-run
DROP POLICY IF EXISTS "guide-images public read" ON storage.objects;
DROP POLICY IF EXISTS "guide-images authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "guide-images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "guide-images authenticated delete" ON storage.objects;

CREATE POLICY "guide-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'guide-images');

CREATE POLICY "guide-images authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'guide-images' AND auth.role() = 'authenticated');

CREATE POLICY "guide-images authenticated update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'guide-images' AND auth.role() = 'authenticated');

CREATE POLICY "guide-images authenticated delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'guide-images' AND auth.role() = 'authenticated');

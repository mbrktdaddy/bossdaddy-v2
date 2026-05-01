-- Migration 037: Add RLS policies to media and review-images buckets
-- These buckets exist but have no policies, which can cause upload failures
-- even when using the service-role admin client.

-- ── media bucket ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "media public read" ON storage.objects;
DROP POLICY IF EXISTS "media authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "media authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "media authenticated delete" ON storage.objects;

CREATE POLICY "media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

CREATE POLICY "media authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "media authenticated update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media' AND auth.role() = 'authenticated');

CREATE POLICY "media authenticated delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media' AND auth.role() = 'authenticated');

-- ── review-images bucket ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "review-images public read" ON storage.objects;
DROP POLICY IF EXISTS "review-images authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "review-images authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "review-images authenticated delete" ON storage.objects;

CREATE POLICY "review-images public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-images');

CREATE POLICY "review-images authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'review-images' AND auth.role() = 'authenticated');

CREATE POLICY "review-images authenticated update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'review-images' AND auth.role() = 'authenticated');

CREATE POLICY "review-images authenticated delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'review-images' AND auth.role() = 'authenticated');

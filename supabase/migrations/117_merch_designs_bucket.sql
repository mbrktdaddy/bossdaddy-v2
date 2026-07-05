-- Migration 117: Create merch-designs storage bucket
--
-- Holds Merch Studio print-ready PNGs. Must be PUBLIC read: Printful's
-- POST /files fetches the file by URL server-side, so it has to be reachable
-- without auth (unlike the admin-gated /api/merch/render preview endpoint).
-- Writes happen via the service-role admin client (bypasses RLS); the
-- authenticated write policies below mirror the guide-images bucket posture.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merch-designs',
  'merch-designs',
  true,
  10485760,
  ARRAY['image/png']
)
ON CONFLICT (id) DO NOTHING;

-- Drop first so this migration is safe to re-run
DROP POLICY IF EXISTS "merch-designs public read" ON storage.objects;
DROP POLICY IF EXISTS "merch-designs authenticated upload" ON storage.objects;
DROP POLICY IF EXISTS "merch-designs authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "merch-designs authenticated delete" ON storage.objects;

CREATE POLICY "merch-designs public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'merch-designs');

CREATE POLICY "merch-designs authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'merch-designs' AND auth.role() = 'authenticated');

CREATE POLICY "merch-designs authenticated update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'merch-designs' AND auth.role() = 'authenticated');

CREATE POLICY "merch-designs authenticated delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'merch-designs' AND auth.role() = 'authenticated');

-- Migration 119: allow JPEG (and WebP) in the merch-designs bucket
--
-- Print files are PNG (transparent), but generated product MOCKUPS are photos
-- and come back from Printful as JPEG. The bucket was created (mig 117) with
-- allowed_mime_types = {image/png} only, so mockup uploads failed with
-- "mime type image/jpeg is not supported". Broaden to cover both (+ webp).

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']
WHERE id = 'merch-designs';

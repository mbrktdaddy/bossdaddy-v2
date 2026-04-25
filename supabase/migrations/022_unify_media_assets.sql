-- Migration 022: Unify product_images into media_assets
-- Adds product context columns to media_assets and migrates existing rows.

ALTER TABLE media_assets
  ADD COLUMN IF NOT EXISTS product_id UUID NULL REFERENCES products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label TEXT NULL,
  ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS position INTEGER NULL;

-- Ensure is_primary can only be true when a product is assigned
ALTER TABLE media_assets
  ADD CONSTRAINT media_primary_requires_product
    CHECK (NOT is_primary OR product_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS media_assets_product_id_idx ON media_assets(product_id);

-- Migrate existing product_images rows into media_assets
INSERT INTO media_assets (url, bucket, filename, alt_text, product_id, label, is_primary, position, uploaded_by, file_size, mime_type, created_at)
SELECT
  pi.url,
  'media'                                              AS bucket,
  -- Extract filename from URL path (last path segment)
  regexp_replace(pi.url, '^.+/', '')                  AS filename,
  pi.alt_text,
  pi.product_id,
  pi.label,
  pi.is_primary,
  pi.position,
  (SELECT id FROM profiles WHERE role = 'admin' ORDER BY created_at LIMIT 1) AS uploaded_by,
  0                                                   AS file_size,
  'image/jpeg'                                        AS mime_type,
  pi.created_at
FROM product_images pi
ON CONFLICT DO NOTHING;

DROP TABLE IF EXISTS product_images;

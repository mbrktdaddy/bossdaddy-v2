-- Migration 036: Update guides.image_url to point at guide-images bucket
-- Run AFTER migration 035 AND AFTER running scripts/migrate-article-images.mjs
-- (files must exist in guide-images before this migration is applied).

UPDATE guides
SET image_url = REPLACE(
  image_url,
  '/storage/v1/object/public/article-images/',
  '/storage/v1/object/public/guide-images/'
)
WHERE image_url LIKE '%/storage/v1/object/public/article-images/%';

-- Report how many rows were updated (useful for verification)
DO $$
DECLARE updated_count INT;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % guide image_url rows', updated_count;
END $$;

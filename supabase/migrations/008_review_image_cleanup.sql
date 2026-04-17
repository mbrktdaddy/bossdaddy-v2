-- Add image support to reviews
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Remove unused Sanity sync column
ALTER TABLE reviews
  DROP COLUMN IF EXISTS sanity_id;

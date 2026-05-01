-- Migration 040: Category taxonomy overhaul
-- Converts review_category enum → TEXT+CHECK, migrates slugs to new set,
-- drops 'other', syncs media_assets constraint.

BEGIN;

-- Step 1: Convert enum columns to TEXT (required before DROP TYPE)
ALTER TABLE reviews ALTER COLUMN category TYPE TEXT;
ALTER TABLE guides  ALTER COLUMN category TYPE TEXT;

-- Step 2: Drop the old enum type
DROP TYPE IF EXISTS review_category;

-- Step 3: Migrate old slugs to new taxonomy
UPDATE reviews SET category = 'grilling-cooking'   WHERE category = 'bbq-grilling';
UPDATE reviews SET category = 'tools-diy'          WHERE category = 'diy-tools';
UPDATE reviews SET category = 'health-wellness'    WHERE category = 'health-fitness';
UPDATE reviews SET category = 'home-lifestyle'     WHERE category IN ('dad-life', 'family-lifestyle', 'other');

UPDATE guides  SET category = 'grilling-cooking'   WHERE category = 'bbq-grilling';
UPDATE guides  SET category = 'tools-diy'          WHERE category = 'diy-tools';
UPDATE guides  SET category = 'health-wellness'    WHERE category = 'health-fitness';
UPDATE guides  SET category = 'home-lifestyle'     WHERE category IN ('dad-life', 'family-lifestyle', 'other');

-- Step 4: Enforce the new category set via CHECK
ALTER TABLE reviews
  ADD CONSTRAINT reviews_category_check CHECK (
    category IN (
      'kids-family', 'tools-diy', 'grilling-cooking', 'outdoors-adventure',
      'tech-edc', 'vehicles-garage', 'health-wellness', 'home-lifestyle'
    )
  );

ALTER TABLE guides
  ADD CONSTRAINT guides_category_check CHECK (
    category IN (
      'kids-family', 'tools-diy', 'grilling-cooking', 'outdoors-adventure',
      'tech-edc', 'vehicles-garage', 'health-wellness', 'home-lifestyle'
    )
  );

-- Step 5: Drop the old DEFAULT 'other' (default was tied to enum)
ALTER TABLE reviews ALTER COLUMN category DROP DEFAULT;
ALTER TABLE guides  ALTER COLUMN category DROP DEFAULT;

-- Step 6: Sync media_assets CHECK constraint
ALTER TABLE media_assets DROP CONSTRAINT IF EXISTS media_assets_category_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_category_check
  CHECK (category IS NULL OR category IN (
    'kids-family', 'tools-diy', 'grilling-cooking', 'outdoors-adventure',
    'tech-edc', 'vehicles-garage', 'health-wellness', 'home-lifestyle'
  ));

-- Step 7: Recreate performance indexes (underlying column type changed)
DROP INDEX IF EXISTS idx_reviews_status_visible_category_published;
CREATE INDEX idx_reviews_status_visible_category_published
  ON reviews (status, is_visible, category, published_at DESC);

DROP INDEX IF EXISTS idx_guides_status_visible_category_published;
CREATE INDEX idx_guides_status_visible_category_published
  ON guides (status, is_visible, category, published_at DESC);

COMMIT;

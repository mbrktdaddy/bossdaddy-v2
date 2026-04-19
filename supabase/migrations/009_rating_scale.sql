-- Migrate ratings from 1-5 (SMALLINT) to 1.0-10.0 (NUMERIC)
-- Existing values are multiplied by 2 to preserve relative position (5→10, 4→8, 3→6, etc.)

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_rating_check;

ALTER TABLE reviews
  ALTER COLUMN rating TYPE NUMERIC(3,1) USING (rating * 2)::NUMERIC(3,1);

ALTER TABLE reviews
  ADD CONSTRAINT reviews_rating_check CHECK (rating BETWEEN 1.0 AND 10.0);

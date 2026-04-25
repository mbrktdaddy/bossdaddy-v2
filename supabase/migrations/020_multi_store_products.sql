-- Rename amazon_url → affiliate_url and add store/custom_store_name columns.
-- All existing rows are backfilled to store='amazon' via the column DEFAULT.

ALTER TABLE products RENAME COLUMN amazon_url TO affiliate_url;
ALTER TABLE products ADD COLUMN store TEXT NOT NULL DEFAULT 'amazon';
ALTER TABLE products ADD COLUMN custom_store_name TEXT;

-- Migration 033: Rename shop_products table to merch
-- Apply via: supabase db push  OR paste into Supabase SQL editor
-- DO NOT push automatically — applied manually by operator.
-- All blocks are idempotent — safe to re-run if a partial application
-- failed mid-way.

-- 1. Rename the table itself (idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'shop_products') THEN
    ALTER TABLE shop_products RENAME TO merch;
  END IF;
END $$;

-- 2. Rename the primary key constraint (if it exists with the default name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shop_products_pkey' AND conrelid = 'merch'::regclass
  ) THEN
    ALTER TABLE merch RENAME CONSTRAINT shop_products_pkey TO merch_pkey;
  END IF;
END $$;

-- 3. Rename indexes
DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'merch' AND indexname LIKE 'shop\_products\_%' ESCAPE '\'
  LOOP
    EXECUTE format(
      'ALTER INDEX %I RENAME TO %I',
      idx.indexname,
      replace(idx.indexname, 'shop_products_', 'merch_')
    );
  END LOOP;
END $$;

-- 4. Rename sequences (if id uses a sequence named shop_products_id_seq)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'shop_products_id_seq') THEN
    ALTER SEQUENCE shop_products_id_seq RENAME TO merch_id_seq;
  END IF;
END $$;

-- 5. Rename RLS policies that contain "shop_products" or "shop products" in their name
-- (handles both underscored and space-separated phrasing)
-- NOTE: underscore is a LIKE wildcard — must escape with `ESCAPE '\'`
DO $$
DECLARE
  pol RECORD;
  new_name TEXT;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'merch'
  LOOP
    -- Replace both forms; if neither applies the result equals the original
    new_name := replace(replace(pol.policyname, 'shop_products', 'merch'), 'shop products', 'merch');
    IF new_name <> pol.policyname THEN
      -- Skip if the target name already exists (idempotent re-run safety)
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'merch' AND policyname = new_name
      ) THEN
        EXECUTE format(
          'ALTER POLICY %I ON merch RENAME TO %I',
          pol.policyname,
          new_name
        );
      END IF;
    END IF;
  END LOOP;
END $$;

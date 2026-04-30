-- Migration 032: Rename articles table to guides
-- Apply via: supabase db push  OR paste into Supabase SQL editor
-- DO NOT push automatically — applied manually by operator.

-- 1. Rename the table itself
ALTER TABLE articles RENAME TO guides;

-- 2. Rename the primary key constraint (if it exists with the default name)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'articles_pkey' AND conrelid = 'guides'::regclass
  ) THEN
    ALTER TABLE guides RENAME CONSTRAINT articles_pkey TO guides_pkey;
  END IF;
END $$;

-- 3. Rename indexes
DO $$
DECLARE
  idx RECORD;
BEGIN
  FOR idx IN
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'guides' AND indexname LIKE 'articles_%'
  LOOP
    EXECUTE format(
      'ALTER INDEX %I RENAME TO %I',
      idx.indexname,
      replace(idx.indexname, 'articles_', 'guides_')
    );
  END LOOP;
END $$;

-- 4. Rename sequences (if id uses a sequence named articles_id_seq)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'articles_id_seq') THEN
    ALTER SEQUENCE articles_id_seq RENAME TO guides_id_seq;
  END IF;
END $$;

-- 5. Rename RLS policies that contain "article" in their name
DO $$
DECLARE
  pol RECORD;
  new_name TEXT;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'guides'
  LOOP
    IF pol.policyname ILIKE '%article%' THEN
      new_name := replace(replace(pol.policyname, 'article', 'guide'), 'Article', 'Guide');
      EXECUTE format(
        'ALTER POLICY %I ON guides RENAME TO %I',
        pol.policyname,
        new_name
      );
    END IF;
  END LOOP;
END $$;

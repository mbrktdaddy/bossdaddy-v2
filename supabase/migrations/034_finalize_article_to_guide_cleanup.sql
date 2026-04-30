-- Migration 034: Finalize article → guide internal terminology cleanup
-- Apply via: supabase db push  OR paste into Supabase SQL editor
-- DO NOT push automatically — applied manually by operator.
-- All blocks are idempotent — safe to re-run if a partial application failed.

-- ─────────────────────────────────────────────────────────────────────
-- 1. Drop existing CHECK constraints first
--    (the old constraints only allow 'article'/'review' — would reject
--    UPDATE'ing rows to 'guide' before the constraint is recreated)
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE comments         DROP CONSTRAINT IF EXISTS comments_content_type_check;
ALTER TABLE likes            DROP CONSTRAINT IF EXISTS likes_content_type_check;
ALTER TABLE content_revisions DROP CONSTRAINT IF EXISTS content_revisions_content_type_check;

-- ─────────────────────────────────────────────────────────────────────
-- 2. Migrate stored content_type values: 'article' → 'guide'
-- ─────────────────────────────────────────────────────────────────────
UPDATE comments         SET content_type = 'guide' WHERE content_type = 'article';
UPDATE likes            SET content_type = 'guide' WHERE content_type = 'article';
UPDATE content_revisions SET content_type = 'guide' WHERE content_type = 'article';

-- ─────────────────────────────────────────────────────────────────────
-- 3. Recreate CHECK constraints with the new allowed values
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE comments
  ADD CONSTRAINT comments_content_type_check
  CHECK (content_type IN ('review', 'guide'));

ALTER TABLE likes
  ADD CONSTRAINT likes_content_type_check
  CHECK (content_type IN ('review', 'guide', 'comment'));

ALTER TABLE content_revisions
  ADD CONSTRAINT content_revisions_content_type_check
  CHECK (content_type IN ('review', 'guide'));

-- ─────────────────────────────────────────────────────────────────────
-- 3. Rename RPC: increment_article_views → increment_guide_views
--    Also updates the function body to reference the renamed `guides` table.
-- ─────────────────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS increment_article_views(UUID);

CREATE OR REPLACE FUNCTION increment_guide_views(row_id UUID)
RETURNS void AS $$
  UPDATE guides SET view_count = view_count + 1 WHERE id = row_id;
$$ LANGUAGE sql SECURITY DEFINER;

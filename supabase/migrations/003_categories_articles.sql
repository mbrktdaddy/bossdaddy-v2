-- Migration 003 — Categories, pros/cons, articles, newsletter subscribers

-- ── Category enum ─────────────────────────────────────────────────────────────
CREATE TYPE review_category AS ENUM (
  'bbq-grilling',
  'diy-tools',
  'kids-family',
  'health-fitness',
  'other'
);

-- ── Add fields to reviews ──────────────────────────────────────────────────────
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS category review_category NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS pros JSONB DEFAULT '[]'::jsonb,   -- string[]
  ADD COLUMN IF NOT EXISTS cons JSONB DEFAULT '[]'::jsonb,   -- string[]
  ADD COLUMN IF NOT EXISTS excerpt TEXT,                      -- short summary for cards
  ADD COLUMN IF NOT EXISTS image_url TEXT;                    -- hero image

-- ── Articles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID REFERENCES profiles ON DELETE CASCADE NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  excerpt     TEXT,
  category    review_category NOT NULL DEFAULT 'other',
  image_url   TEXT,
  status      TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  published_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "articles_author_own" ON articles FOR ALL USING (author_id = auth.uid());
CREATE POLICY "articles_admin_all" ON articles FOR ALL USING (is_admin());
CREATE POLICY "articles_public_approved" ON articles FOR SELECT USING (status = 'approved');

CREATE OR REPLACE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── Newsletter subscribers ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT UNIQUE NOT NULL,
  confirmed  BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
-- Only service role can read subscribers (no public read)
CREATE POLICY "newsletter_insert_public" ON newsletter_subscribers FOR INSERT WITH CHECK (true);

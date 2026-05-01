-- Migration 041: Tag system — controlled vocabulary with 6 groups

BEGIN;

CREATE TABLE IF NOT EXISTS tags (
  slug          TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  tag_group     TEXT NOT NULL CHECK (tag_group IN (
    'life-stage', 'price', 'use-case', 'test-depth', 'editorial', 'topic'
  )),
  display_order INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_tags (
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  tag_slug  TEXT REFERENCES tags(slug)  ON DELETE CASCADE,
  PRIMARY KEY (review_id, tag_slug)
);

CREATE TABLE IF NOT EXISTS guide_tags (
  guide_id UUID REFERENCES guides(id)  ON DELETE CASCADE,
  tag_slug TEXT REFERENCES tags(slug)  ON DELETE CASCADE,
  PRIMARY KEY (guide_id, tag_slug)
);

CREATE INDEX IF NOT EXISTS idx_review_tags_tag ON review_tags(tag_slug);
CREATE INDEX IF NOT EXISTS idx_guide_tags_tag  ON guide_tags(tag_slug);

ALTER TABLE tags        ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE guide_tags  ENABLE ROW LEVEL SECURITY;

-- tags: public read, admin write
CREATE POLICY "tags_public_read"  ON tags FOR SELECT USING (true);
CREATE POLICY "tags_admin_write"  ON tags FOR ALL    USING (is_admin());

-- review_tags: authors manage own, admins all, public reads approved
CREATE POLICY "review_tags_author" ON review_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM reviews WHERE id = review_id AND author_id = auth.uid()));
CREATE POLICY "review_tags_admin"  ON review_tags FOR ALL USING (is_admin());
CREATE POLICY "review_tags_public" ON review_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM reviews WHERE id = review_id AND status = 'approved' AND is_visible = true));

CREATE POLICY "guide_tags_author"  ON guide_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM guides WHERE id = guide_id AND author_id = auth.uid()));
CREATE POLICY "guide_tags_admin"   ON guide_tags FOR ALL USING (is_admin());
CREATE POLICY "guide_tags_public"  ON guide_tags FOR SELECT
  USING (EXISTS (SELECT 1 FROM guides WHERE id = guide_id AND status = 'approved' AND is_visible = true));

-- Seed controlled vocabulary
INSERT INTO tags (slug, label, tag_group, display_order) VALUES
  -- Life stage
  ('pregnancy',         'Pregnancy',          'life-stage',  1),
  ('newborn',           'Newborn',             'life-stage',  2),
  ('infant',            'Infant',              'life-stage',  3),
  ('toddler',           'Toddler',             'life-stage',  4),
  ('preschool',         'Preschool',           'life-stage',  5),
  ('school-age',        'School-age',          'life-stage',  6),
  ('teen',              'Teen',                'life-stage',  7),
  -- Price
  ('under-25',          'Under $25',           'price',       1),
  ('under-50',          'Under $50',           'price',       2),
  ('under-100',         'Under $100',          'price',       3),
  ('under-250',         'Under $250',          'price',       4),
  ('premium',           'Premium',             'price',       5),
  -- Use case
  ('travel',            'Travel',              'use-case',    1),
  ('daily',             'Daily Use',           'use-case',    2),
  ('occasional',        'Occasional',          'use-case',    3),
  ('gift-idea',         'Gift Idea',           'use-case',    4),
  ('gear-haul',         'Gear Haul',           'use-case',    5),
  -- Test depth
  ('tested-week',       'Tested 1 Week',       'test-depth',  1),
  ('tested-month',      'Tested 1 Month',      'test-depth',  2),
  ('tested-6mo',        'Tested 6+ Months',    'test-depth',  3),
  ('tested-year',       'Tested 1+ Year',      'test-depth',  4),
  -- Editorial
  ('top-pick',          'Top Pick',            'editorial',   1),
  ('best-value',        'Best Value',          'editorial',   2),
  ('splurge',           'Splurge',             'editorial',   3),
  ('hidden-gem',        'Hidden Gem',          'editorial',   4),
  ('boss-approved',     'Boss Approved',       'editorial',   5),
  -- Topic (cross-cutting)
  ('home-improvement',  'Home Improvement',    'topic',       1),
  ('workshop',          'Workshop',            'topic',       2),
  ('automotive',        'Automotive',          'topic',       3),
  ('yard-work',         'Yard Work',           'topic',       4),
  ('kitchen-tools',     'Kitchen Tools',       'topic',       5),
  ('outdoor-cooking',   'Outdoor Cooking',     'topic',       6),
  ('mental-health',     'Mental Health',       'topic',       7),
  ('mindfulness',       'Mindfulness',         'topic',       8),
  ('self-help',         'Self-Help',           'topic',       9),
  ('faith',             'Faith',               'topic',      10);

COMMIT;

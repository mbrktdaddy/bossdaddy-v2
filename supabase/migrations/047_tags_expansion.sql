-- Tags expansion: drop test-depth group, add negative editorial tags,
-- expand topic tags to cover all 8 site categories.
-- test-depth is redundant with reviews.testing_duration (added in 046).
-- review_tags/guide_tags entries for test-depth slugs cascade-delete via FK.

BEGIN;

-- ── 1. Remove test-depth tags (cascade deletes review_tags/guide_tags rows) ──
DELETE FROM tags WHERE tag_group = 'test-depth';

-- ── 2. Drop + recreate check constraint without 'test-depth' ─────────────────
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_tag_group_check;
ALTER TABLE tags ADD CONSTRAINT tags_tag_group_check
  CHECK (tag_group IN ('life-stage', 'price', 'use-case', 'editorial', 'topic'));

-- ── 3. New negative editorial tags ──────────────────────────────────────────
INSERT INTO tags (slug, label, tag_group, display_order) VALUES
  ('mixed-verdict',   'Mixed Verdict',        'editorial', 6),
  ('buyer-beware',    'Buyer Beware',         'editorial', 7),
  ('better-options',  'Better Options Exist', 'editorial', 8),
  ('overhyped',       'Overhyped',            'editorial', 9);

-- ── 4. New topic tags by site category ──────────────────────────────────────
INSERT INTO tags (slug, label, tag_group, display_order) VALUES
  -- Baby & Family
  ('formula-feeding', 'Formula & Feeding',    'topic', 11),
  ('baby-sleep',      'Baby Sleep',           'topic', 12),
  ('strollers',       'Strollers',            'topic', 13),
  ('car-seats',       'Car Seats',            'topic', 14),
  ('baby-carriers',   'Baby Carriers',        'topic', 15),
  ('diapering',       'Diapering',            'topic', 16),
  ('nursery-gear',    'Nursery Gear',         'topic', 17),
  -- Tools & DIY
  ('power-tools',     'Power Tools',          'topic', 18),
  ('hand-tools',      'Hand Tools',           'topic', 19),
  ('storage-org',     'Storage & Organization','topic', 20),
  -- Outdoors & Adventure
  ('camping',         'Camping',              'topic', 21),
  ('hiking',          'Hiking',               'topic', 22),
  ('fishing',         'Fishing',              'topic', 23),
  ('hunting',         'Hunting',              'topic', 24),
  ('water-sports',    'Water Sports',         'topic', 25),
  -- Tech & EDC
  ('smart-home',      'Smart Home',           'topic', 26),
  ('wearables',       'Wearables',            'topic', 27),
  ('audio-gear',      'Audio Gear',           'topic', 28),
  ('edc-carry',       'EDC / Everyday Carry', 'topic', 29),
  -- Vehicles & Garage
  ('truck-gear',      'Truck Gear',           'topic', 30),
  ('detailing',       'Detailing',            'topic', 31),
  -- Grilling & Cooking
  ('cast-iron',       'Cast Iron',            'topic', 32),
  ('meal-prep',       'Meal Prep',            'topic', 33),
  -- Health & Fitness
  ('fitness',         'Fitness',              'topic', 34),
  ('home-gym',        'Home Gym',             'topic', 35),
  -- Home & Lifestyle
  ('cleaning',        'Cleaning',             'topic', 36),
  ('organization',    'Organization',         'topic', 37);

COMMIT;

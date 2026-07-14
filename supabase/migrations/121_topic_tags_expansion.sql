-- Migration 121: Deliberate topic-tag expansion.
-- Fills common dad-gear gaps identified during the pillar-taxonomy pass.
-- `yard-work` already exists (041) and remains the lawn/crabgrass tag — NOT re-added here.
-- Governance (see docs/pillar-taxonomy.md §6): every tag is a promise to fill (≥3 pieces).
-- Prune any that stay empty. ON CONFLICT keeps this re-runnable and collision-safe.

BEGIN;

INSERT INTO tags (slug, label, tag_group, display_order) VALUES
  ('watering',       'Watering & Irrigation', 'topic', 38),  -- hoses, nozzles, sprinklers (Home)
  ('grooming',       'Grooming',              'topic', 39),  -- beard, shaving, hair
  ('coffee',         'Coffee',                'topic', 40),  -- grinders, makers, brew gear
  ('pet-gear',       'Pet Gear',              'topic', 41),  -- dog/pet supplies
  ('backup-power',   'Backup Power',          'topic', 42),  -- generators, power stations (cross-cut)
  ('apparel',        'Apparel & Footwear',    'topic', 43),  -- boots, workwear, jackets
  ('safety-first-aid','Safety & First Aid',   'topic', 44)   -- kits, detectors, emergency prep
ON CONFLICT (slug) DO NOTHING;

COMMIT;

-- Migration 127: Pillar-taxonomy hierarchy.
-- Turns the flat `tags` controlled vocabulary into a 3-tier subject tree
-- (pillar -> subject group -> leaf), adds the `audience` facet group, and makes
-- merch taggable via merch_tags (mirrors product_tags, mig 122).
-- NOTE: the merch catalog table is `merch` (renamed from shop_products in mig 033).
-- Authority: docs/pillar-taxonomy.md. Pillars live in lib/categories.ts.
--
-- Model:
--   tag_group = 'topic' (SUBJECT):
--     parent_slug NULL   -> Tier-2 subject group; category_slug = its pillar slug
--     parent_slug set    -> Tier-3 leaf, nested under the group
--     category_slug NULL -> cross-cutting subject (faith, storage-org, smart-home, ...)
--   tag_group <> 'topic' -> FACET (life-stage, price, use-case, editorial, audience)
--
-- category_slug is a plain TEXT pointer to a code-defined pillar (lib/categories.ts) --
-- deliberately NOT a FK/CHECK (Naming Doctrine: pillars are owned by code, not the DB).
-- Every tag here is a promise to fill (>=3 pieces) -- planned content is committed.

begin;

-- ── 1. Hierarchy columns ─────────────────────────────────────────────────────
alter table tags add column if not exists parent_slug   text references tags(slug) on delete set null;
alter table tags add column if not exists category_slug text;

create index if not exists idx_tags_parent   on tags(parent_slug);
create index if not exists idx_tags_category on tags(category_slug);

-- ── 2. New `audience` facet group ────────────────────────────────────────────
alter table tags drop constraint if exists tags_tag_group_check;
alter table tags add constraint tags_tag_group_check
  check (tag_group in ('life-stage','price','use-case','editorial','topic','audience'));

-- ── 3. Merch taggable (mirror product_tags / mig 122; public read, admin write) ─
-- Merch catalog table is `merch` (renamed from shop_products in mig 033).
create table if not exists merch_tags (
  merch_id uuid references merch(id)      on delete cascade,
  tag_slug text references tags(slug)     on delete cascade,
  primary key (merch_id, tag_slug)
);
create index if not exists idx_merch_tags_tag on merch_tags(tag_slug);

alter table merch_tags enable row level security;

create policy "merch_tags_public_read"
  on merch_tags for select
  to anon, authenticated
  using (true);

create policy "merch_tags_admin_write"
  on merch_tags for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ── 4. New Tier-2 subject groups + pillar themes (parents first) ─────────────
insert into tags (slug, label, tag_group, display_order, category_slug) values
  -- Kids & Family
  ('baby-gear',           'Baby Gear',           'topic', 45, 'kids-family'),
  ('feeding',             'Feeding',             'topic', 46, 'kids-family'),
  ('toddler-gear',        'Toddler Gear',        'topic', 47, 'kids-family'),
  ('kids-furniture',      'Kids Furniture',      'topic', 48, 'kids-family'),
  ('kids-outdoor-gear',   'Kids Outdoor Gear',   'topic', 49, 'kids-family'),
  ('kids-activities',     'Activities',          'topic', 50, 'kids-family'),
  ('kids-learning',       'Learning',            'topic', 51, 'kids-family'),
  -- Grilling & Cooking
  ('grills-smokers',      'Grills & Smokers',    'topic', 52, 'grilling-cooking'),
  ('recipes',             'Recipes',             'topic', 53, 'grilling-cooking'),
  -- Outdoors & Adventure
  ('outdoor-apparel',     'Outdoor Apparel',     'topic', 54, 'outdoors-adventure'),
  -- Tech & Gadgets
  ('charging-power',      'Charging & Power',    'topic', 55, 'tech-edc'),
  -- Vehicles & Garage
  ('garage-setup',        'Garage Setup',        'topic', 56, 'vehicles-garage'),
  -- Health & Wellness
  ('supplements',         'Supplements',         'topic', 57, 'health-wellness'),
  ('anti-aging',          'Anti-Aging',          'topic', 58, 'health-wellness'),
  -- Home & Lifestyle
  ('furniture',           'Furniture',           'topic', 59, 'home-lifestyle'),
  ('appliances',          'Appliances',          'topic', 60, 'home-lifestyle'),
  ('yard-garden',         'Yard & Garden',       'topic', 61, 'home-lifestyle'),
  -- Table Duty (timeless discussion)
  ('meaning-purpose',     'Meaning & Purpose',   'topic', 70, 'table-duty'),
  ('culture-media',       'Culture & Media',     'topic', 71, 'table-duty'),
  ('citizenship-duty',    'Citizenship & Duty',  'topic', 72, 'table-duty'),
  ('tough-talks',         'Tough Talks',         'topic', 73, 'table-duty'),
  -- Watch Duty (timely current events)
  ('family-impact',       'Family Impact',       'topic', 80, 'watch-duty'),
  ('cultural-shifts',     'Cultural Shifts',     'topic', 81, 'watch-duty'),
  ('policy-power',        'Policy & Power',      'topic', 82, 'watch-duty'),
  ('technology-screens',  'Technology & Screens','topic', 83, 'watch-duty'),
  ('safety-security',     'Safety & Security',   'topic', 84, 'watch-duty'),
  ('generational-stakes', 'Generational Stakes', 'topic', 85, 'watch-duty')
on conflict (slug) do nothing;

-- New `audience` facet
insert into tags (slug, label, tag_group, display_order) values
  ('first-time-dad', 'First-Time Dads', 'audience', 1)
on conflict (slug) do nothing;

-- ── 5. New Tier-3 leaves (parents now exist) ─────────────────────────────────
insert into tags (slug, label, tag_group, display_order, category_slug, parent_slug) values
  ('breastfeeding', 'Breastfeeding', 'topic', 62, 'kids-family',      'feeding'),
  ('cutlery',       'Cutlery',       'topic', 63, 'grilling-cooking', 'kitchen-tools'),
  ('utensils',      'Utensils',      'topic', 64, 'grilling-cooking', 'kitchen-tools')
on conflict (slug) do nothing;

-- ── 6. Slot EXISTING tags into the hierarchy ─────────────────────────────────
-- Tier-2 subject groups (parent_slug stays NULL).
update tags set category_slug = 'kids-family'        where slug in ('baby-sleep');
update tags set category_slug = 'tools-diy'          where slug in ('home-improvement','workshop','power-tools','hand-tools');
update tags set category_slug = 'grilling-cooking'   where slug in ('kitchen-tools','outdoor-cooking','meal-prep','coffee');
update tags set category_slug = 'outdoors-adventure' where slug in ('camping','hiking','fishing','hunting','water-sports');
update tags set category_slug = 'tech-edc'           where slug in ('wearables','audio-gear','edc-carry');
update tags set category_slug = 'vehicles-garage'    where slug in ('automotive','truck-gear','detailing');
update tags set category_slug = 'health-wellness'    where slug in ('mental-health','fitness','grooming');
update tags set category_slug = 'home-lifestyle'     where slug in ('cleaning','organization','apparel','pet-gear');

-- Tier-3 leaves (set both pillar + parent).
update tags set category_slug = 'kids-family',      parent_slug = 'baby-gear'
  where slug in ('strollers','car-seats','baby-carriers','diapering','nursery-gear');
update tags set category_slug = 'kids-family',      parent_slug = 'feeding'       where slug = 'formula-feeding';
update tags set category_slug = 'health-wellness',  parent_slug = 'mental-health' where slug in ('mindfulness','self-help');
update tags set category_slug = 'health-wellness',  parent_slug = 'fitness'       where slug = 'home-gym';
update tags set category_slug = 'grilling-cooking', parent_slug = 'kitchen-tools' where slug = 'cast-iron';
update tags set category_slug = 'home-lifestyle',   parent_slug = 'yard-garden'   where slug in ('yard-work','watering');

-- Cross-cutting subjects (category_slug INTENTIONALLY left NULL):
--   faith, storage-org, smart-home, backup-power, safety-first-aid.
-- faith also anchors Table Duty -- relabel to the locked theme name.
update tags set label = 'Faith & Doubt' where slug = 'faith';

commit;

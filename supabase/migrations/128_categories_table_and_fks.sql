-- Migration 128: Category taxonomy becomes DATA, not DDL
--
-- WHY
--   Migration 040 froze the category list into three hardcoded CHECK
--   constraints (guides, reviews, media_assets). `lib/categories.ts` is the
--   authority for that list, so every add/rename since has had to be mirrored
--   by hand into DDL — and #60 (Table Duty / Watch Duty) wasn't. Result: saving
--   a guide, review, or product image under 'table-duty' or 'watch-duty' failed
--   with a check-constraint violation, even though app-layer Zod (which derives
--   from CATEGORY_SLUGS) accepted it.
--
--   This replaces the CHECKs with a `categories` table + foreign keys. Adding a
--   category is now one INSERT. Renaming a slug is one UPDATE that cascades
--   everywhere (ON UPDATE CASCADE) instead of the multi-table data surgery
--   migration 040 had to do.
--
-- SOURCE OF TRUTH
--   `lib/categories.ts` remains authoritative for DISPLAY (label, shortLabel,
--   description, icon, pov, faqs). The `label` column here is a readability
--   mirror for the SQL editor / admin queries — do NOT render it in the UI.
--   The `slug` set and its ordering are what this table actually enforces.
--
-- SCOPE NOTE
--   `gear_candidates.category` and `boss_research_*.category` are deliberately
--   left unconstrained. They are LLM-fed staging tables; the Boss tool schema
--   (lib/boss/tools/research_gear.ts) already restricts them to CATEGORY_SLUGS,
--   and a hard FK there would turn a model hiccup into a failed tool call.

BEGIN;

-- ─── 1. The taxonomy table ───────────────────────────────────────────────────

create table if not exists categories (
  slug        text        primary key,
  label       text        not null,
  position    integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  categories      is 'Category/pillar taxonomy. Mirrors lib/categories.ts, which stays authoritative for display copy. Referenced by guides, reviews, products, media_assets, tags.';
comment on column categories.label is 'Readability mirror for SQL/admin only — UI labels come from lib/categories.ts.';

-- Ordering for admin pickers; slug is already the PK index.
create index if not exists idx_categories_position on categories (position);

-- Seed in lib/categories.ts array order. Gaps of 10 leave room to insert.
insert into categories (slug, label, position) values
  ('kids-family',        'Kids & Family',        10),
  ('tools-diy',          'Tools & DIY',          20),
  ('grilling-cooking',   'Grilling & Cooking',   30),
  ('outdoors-adventure', 'Outdoors & Adventure', 40),
  ('tech-edc',           'Tech & Gadgets',       50),
  ('vehicles-garage',    'Vehicles & Garage',    60),
  ('health-wellness',    'Health & Wellness',    70),
  ('home-lifestyle',     'Home & Lifestyle',     80),
  ('table-duty',         'Table Duty',           90),
  ('watch-duty',         'Watch Duty',          100)
on conflict (slug) do update
  set label = excluded.label, position = excluded.position, updated_at = now();

-- ─── 2. RLS — public content (Pattern A) ─────────────────────────────────────
-- Taxonomy drives public category landing pages, so logged-out visitors must
-- read it. Writes are admin-only.

alter table categories enable row level security;

drop policy if exists "categories_read" on categories;
create policy "categories_read"
  on categories for select
  to anon, authenticated
  using (true);

drop policy if exists "categories_admin_write" on categories;
create policy "categories_admin_write"
  on categories for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- ─── 3. Drop the frozen CHECK constraints ────────────────────────────────────

alter table guides       drop constraint if exists guides_category_check;
alter table reviews      drop constraint if exists reviews_category_check;
alter table media_assets drop constraint if exists media_assets_category_check;

-- ─── 4. Referential integrity ────────────────────────────────────────────────
-- ON UPDATE CASCADE is the point: a future slug rename propagates instead of
-- needing a data-migration pass like 040.
-- ON DELETE RESTRICT on content tables — never silently orphan published rows.
-- tags.category_slug uses SET NULL to match the existing tags_parent_slug_fkey
-- convention on that table.
--
-- All existing values were verified in-set before writing this migration, so
-- these validate without a data fix.

alter table guides       drop constraint if exists guides_category_fkey;
alter table guides       add  constraint guides_category_fkey
  foreign key (category) references categories(slug)
  on update cascade on delete restrict;

alter table reviews      drop constraint if exists reviews_category_fkey;
alter table reviews      add  constraint reviews_category_fkey
  foreign key (category) references categories(slug)
  on update cascade on delete restrict;

-- media_assets.category is nullable (267 uncategorized rows) — FK ignores NULLs.
alter table media_assets drop constraint if exists media_assets_category_fkey;
alter table media_assets add  constraint media_assets_category_fkey
  foreign key (category) references categories(slug)
  on update cascade on delete restrict;

-- products.category had NO constraint at all before this — same taxonomy,
-- previously unenforced. Nullable.
alter table products     drop constraint if exists products_category_fkey;
alter table products     add  constraint products_category_fkey
  foreign key (category) references categories(slug)
  on update cascade on delete restrict;

-- tags.category_slug pins a tag to its pillar (migration 127). Nullable.
alter table tags         drop constraint if exists tags_category_slug_fkey;
alter table tags         add  constraint tags_category_slug_fkey
  foreign key (category_slug) references categories(slug)
  on update cascade on delete set null;

-- Note: every FK column above already has a supporting index
-- (idx_products_category, idx_tags_category, idx_media_assets_category, and the
-- status/visible/category composites on guides + reviews). None added here.

COMMIT;

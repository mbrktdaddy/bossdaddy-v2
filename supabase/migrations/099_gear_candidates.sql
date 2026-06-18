-- ─────────────────────────────────────────────────────────────────────────────
-- 099 — Gear candidate zone (provenance split, Increment 1 of the spine rebuild).
--
-- See docs/the-boss-gear-architecture-plan.md. The Boss research_gear tool used to
-- write its web-search picks straight into the canonical `products` catalog
-- (status='researched') AND the public `wishlist_items` bench — so untested,
-- uncurated gear leaked onto the homepage "On the Bench" reel. This migration
-- introduces a private CANDIDATE ZONE: AI-researched gear lives here, never on a
-- public surface, until a deliberate admin "adopt" action (Increment 2) promotes
-- it into the product spine.
--
-- This migration:
--   1. Creates `gear_candidates` (admin-only — Pattern C).
--   2. Backfills it from the already-leaked `products.status='researched'` rows.
--   3. Deletes those researched products + their auto-seeded twin bench rows
--      (de-leaks the homepage now).
--   4. Drops 'researched' from the products status CHECK (it was never in the
--      ProductStatus TS type — only the raw seed upsert ever wrote it).
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. gear_candidates — the candidate zone (Pattern C, admin-only) ──────────
-- One row per researched product. Server-only: read + written via the admin
-- client (the tool handler and /go). RLS is admin-only as a safety gate; the
-- admin client bypasses it.
create table if not exists gear_candidates (
  id                 uuid        primary key default gen_random_uuid(),
  slug               text        unique not null,
  name               text        not null,
  brand              text,
  category           text,
  price_tier         text,                       -- budget | mid | premium
  price_text         text,                       -- human price hint, e.g. "$180–220"
  fit                text,                        -- one line: why it fits the need
  why                text,                        -- research-consensus note
  affiliate_url      text,                        -- tracked /go target
  store              text        not null default 'amazon',
  sources            jsonb       not null default '[]'::jsonb,  -- [{title,url}]
  source             text        not null default 'boss_research',
  request_count      integer     not null default 1,            -- demand: times surfaced
  first_query        text,
  -- Adoption (Increment 2): set when promoted into the product spine. We FLAG,
  -- never delete — keeps provenance and stops re-surfacing as a "new" candidate.
  adopted_at         timestamptz,
  adopted_product_id uuid        references products(id) on delete set null,
  created_at         timestamptz not null default now(),
  last_seen_at       timestamptz not null default now()
);

-- Admin views: "newest candidates" and "most-requested, not yet adopted".
create index if not exists idx_gear_candidates_recent
  on gear_candidates (last_seen_at desc);
create index if not exists idx_gear_candidates_demand
  on gear_candidates (request_count desc) where adopted_at is null;

alter table gear_candidates enable row level security;

create policy "gear_candidates_admin_all"
  on gear_candidates for all
  to authenticated
  using (is_admin())
  with check (is_admin());


-- ─── 2. Backfill from already-leaked researched products ──────────────────────
-- Move every auto-seeded researched product into the candidate zone. Idempotent:
-- on slug conflict keep the existing candidate row.
insert into gear_candidates (slug, name, brand, category, affiliate_url, store, source)
select
  p.slug,
  p.name,
  p.brand,
  p.category,
  p.affiliate_url,
  coalesce(p.store, 'amazon'),
  'boss_research'
from products p
where p.status = 'researched'
on conflict (slug) do nothing;


-- ─── 3. De-leak: remove the researched products + their twin bench rows ───────
-- Delete the auto-seeded bench twins first (same slug, default seed status
-- 'considering'), guarded so we never touch a deliberately-curated bench item.
delete from wishlist_items w
where w.status = 'considering'
  and w.slug in (select p.slug from products p where p.status = 'researched');

-- Then the researched products themselves.
delete from products where status = 'researched';


-- ─── 4. Tighten products.status — drop 'researched' ───────────────────────────
-- Back to the canonical set (matches lib/products.ts ProductStatus). Prevents any
-- future code path from re-seeding untested gear into the catalog.
alter table products drop constraint if exists products_status_check;
alter table products add constraint products_status_check
  check (status in ('wishlist', 'testing', 'reviewed', 'passed', 'archived'));

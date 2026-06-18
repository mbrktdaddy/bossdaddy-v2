-- ─────────────────────────────────────────────────────────────────────────────
-- 100 — Product spine, part 1: bench columns + unified status (Increment 2).
--
-- See docs/the-boss-gear-architecture-plan.md. Folds the bench (`wishlist_items`)
-- into the one canonical `products` spine. This migration is ADDITIVE — it widens
-- products so it can hold a bench item's full state. Migration 101 moves the rows
-- and repoints FKs; 102 drops the old table. Apply 100 → 101 → (verify) → 102.
--
-- Unified status lifecycle (the bench is just products in early states):
--   considering → queued → testing → reviewed → passed / archived
-- 'wishlist' (old products bench-entry value, 0 rows in use) becomes 'considering';
-- the bench's 'skipped' becomes 'passed' (handled in 101). Display labels live in
-- lib/products.ts / lib/labels.ts — internal values are now stable.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Bench columns on products ─────────────────────────────────────────────
alter table products
  add column if not exists priority              integer     not null default 0,
  add column if not exists review_id             uuid        references reviews(id) on delete set null,
  add column if not exists skip_reason           text,
  add column if not exists estimated_review_date date,
  add column if not exists gallery_images        text[]      not null default '{}',
  -- Provenance, orthogonal to status: how this gear entered the catalog.
  add column if not exists source                text        not null default 'hand';

-- Bench listing query shape: pipeline state, then priority, then recency.
create index if not exists idx_products_bench
  on products (status, priority desc, created_at desc);

-- One review per product (mirrors the old wishlist_items.review_id link).
create index if not exists idx_products_review_id
  on products (review_id) where review_id is not null;


-- ─── 2. Unified status CHECK ──────────────────────────────────────────────────
-- Migrate the legacy bench-entry value first (0 rows expected), then swap the
-- constraint to the unified lifecycle set.
update products set status = 'considering' where status = 'wishlist';

alter table products drop constraint if exists products_status_check;
alter table products add constraint products_status_check
  check (status in ('considering', 'queued', 'testing', 'reviewed', 'passed', 'archived'));

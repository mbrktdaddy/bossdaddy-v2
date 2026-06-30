-- ─────────────────────────────────────────────────────────────────────────────
-- 110 — Let collections include un-reviewed products.
--
-- Until now every collection_item had to be an approved review
-- (collection_items.review_id NOT NULL references reviews — migs 044/065/068).
-- The founder wants to build stacks/picks/gifts from products he personally
-- uses/owns but hasn't written a full review for yet — labeled honestly as an
-- owner pick, never dressed up as a completed review (see the
-- collections_unreviewed_products plan).
--
-- This makes a collection_item polymorphic: EXACTLY ONE of review_id /
-- product_slug is set. Reviewed items are unchanged. Product-only items render
-- as an honest product card on public pages (no rating, no "tested" badge) and
-- auto-upgrade to the full review card once an approved review for that
-- product_slug exists.
--
-- Post the product-spine rebuild (migs 100–102) there is a single canonical
-- `products` table (slug unique), so product items reference products(slug)
-- directly — no bench/wishlist reconciliation needed.
--
-- RLS unchanged: collection_items read is gated by parent collection visibility
-- and writes are admin-only (mig 065); adding a column needs no policy change.
-- After applying: `npm run db:types`.
-- ─────────────────────────────────────────────────────────────────────────────

begin;

-- 1. review_id becomes optional; add the product alternative.
alter table collection_items
  alter column review_id drop not null,
  add column if not exists product_slug text references products(slug) on delete cascade;

-- 2. Exactly one source per item. Existing rows (review_id set, product_slug
--    null) satisfy num_nonnulls = 1, so this validates with no backfill.
alter table collection_items
  add constraint collection_items_one_source
  check (num_nonnulls(review_id, product_slug) = 1);

-- 3. No duplicate product within the same collection. Mirrors the existing
--    unique(collection_id, review_id) from mig 044; NULLs are distinct in a
--    unique index, so product-only rows don't collide on the review constraint
--    and reviewed rows don't collide on this one.
create unique index if not exists idx_collection_items_collection_product
  on collection_items (collection_id, product_slug)
  where product_slug is not null;

-- 4. Reverse lookup: "which collections feature this product".
create index if not exists idx_collection_items_product_slug
  on collection_items (product_slug) where product_slug is not null;

comment on column collection_items.product_slug is
  'Set (instead of review_id) when this item is an un-reviewed product the owner uses/owns. Renders as an honest product card (no rating, no "tested" badge) and auto-upgrades once an approved review for this product_slug exists. Exactly one of review_id / product_slug is non-null (collection_items_one_source).';

commit;

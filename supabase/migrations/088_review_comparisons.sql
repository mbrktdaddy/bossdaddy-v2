-- ─────────────────────────────────────────────────────────────────────────────
-- 088_review_comparisons.sql
--
-- Adds head-to-head competitor selection to reviews + the index the competitor
-- query needs. Builds on 087 (products.brand + products.specs).
--
--   • reviews.comparison_product_slugs — array of product slugs the author
--     chose to compare this review's product against (same category, different
--     brand). Drives the spec-comparison table on the review page and grounds
--     the AI draft prose. Slugs (not ids) to match the existing reviews.product_slug
--     convention — both are slug references into products.
--
--   • idx_products_category_brand — the competitor picker queries products by
--     (category, brand): "same category, different brand". 087 deliberately
--     shipped no index because no query filtered on brand yet; this is that query.
--
-- No RLS changes: reviews + products policies already cover these. Existing
-- rows default to an empty array, so older reviews render no comparison table.
-- ─────────────────────────────────────────────────────────────────────────────

alter table reviews
  add column if not exists comparison_product_slugs text[] not null default '{}'::text[];

comment on column reviews.comparison_product_slugs is
  'Product slugs this review is compared against (same category, other brands). Powers the spec-comparison table and grounds the draft prose.';

create index if not exists idx_products_category_brand
  on products (category, brand);

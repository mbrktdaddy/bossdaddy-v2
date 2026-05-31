-- ─────────────────────────────────────────────────────────────────────────────
-- 087_product_brand_facts.sql
--
-- Adds brand attribution and structured spec facts to products.
--
--   • brand — manufacturer / brand name, separate from the product `name`.
--     Editable, manually backfillable. The grouping key that makes
--     brand-vs-brand comparisons possible (group by brand within a category).
--
--   • specs — flexible JSONB array of { "label": string, "value": string }.
--     Specs are category-dependent (a stroller's specs ≠ a drill's), so a
--     rigid column-per-spec doesn't fit. The array shape powers both the
--     spec-aware review draft prompt and a future comparison table.
--
-- No RLS changes: the existing `products` policies (public read +
-- is_admin() write) already cover these columns. No new index — there is no
-- query shape that filters/sorts on brand yet; add one when one exists.
-- ─────────────────────────────────────────────────────────────────────────────

alter table products
  add column if not exists brand text,
  add column if not exists specs jsonb not null default '[]'::jsonb;

comment on column products.brand is
  'Manufacturer / brand name, distinct from product name. Editable; grouping key for brand comparisons.';
comment on column products.specs is
  'Array of { label, value } spec facts. Category-dependent. Feeds the review draft prompt and comparison surfaces.';

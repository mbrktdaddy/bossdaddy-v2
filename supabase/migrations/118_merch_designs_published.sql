-- Migration 118: track multiple published products per merch design
--
-- One saying naturally becomes several products (tee + mug + …). The scalar
-- printful_sync_product_id only remembers the most recent, so we add a `published`
-- jsonb array that records one entry PER blank. The publish flow guards per-blank
-- (re-publishing a tee doesn't block publishing a mug) and the Studio shows which
-- products a design has spawned.
--
-- Entry shape (app-enforced, not a DB constraint):
--   { blank, template, colorway, sync_product_id, print_file_url,
--     colors, sizes, price_cents, published_at }

ALTER TABLE merch_designs
  ADD COLUMN IF NOT EXISTS published jsonb NOT NULL DEFAULT '[]'::jsonb;

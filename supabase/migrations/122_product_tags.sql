-- Migration 122: product_tags join table.
-- Makes the product spine taggable, mirroring review_tags/guide_tags (041).
-- Products are public content (042: public_read `using (true)`, admin-only writes) and
-- are admin-managed (no author ownership model) — so this table follows the same shape:
-- public read, admin write. See docs/pillar-taxonomy.md.

BEGIN;

CREATE TABLE IF NOT EXISTS product_tags (
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  tag_slug   TEXT REFERENCES tags(slug)   ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_slug)
);

-- Reverse lookup: "all products with tag X" (the tag-feed query).
CREATE INDEX IF NOT EXISTS idx_product_tags_tag ON product_tags(tag_slug);

ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;

-- Public read — products themselves are public (042), so their tags are too.
CREATE POLICY "product_tags_public_read"
  ON product_tags FOR SELECT
  TO anon, authenticated
  USING (true);

-- Admin-only writes (products are an admin-curated catalog).
CREATE POLICY "product_tags_admin_write"
  ON product_tags FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

COMMIT;

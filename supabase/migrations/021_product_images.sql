-- Product image gallery — stores multiple images per product.
-- products.image_url stays as the denormalized primary, kept in sync by app code.

CREATE TABLE product_images (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT        NOT NULL,
  alt_text    TEXT,
  label       TEXT,
  position    INTEGER     NOT NULL DEFAULT 0,
  is_primary  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX product_images_product_id_idx ON product_images(product_id);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Public read — product images appear on public review pages
CREATE POLICY "product_images_read" ON product_images
  FOR SELECT USING (true);

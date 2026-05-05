-- Product metadata + review experience fields
--
-- products: add editorial description, category, price, and lifecycle status.
-- reviews:  add testing context fields that feed Claude draft generation and
--           remain editable for backfilling older reviews.

-- ── products ─────────────────────────────────────────────────────────────────

alter table products
  add column if not exists description  text,
  add column if not exists category     text,
  add column if not exists price_cents  integer check (price_cents >= 0),
  add column if not exists status       text not null default 'wishlist'
    check (status in ('wishlist', 'testing', 'reviewed', 'passed', 'archived'));

-- Backfill: products that have an approved review are already reviewed.
update products p
set    status = 'reviewed'
where  exists (
  select 1 from reviews r
  where  r.product_slug = p.slug
  and    r.status = 'approved'
);

create index if not exists idx_products_status   on products (status);
create index if not exists idx_products_category on products (category) where category is not null;

-- ── reviews ──────────────────────────────────────────────────────────────────

alter table reviews
  add column if not exists testing_duration text
    check (testing_duration in ('<1wk', '1-4wks', '1-3mo', '3+mo')),
  add column if not exists how_you_used_it  text,
  add column if not exists standout_moment  text,
  add column if not exists price_paid_cents integer check (price_paid_cents >= 0);

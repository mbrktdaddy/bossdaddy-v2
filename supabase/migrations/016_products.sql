-- Products registry — canonical product rows referenced by [[BUY:slug]] tokens
-- in review content. The resolver in lib/products.ts replaces tokens with
-- affiliate anchor tags at save time.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists products (
  id                uuid        primary key default gen_random_uuid(),
  slug              text        unique not null,
  name              text        not null,
  asin              text,
  amazon_url        text,
  non_affiliate_url text,
  image_url         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_products_slug on products (slug);

alter table products enable row level security;

-- Any authenticated user can read products (review authors need to pick them
-- in the draft UI; the save-time resolver also needs read access).
create policy "products_authenticated_read"
  on products for select
  to authenticated
  using (true);

-- Only admins can create / update / delete products.
create policy "products_admin_write"
  on products for all
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Reuse the existing touch_updated_at function from 001_initial.sql.
create or replace trigger products_updated_at
  before update on products
  for each row execute function touch_updated_at();

-- Migration 053: Merch e-commerce schema
-- Extends merch table + adds merch_variants, carts, cart_items, orders, order_items.
-- Apply via: supabase db push  OR paste into Supabase SQL editor.

-- ─── 1. Extend merch ─────────────────────────────────────────────────────────
alter table merch
  add column if not exists printful_sync_product_id bigint,
  add column if not exists currency text not null default 'USD',
  add column if not exists default_image_url text,
  add column if not exists archived_at timestamptz;

-- partial unique index: only one row per Printful product; NULLs (concept rows) are fine
create unique index if not exists idx_merch_printful_sync_product
  on merch (printful_sync_product_id) where printful_sync_product_id is not null;

-- ─── 2. merch_variants ───────────────────────────────────────────────────────
create table if not exists merch_variants (
  id                        uuid    primary key default gen_random_uuid(),
  merch_id                  uuid    not null references merch(id) on delete cascade,
  printful_variant_id       bigint,
  printful_sync_variant_id  bigint,
  size                      text,
  color                     text,
  retail_price_cents        int     not null,
  weight_g                  int,
  image_url                 text,
  in_stock                  bool    not null default true,
  position                  int     not null default 0,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create unique index if not exists idx_merch_variants_printful_variant
  on merch_variants (printful_variant_id) where printful_variant_id is not null;
create unique index if not exists idx_merch_variants_printful_sync_variant
  on merch_variants (printful_sync_variant_id) where printful_sync_variant_id is not null;
create index if not exists idx_merch_variants_merch_position
  on merch_variants (merch_id, position);

alter table merch_variants enable row level security;

create policy "merch_variants_read"
  on merch_variants for select
  to anon, authenticated
  using (
    exists (
      select 1 from merch m
      where m.id = merch_id
        and m.status in ('coming_soon', 'available')
        and m.archived_at is null
    )
  );

create policy "merch_variants_admin_write"
  on merch_variants for all
  to authenticated
  using (is_admin())
  with check (is_admin());

create or replace function set_merch_variants_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_merch_variants_updated_at on merch_variants;
create trigger trg_merch_variants_updated_at
  before update on merch_variants
  for each row execute function set_merch_variants_updated_at();

-- ─── 3. carts ────────────────────────────────────────────────────────────────
-- Security model: all cart reads/writes go through server API routes using the
-- admin client. RLS is enabled but no policy grants access — anon carts cannot
-- authenticate via auth.uid(), so uniform server-mediated access is cleaner.
create table if not exists carts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users on delete cascade,
  anon_session_id  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint carts_owner_check check (
    (user_id is not null)::int + (anon_session_id is not null)::int = 1
  )
);

create unique index if not exists idx_carts_user
  on carts (user_id) where user_id is not null;
create unique index if not exists idx_carts_anon
  on carts (anon_session_id) where anon_session_id is not null;

alter table carts enable row level security;

create or replace function set_carts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_carts_updated_at on carts;
create trigger trg_carts_updated_at
  before update on carts
  for each row execute function set_carts_updated_at();

-- ─── 4. cart_items ───────────────────────────────────────────────────────────
create table if not exists cart_items (
  id          uuid primary key default gen_random_uuid(),
  cart_id     uuid not null references carts(id) on delete cascade,
  merch_id    uuid not null references merch(id) on delete cascade,
  variant_id  uuid not null references merch_variants(id) on delete cascade,
  qty         int  not null default 1 check (qty > 0 and qty <= 10),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create index if not exists idx_cart_items_cart
  on cart_items (cart_id);

alter table cart_items enable row level security;

create or replace function set_cart_items_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_cart_items_updated_at on cart_items;
create trigger trg_cart_items_updated_at
  before update on cart_items
  for each row execute function set_cart_items_updated_at();

-- ─── 5. orders ───────────────────────────────────────────────────────────────
create sequence if not exists orders_number_seq start 1;

create table if not exists orders (
  id                        uuid primary key default gen_random_uuid(),
  order_number              text unique not null,
  user_id                   uuid references auth.users on delete set null,
  email                     text not null,
  status                    text not null default 'pending' check (status in (
                              'pending', 'paid', 'fulfilled', 'shipped',
                              'delivered', 'cancelled', 'refunded'
                            )),
  stripe_session_id         text unique,
  stripe_payment_intent_id  text unique,
  printful_order_id         bigint unique,
  subtotal_cents            int not null default 0,
  shipping_cents            int not null default 0,
  tax_cents                 int not null default 0,
  total_cents               int not null default 0,
  currency                  text not null default 'USD',
  shipping_address          jsonb not null default '{}',
  tracking_url              text,
  tracking_number           text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists idx_orders_user_created
  on orders (user_id, created_at desc) where user_id is not null;
create index if not exists idx_orders_status
  on orders (status, created_at desc);
create index if not exists idx_orders_stripe_session
  on orders (stripe_session_id);
create index if not exists idx_orders_printful
  on orders (printful_order_id);

alter table orders enable row level security;

create policy "orders_self_read"
  on orders for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "orders_admin_write"
  on orders for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- auto-generate order_number before insert (BEFORE trigger fires before NOT NULL check)
create or replace function generate_order_number()
returns trigger as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'BD-' || to_char(now(), 'YYYY') || '-'
      || lpad(nextval('orders_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_number on orders;
create trigger trg_orders_number
  before insert on orders
  for each row execute function generate_order_number();

create or replace function set_orders_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at
  before update on orders
  for each row execute function set_orders_updated_at();

-- ─── 6. order_items ──────────────────────────────────────────────────────────
-- on delete restrict prevents orphaned order items if a product is deleted;
-- use archived_at on merch instead of hard-deleting sold items.
create table if not exists order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  merch_id            uuid not null references merch(id) on delete restrict,
  variant_id          uuid not null references merch_variants(id) on delete restrict,
  qty                 int  not null check (qty > 0),
  unit_price_cents    int  not null,
  name_snapshot       text not null,
  image_snapshot_url  text,
  created_at          timestamptz not null default now()
);

create index if not exists idx_order_items_order
  on order_items (order_id);

alter table order_items enable row level security;

create policy "order_items_read"
  on order_items for select
  to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or is_admin())
    )
  );

create policy "order_items_admin_write"
  on order_items for all
  to authenticated
  using (is_admin())
  with check (is_admin());

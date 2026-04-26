-- Boss Daddy merch shop infrastructure
-- /shop is now the merch hub. /gear takes over the curated review list.

create table if not exists shop_products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  price_cents integer,
  image_url text,
  category text check (category in (
    'apparel',
    'drinkware',
    'accessories',
    'stickers',
    'other'
  )),
  status text not null default 'coming_soon' check (status in (
    'concept',
    'coming_soon',
    'available',
    'sold_out',
    'discontinued'
  )),
  external_url text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shop_products_status_position
  on shop_products (status, position);
create index if not exists idx_shop_products_category
  on shop_products (category);

-- updated_at auto-bump
create or replace function set_shop_products_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_shop_products_updated_at on shop_products;
create trigger trg_shop_products_updated_at
  before update on shop_products
  for each row execute function set_shop_products_updated_at();

-- RLS: anyone can read items that are coming_soon or available;
-- only admins can write.
alter table shop_products enable row level security;

create policy "public read visible shop products"
  on shop_products for select
  to anon, authenticated
  using (status in ('coming_soon', 'available'));

create policy "admins manage shop products"
  on shop_products for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Newsletter interests — lets a single subscribers table serve
-- multiple signup contexts (shop launch, weekly digest, review alerts, etc.)
alter table newsletter_subscribers
  add column if not exists interests text[] not null default '{}';

create index if not exists idx_newsletter_subscribers_interests
  on newsletter_subscribers using gin (interests);

-- Seed placeholder merch concepts so the new /shop page has content
insert into shop_products (slug, name, description, price_cents, category, status, position) values
  ('boss-daddy-tee',           'Boss Daddy Tee',                 'Heavyweight cotton tee with the Boss Daddy mark. Built to take a beating.',                   2800, 'apparel',     'coming_soon', 10),
  ('weekend-warrior-hoodie',   'Weekend Warrior Hoodie',         'Heavy fleece pullover for cold mornings on the field, in the garage, or by the grill.',      4800, 'apparel',     'coming_soon', 20),
  ('boss-daddy-trucker-hat',   'Boss Daddy Trucker Hat',         'Classic mesh-back trucker. One color. No nonsense.',                                          2200, 'apparel',     'coming_soon', 30),
  ('field-mug',                'The Field Mug',                  '15oz ceramic mug for early-morning coffee before anyone else is up.',                          1800, 'drinkware',   'coming_soon', 40),
  ('insulated-tumbler',        'Boss Daddy Tumbler',             '20oz double-wall insulated. Coffee stays hot. Beer stays cold. No compromises.',              2800, 'drinkware',   'coming_soon', 50),
  ('sticker-pack',             'Sticker Pack',                   'Five-pack of weatherproof vinyl. For the truck, the toolbox, and the hard hat.',              800,  'stickers',    'coming_soon', 60)
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 160 — Media provenance + product images follow their product.
--
-- 1. PROVENANCE. Nothing recorded where an image came from: an owned photo, a
--    brand's image pulled in by the link import, an Amazon API image and an AI
--    image all looked alike. Image strategy (owned first) and copyright both
--    need it. `origin` is set only when it's known (claims only when set):
--      own    — taken with the in-app camera
--      web    — "Add this image" from a product page; origin_url says whose
--      amazon — Amazon Product Advertising API
--      ai     — generated editorial image
--    A plain file upload stays NULL: a file from disk could be anything.
--
-- 2. CATEGORY FOLLOWS THE PRODUCT. media_assets.category was copied from the
--    form at upload and never updated: 188 of 264 product images disagreed with
--    their product (checked 2026-10-06), mostly uploaded before a category was
--    set. The product now owns it: a BEFORE trigger sets a product image's
--    category from its product, and a products trigger re-syncs on change.
--    Non-product images keep their own category.
--
-- 3. ALT TEXT DEFAULT. A product image with no alt text gets "Brand Name".
--    Only fills blanks; never overwrites what an admin wrote.
--
-- Table type: public content (media_assets RLS unchanged). The triggers run as
-- SECURITY DEFINER so a product category change re-syncs every image whatever
-- the caller's own media_assets grants.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Provenance ────────────────────────────────────────────────────────────
alter table media_assets
  add column if not exists origin     text,
  add column if not exists origin_url text;

comment on column media_assets.origin is
  'Where the image came from, only when known: own | web | amazon | ai. NULL = unknown (plain upload).';
comment on column media_assets.origin_url is
  'For origin = web: the product page the image was imported from.';

alter table media_assets drop constraint if exists media_assets_origin_check;
alter table media_assets add constraint media_assets_origin_check
  check (origin is null or origin in ('own', 'web', 'amazon', 'ai'));

alter table media_assets drop constraint if exists media_assets_origin_url_check;
alter table media_assets add constraint media_assets_origin_url_check
  check (origin_url is null or (origin_url ~ '^https?://' and char_length(origin_url) <= 2048));

-- AI images are already identifiable by their filename (ai-<ts>-<id>.webp).
update media_assets set origin = 'ai' where origin is null and filename like 'ai-%';


-- ─── 2 + 3. Product images take category (and default alt) from the product ──
create or replace function media_asset_follow_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p record;
begin
  if new.product_id is null then
    return new;
  end if;
  select category, name, brand into p from products where id = new.product_id;
  if not found then
    return new;
  end if;
  new.category := p.category;
  if new.alt_text is null or btrim(new.alt_text) = '' then
    new.alt_text := btrim(coalesce(p.brand, '') || ' ' || p.name);
  end if;
  return new;
end;
$$;

drop trigger if exists media_assets_follow_product on media_assets;
create trigger media_assets_follow_product
  before insert or update of product_id, category on media_assets
  for each row execute function media_asset_follow_product();

create or replace function products_sync_media_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update media_assets
     set category = new.category
   where product_id = new.id
     and category is distinct from new.category;
  return new;
end;
$$;

drop trigger if exists products_sync_media_category on products;
create trigger products_sync_media_category
  after update of category on products
  for each row
  when (old.category is distinct from new.category)
  execute function products_sync_media_category();

-- One-time backfill: correct every product image's category, and give the
-- ones with no alt text the default (the BEFORE trigger does both).
update media_assets m
   set category = p.category
  from products p
 where m.product_id = p.id
   and (m.category is distinct from p.category or m.alt_text is null or btrim(m.alt_text) = '');

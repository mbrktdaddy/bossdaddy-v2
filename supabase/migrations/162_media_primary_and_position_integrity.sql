-- ─────────────────────────────────────────────────────────────────────────────
-- 162 — One primary per product; gallery positions assigned by the database.
--
-- /api/media computed a new image's position as "count + 1" and made position 1
-- the primary. Uploads run in parallel, so concurrent uploads all counted the
-- same images: a five-image add produced four primaries, and positions
-- collided. Prod already had 3 products with several primaries and 37
-- duplicate positions (2026-10-06). The race predates the link import; adding
-- several images at once just made it routine.
--
-- The database now owns the invariants, so no upload path can race them:
--   • a partial unique index: at most one primary per product;
--   • a BEFORE INSERT trigger that locks the product row (serialising that
--     product's concurrent uploads), takes the next position, and makes the
--     first image the primary (an explicit is_primary insert demotes the old
--     one first);
--   • an AFTER trigger that keeps products.image_url on the primary.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Repair ────────────────────────────────────────────────────────────────
-- Keep one primary per product: the one the product already shows as its hero,
-- else the earliest.
with ranked as (
  select m.id,
         row_number() over (
           partition by m.product_id
           order by (m.url = p.image_url) desc, m.created_at, m.id
         ) as rn
    from media_assets m
    join products p on p.id = m.product_id
   where m.is_primary
)
update media_assets m
   set is_primary = false
  from ranked r
 where m.id = r.id
   and r.rn > 1;

-- Renumber each product's gallery 1..n, keeping the current order.
with ordered as (
  select id,
         row_number() over (partition by product_id order by position nulls last, created_at, id) as pos
    from media_assets
   where product_id is not null
)
update media_assets m
   set position = o.pos
  from ordered o
 where m.id = o.id
   and m.position is distinct from o.pos;


-- ─── 2. One primary per product ───────────────────────────────────────────────
create unique index if not exists media_assets_one_primary_per_product
  on media_assets (product_id)
  where is_primary;


-- ─── 3. Position + primary on insert ──────────────────────────────────────────
create or replace function media_asset_place_in_gallery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is null then
    return new;
  end if;
  -- Serialise this product's uploads: the next one waits for this commit.
  perform 1 from products where id = new.product_id for update;

  select coalesce(max(position), 0) + 1 into new.position
    from media_assets
   where product_id = new.product_id;

  if new.is_primary then
    update media_assets
       set is_primary = false
     where product_id = new.product_id
       and is_primary;
  elsif not exists (select 1 from media_assets where product_id = new.product_id and is_primary) then
    new.is_primary := true;
  end if;
  return new;
end;
$$;

drop trigger if exists media_assets_place_in_gallery on media_assets;
create trigger media_assets_place_in_gallery
  before insert on media_assets
  for each row execute function media_asset_place_in_gallery();


-- ─── 4. The product's hero follows its primary ───────────────────────────────
create or replace function media_asset_sync_product_hero()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null and new.is_primary then
    update products
       set image_url = new.url
     where id = new.product_id
       and image_url is distinct from new.url;
  end if;
  return null;
end;
$$;

drop trigger if exists media_assets_sync_product_hero on media_assets;
create trigger media_assets_sync_product_hero
  after insert or update of is_primary, url, product_id on media_assets
  for each row execute function media_asset_sync_product_hero();

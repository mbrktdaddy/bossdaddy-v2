-- ─────────────────────────────────────────────────────────────────────────────
-- 161 — products.gallery_images is rebuilt from the product's media.
--
-- The public Bench page shows [image_url, ...gallery_images], but nothing has
-- written gallery_images since product images moved to media_assets: 40
-- products carry ~6.6 images each and visitors see one. media_assets can't be
-- read publicly (authors/admins only), and opening it would expose upload
-- metadata, so the public gallery stays a products column, now DERIVED: every
-- change to a product's media rebuilds it (non-primary images, in gallery
-- order; the primary is already products.image_url).
--
-- Backfill touches only products that have media. Two products carry a legacy
-- gallery_images with no media rows (checked 2026-10-06); they keep it until
-- media is added to them.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function rebuild_product_gallery(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  urls text[];
begin
  if p_product_id is null then
    return;
  end if;
  select coalesce(array_agg(url order by position nulls last, created_at), '{}')
    into urls
    from media_assets
   where product_id = p_product_id
     and not is_primary;
  update products
     set gallery_images = urls
   where id = p_product_id
     and gallery_images is distinct from urls;
end;
$$;

-- Internal helper, not an API: keep it out of PostgREST's RPC surface.
-- (Supabase's default privileges grant EXECUTE to anon/authenticated, so the
-- revoke must name them, not just PUBLIC.)
revoke all on function rebuild_product_gallery(uuid) from public, anon, authenticated;

create or replace function media_assets_rebuild_gallery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform rebuild_product_gallery(old.product_id);
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.product_id is distinct from old.product_id) then
    perform rebuild_product_gallery(new.product_id);
  end if;
  return null;
end;
$$;

drop trigger if exists media_assets_rebuild_gallery on media_assets;
create trigger media_assets_rebuild_gallery
  after insert or delete or update of product_id, is_primary, position, url on media_assets
  for each row execute function media_assets_rebuild_gallery();

-- Backfill: every product that has media.
select rebuild_product_gallery(p.id)
  from products p
 where exists (select 1 from media_assets m where m.product_id = p.id);

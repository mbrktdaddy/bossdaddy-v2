-- ─────────────────────────────────────────────────────────────────────────────
-- 101 — Product spine, part 2: merge wishlist_items into products + repoint FKs.
--
-- Moves every bench row into the products spine (preserving its id, so votes,
-- subscriptions, and comments keep pointing at the same uuid), then repoints the
-- vote/subscription FKs and the comments content_type. Run after 100. The old
-- `wishlist_items` table is dropped separately in 102, after the app is verified
-- reading products.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Move bench rows into products (id preserved) ──────────────────────────
-- title → name; status remap (skipped → passed); everything else carries over.
-- Slugs are distinct from products today, but on a slug clash we keep the
-- existing product row (the richer, reviewed/tested one wins).
insert into products (
  id, slug, name, description, image_url, gallery_images,
  affiliate_url, asin, store, custom_store_name,
  status, skip_reason, estimated_review_date, review_id, priority,
  source, created_at, updated_at
)
select
  w.id, w.slug, w.title, w.description, w.image_url, w.gallery_images,
  w.affiliate_url, w.asin, coalesce(w.store, 'amazon'), w.custom_store_name,
  case w.status
    when 'skipped' then 'passed'
    else w.status
  end,
  w.skip_reason, w.estimated_review_date, w.review_id, w.priority,
  'hand', w.created_at, w.updated_at
from wishlist_items w
on conflict (slug) do nothing;


-- ─── 2. Repoint vote / subscription FKs to products ───────────────────────────
-- 0 rows today, and ids were preserved above, so this is a pure constraint swap.
-- Column name `wishlist_item_id` is kept (stable internal name) — it now holds a
-- products.id.
alter table wishlist_votes
  drop constraint if exists wishlist_votes_wishlist_item_id_fkey,
  add  constraint wishlist_votes_wishlist_item_id_fkey
    foreign key (wishlist_item_id) references products(id) on delete cascade;

alter table wishlist_subscriptions
  drop constraint if exists wishlist_subscriptions_wishlist_item_id_fkey,
  add  constraint wishlist_subscriptions_wishlist_item_id_fkey
    foreign key (wishlist_item_id) references products(id) on delete cascade;


-- ─── 3. Comments: bench items are now products ────────────────────────────────
-- Add 'product' to the content_type CHECK and migrate existing bench comments.
-- 'wishlist_item' stays allowed during the code repoint (harmless superset).
alter table comments drop constraint if exists comments_content_type_check;
alter table comments add constraint comments_content_type_check
  check (content_type in ('review', 'guide', 'wishlist_item', 'product'));

update comments set content_type = 'product' where content_type = 'wishlist_item';

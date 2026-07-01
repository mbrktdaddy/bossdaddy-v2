-- ─────────────────────────────────────────────────────────────────────────────
-- 111 — Harden the product ↔ review link to a true 1:1 (Workspace unification
--       roadmap, Phase 4 — the root-debt fix).
--
-- Today there are TWO independent, un-enforced pointers that can silently drift:
--   • reviews.product_slug (text, nullable, NO FK, NO unique) — "this review is
--     about product X". Migration 018 deliberately skipped the FK.
--   • products.review_id  (uuid, FK → reviews.id ON DELETE SET NULL, added in
--     mig 100) — "product X's canonical review is R".
-- Only ONE write path (wishlist/[id]/promote) sets both together; every other
-- path touches one side, so drift is the DEFAULT. The public review page and the
-- bench page each rely on the two agreeing (reviews/[slug] reads BOTH; bench/[slug]
-- resolves via products.review_id). See the roadmap memo for the full audit.
--
-- DESIGN (decisions locked with operator 2026-06-30):
--   • reviews.product_slug is the SOURCE OF TRUTH ("the review declares its
--     product"); products.review_id becomes a maintained MIRROR.
--   • STRICTEST uniqueness: at most ONE top-level review per product, regardless
--     of status (draft/pending/approved). Re-reviews go through follow-ups, which
--     are EXEMPT — follow-ups inherit the parent's product_slug on purpose
--     (schedule-followup/route.ts:244), so uniqueness is scoped to
--     parent_review_id IS NULL.
--   • Consistency is enforced by a DB TRIGGER (sync_products_review_id) so no
--     current or future write path can drift the mirror.
--
-- Ordering matters — the trigger is created LAST so the backfill UPDATEs below
-- don't fire it mid-migration.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Clean up dangling reviews.product_slug (before adding the FK) ─────────
-- Historical rows may point at a slug that no longer exists in products (mig 018
-- intentionally allowed this). The FK below would reject them, so null them out.
-- The public review page already degrades gracefully on a null product_slug.
update reviews
   set product_slug = null
 where product_slug is not null
   and product_slug not in (select slug from products);


-- ─── 2. Guard: no pre-existing duplicate top-level reviews per product ────────
-- The partial UNIQUE index in step 4 would fail on a dupe. Raise a clear,
-- actionable error listing offenders instead of a cryptic index-build failure so
-- the operator can decide which review is canonical (or convert one to a
-- follow-up) before re-running.
do $$
declare
  dupes text;
begin
  select string_agg(product_slug || ' (' || cnt || ' reviews)', ', ')
    into dupes
  from (
    select product_slug, count(*) as cnt
      from reviews
     where parent_review_id is null
       and product_slug is not null
     group by product_slug
    having count(*) > 1
  ) d;

  if dupes is not null then
    raise exception
      'Cannot enforce 1:1 product<->review: multiple top-level reviews share a product_slug: %. Resolve (delete/convert-to-followup/repoint) before applying migration 111.', dupes;
  end if;
end $$;


-- ─── 3. FK: reviews.product_slug → products.slug ─────────────────────────────
-- ON DELETE SET NULL mirrors the existing products.review_id behavior (deleting a
-- product gracefully clears the review's pointer instead of leaving a dangling
-- string). ON UPDATE CASCADE keeps the link intact when an admin renames a
-- product's slug (ProductUpdateSchema allows slug edits) — the rename propagates
-- to reviews.product_slug, and products.review_id (a uuid) is unaffected.
alter table reviews
  drop constraint if exists reviews_product_slug_fkey;
alter table reviews
  add constraint reviews_product_slug_fkey
    foreign key (product_slug) references products(slug)
    on update cascade on delete set null;


-- ─── 4. Partial UNIQUE: one top-level review per product ─────────────────────
-- Scoped to top-level, non-null rows — follow-ups (parent_review_id IS NOT NULL)
-- and editorial reviews (product_slug IS NULL) are exempt. This is what makes
-- products.review_id unambiguous: at most one review can claim any product.
create unique index if not exists reviews_one_toplevel_per_product
  on reviews (product_slug)
  where parent_review_id is null and product_slug is not null;


-- ─── 5. Reconcile products.review_id with the source of truth ────────────────
-- Clear mirrors that no longer agree with a top-level review, then (re)point each
-- product at the single top-level review that declares it. Order: clear first so
-- a drifted pointer can't survive, then set from the authoritative side.
update products p
   set review_id = null
 where review_id is not null
   and not exists (
     select 1 from reviews r
      where r.id = p.review_id
        and r.product_slug = p.slug
        and r.parent_review_id is null
   );

update products p
   set review_id = r.id
  from reviews r
 where r.product_slug = p.slug
   and r.parent_review_id is null
   and p.review_id is distinct from r.id;


-- ─── 6. Partial UNIQUE on products.review_id ─────────────────────────────────
-- Belt-and-suspenders: forbid two products claiming the same review. Replaces the
-- non-unique idx_products_review_id from mig 100 (the unique index serves the same
-- lookups). Guaranteed satisfiable after step 5 (product_slug is unique per
-- top-level review, product.slug is unique → the mapping is injective).
drop index if exists idx_products_review_id;
create unique index if not exists idx_products_review_id
  on products (review_id)
  where review_id is not null;


-- ─── 7. Consistency trigger: keep products.review_id in lockstep ─────────────
-- Fires whenever a review's product_slug or parent_review_id changes (and on
-- insert). reviews.product_slug is the source of truth; this maintains the
-- products.review_id mirror so no write path can drift it. It never writes back
-- to reviews, so there is no recursion (products has no reciprocal trigger).
create or replace function sync_products_review_id()
returns trigger as $$
begin
  -- Follow-ups never own a product's canonical review_id. If this row was
  -- previously top-level and had claimed a product, release it.
  if new.parent_review_id is not null then
    update products set review_id = null where review_id = new.id;
    return new;
  end if;

  -- Top-level: release any product that pointed here but no longer matches
  -- (product_slug was changed or cleared).
  update products
     set review_id = null
   where review_id = new.id
     and slug is distinct from new.product_slug;

  -- Point the matching product (if any) back at this review.
  if new.product_slug is not null then
    update products
       set review_id = new.id
     where slug = new.product_slug
       and review_id is distinct from new.id;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_products_review_id on reviews;
create trigger trg_sync_products_review_id
  after insert or update of product_slug, parent_review_id on reviews
  for each row execute function sync_products_review_id();

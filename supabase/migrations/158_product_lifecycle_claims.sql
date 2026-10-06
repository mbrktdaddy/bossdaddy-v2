-- ─────────────────────────────────────────────────────────────────────────────
-- 158 — Product lifecycle v2: claims only when set.
--
-- Operator doctrine (2026-10-06, docs/gear-radar-plan.md): the site makes a
-- claim about a product (in hand, testing, reviewed, provided by a brand) only
-- when he sets it, plus the disclosures the law requires. Showcasing a product
-- claims nothing. Four changes follow:
--
--   1. A private `catalog` stage, the new default: a product that exists for
--      buy links, gift guides or showcasing, with no public lane and no claim.
--      `considering` is retired: it promised the same thing as `radar` (seen,
--      not committed) but on the Bench. Its rows move to `catalog`.
--      Lifecycle: catalog | radar → queued → testing → reviewed | passed | archived
--
--   2. `reviewed` becomes a database fact. It was copied by hand from one API
--      route, and drifted: 3 products with reviews approved in May still read
--      "Testing Now" because mig 111's backfill linked them without touching
--      status. A trigger now advances the product whenever its top-level review
--      is approved, by any path (moderation, the scheduled-publish cron, SQL).
--
--   3. "How I got it" (`acquisition`) + `provided_by`: the industry-standard
--      way to record the relationship. A brand-provided or loaned unit is a
--      material connection the FTC requires disclosing next to the opinion.
--      Blank = no claim.
--
--   4. `product_testing_notes`: dated, public field notes on a product under
--      test ("Week 2: battery's holding up").
--
-- RLS: products stays public-read / admin-write (mig 042). The notes table is
-- Pattern A (public content): read `to anon, authenticated`, writes is_admin().
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Lifecycle: add catalog, retire considering ────────────────────────────
-- Order: widen the CHECK, move the rows, then narrow it.
alter table products drop constraint if exists products_status_check;
alter table products add constraint products_status_check
  check (status in ('catalog', 'radar', 'considering', 'queued', 'testing', 'reviewed', 'passed', 'archived'));

update products set status = 'catalog' where status = 'considering';

alter table products drop constraint products_status_check;
alter table products add constraint products_status_check
  check (status in ('catalog', 'radar', 'queued', 'testing', 'reviewed', 'passed', 'archived'));

-- The column default was still 'wishlist' (pre-mig-100), a value the CHECK
-- rejects. Every writer set status explicitly, so it never fired.
alter table products alter column status set default 'catalog';


-- ─── 2. reviewed = an approved top-level review exists ────────────────────────
-- Advances only from the pre-verdict stages. 'passed' and 'archived' are
-- deliberate operator decisions and are never overwritten.
--
-- SECURITY DEFINER: the approving writer may be a role whose products RLS
-- wouldn't allow the write; this derived field must not depend on who approved.
create or replace function advance_product_on_review_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved'
     and new.parent_review_id is null
     and new.product_slug is not null then
    update public.products
       set status = 'reviewed'
     where slug = new.product_slug
       and status in ('catalog', 'radar', 'queued', 'testing');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_advance_product_on_review_approval on reviews;
create trigger trg_advance_product_on_review_approval
  after insert or update of status, product_slug, parent_review_id on reviews
  for each row execute function advance_product_on_review_approval();

-- Backfill the drift (3 rows as of 2026-10-06).
update products p
   set status = 'reviewed'
  from reviews r
 where r.product_slug = p.slug
   and r.parent_review_id is null
   and r.status = 'approved'
   and p.status in ('catalog', 'radar', 'queued', 'testing');


-- ─── 3. How I got it ──────────────────────────────────────────────────────────
alter table products
  -- null = no claim (the default; showcasing claims nothing).
  -- purchased = bought it. provided = a brand gave it (kept). loaner = sent back.
  add column if not exists acquisition text,
  -- Who provided it, when not the product's own brand (a retailer, a PR agency).
  -- The disclosure falls back to products.brand.
  add column if not exists provided_by text;

alter table products drop constraint if exists products_acquisition_check;
alter table products add constraint products_acquisition_check
  check (acquisition is null or acquisition in ('purchased', 'provided', 'loaner'));

alter table products drop constraint if exists products_provided_by_length;
alter table products add constraint products_provided_by_length
  check (provided_by is null or char_length(provided_by) <= 120);

comment on column products.acquisition is
  'How Boss Daddy got the unit: purchased | provided (brand gave it) | loaner (returned). Null = no claim. provided/loaner render the FTC material-connection disclosure.';
comment on column products.provided_by is
  'Who provided the unit when it is not products.brand. Used in the disclosure line.';


-- ─── 4. Testing notes ─────────────────────────────────────────────────────────
create table if not exists product_testing_notes (
  id          uuid        primary key default gen_random_uuid(),
  product_id  uuid        not null references products(id) on delete cascade,
  -- The day the note describes. "Week N" is derived from the product's first
  -- note, so nothing has to record when testing started.
  noted_on    date        not null default current_date,
  body        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint product_testing_notes_body_length
    check (char_length(btrim(body)) between 1 and 1000)
);

comment on table product_testing_notes is
  'Dated public field notes on a product under test ("Week 2: battery holding up"). Admin-authored, plain text.';

create index if not exists idx_product_testing_notes_product
  on product_testing_notes (product_id, noted_on desc, created_at desc);

drop trigger if exists trg_product_testing_notes_updated_at on product_testing_notes;
create trigger trg_product_testing_notes_updated_at
  before update on product_testing_notes
  for each row execute function touch_updated_at();

alter table product_testing_notes enable row level security;

drop policy if exists "product_testing_notes_read" on product_testing_notes;
create policy "product_testing_notes_read"
  on product_testing_notes for select
  to anon, authenticated
  using (true);

drop policy if exists "product_testing_notes_admin_write" on product_testing_notes;
create policy "product_testing_notes_admin_write"
  on product_testing_notes for all
  to authenticated
  using (is_admin())
  with check (is_admin());

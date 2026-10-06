-- ─────────────────────────────────────────────────────────────────────────────
-- 157 — "On the Radar": untested products, as the first product status.
--
-- See docs/gear-radar-plan.md. Radar = products Boss Daddy hasn't bought or
-- tested but finds cool/interesting, shown on /gear with a short honest take and
-- a "not tested" chip. It's the top of the existing pipeline, not a new table:
--   radar → considering → queued → testing → reviewed → passed / archived
-- Votes reuse wishlist_votes (already keyed to products.id), so a vote cast on
-- Radar carries over when the item moves to the Bench.
--
-- RLS: products is already public-read (`to anon, authenticated`, mig 042) with
-- admin-only writes, which is exactly right for Radar. No policy change.
--
-- PUBLISHING: products has no draft/visibility flag, so status = 'radar' is
-- live. Two guards follow from that:
--   • a Radar row MUST carry a take (CHECK below), so no empty card publishes;
--   • spotted_at doubles as the release time. Public queries filter
--     `spotted_at <= now()`, so setting a future spotted_at schedules the item
--     (the ~3-a-week cadence) with no extra column.
--
-- Existing rows: none are 'radar' yet, so both new CHECKs validate trivially.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Radar status ──────────────────────────────────────────────────────────
alter table products drop constraint if exists products_status_check;
alter table products add constraint products_status_check
  check (status in ('radar', 'considering', 'queued', 'testing', 'reviewed', 'passed', 'archived'));


-- ─── 2. Radar columns ─────────────────────────────────────────────────────────
alter table products
  -- The short take in the Boss Daddy voice: why a dad would care + one honest
  -- reservation. Never a testing claim. Kept after the item moves on, so the
  -- archive can still show what was said.
  add column if not exists radar_take text,
  -- When the product entered (or is scheduled to enter) On the Radar. Kept after
  -- it moves on, so /gear/radar can show the outcome (derived from the current
  -- status / review_id). Stamped by the trigger below; never hand-maintained.
  add column if not exists spotted_at timestamptz;

comment on column products.radar_take is
  'On the Radar take: short, honest, untested. Why a dad would care + one reservation. Never a testing claim.';
comment on column products.spotted_at is
  'When the product entered On the Radar (future = scheduled). Kept after it moves on so the archive can show the outcome.';


-- ─── 3. Invariants ────────────────────────────────────────────────────────────
-- Length cap for the card. Plain text; admin-authored.
alter table products drop constraint if exists products_radar_take_length;
alter table products add constraint products_radar_take_length
  check (radar_take is null or char_length(radar_take) <= 600);

-- status = 'radar' is live, so it must have something honest to say and a
-- release time. CHECKs run after BEFORE triggers, so the stamp below satisfies
-- the spotted_at half on every normal write.
alter table products drop constraint if exists products_radar_requires_take;
alter table products add constraint products_radar_requires_take
  check (
    status <> 'radar'
    or (radar_take is not null and btrim(radar_take) <> '' and spotted_at is not null)
  );


-- ─── 4. Stamp spotted_at on entry into Radar ──────────────────────────────────
-- A trigger, not app code: three paths write products (admin form, gear-candidate
-- adopt, research), and a stamp that relies on each remembering drifts.
--
-- Rules:
--   • INSERT as 'radar' with no spotted_at        → now()
--   • UPDATE into 'radar' from another status      → now(), so a product that
--     passed and comes back reads as freshly spotted, not months stale
--   • …unless the writer set spotted_at explicitly (scheduling a release)
--   • leaving 'radar' never touches spotted_at (the archive needs it)
create or replace function stamp_products_spotted_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status <> 'radar' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.spotted_at is null then
      new.spotted_at := pg_catalog.now();
    end if;
  elsif old.status is distinct from 'radar'
        and new.spotted_at is not distinct from old.spotted_at then
    new.spotted_at := pg_catalog.now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_products_spotted_at on products;
create trigger trg_products_spotted_at
  before insert or update of status, spotted_at on products
  for each row execute function stamp_products_spotted_at();


-- ─── 5. Index for the Radar query shape ───────────────────────────────────────
-- /gear lists live Radar items newest first; /gear/radar lists everything ever
-- spotted with its outcome. Partial: most products were never on Radar.
create index if not exists idx_products_spotted
  on products (spotted_at desc)
  where spotted_at is not null;

-- Migration 131: Move engagement counters off the content tables
-- Apply via: supabase db push  OR paste into Supabase SQL editor
-- DO NOT push automatically — applied manually by operator.
-- All blocks are idempotent — safe to re-run if a partial application failed.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY
--
-- `view_count` and the four `scroll_*_count` columns live ON the `reviews` /
-- `guides` rows. Both tables carry a BEFORE UPDATE trigger (`touch_updated_at()`,
-- migrations 001 + 003) that stamps `updated_at = now()` on ANY update. So a
-- page view is indistinguishable from an edit:
--
--   ViewTracker mounts → POST /api/{reviews,guides}/[id]/view
--     → increment_*_views → UPDATE ... SET view_count = view_count + 1
--       → touch_updated_at() → updated_at = now()
--
-- That poisons everything downstream of `updated_at`:
--   • lib/og.ts derives the og:image cache-buster from Date.parse(updated_at),
--     so every view minted a NEW social card URL. Social + CDN caches could
--     never hit, and every scrape paid a cold ~1.5s sharp render.
--   • app/sitemap.ts uses it as `lastModified` — the sitemap told Google that
--     every review and guide changed today, every day.
--   • article:modified_time / JSON-LD dateModified said the same.
-- Measured 2026-08-02: content published in April 2026 reported a modified
-- time of that morning.
--
-- Counters are telemetry, not content. Moving them to their own tables makes
-- `updated_at` mean "edited" BY CONSTRUCTION — no trigger special-casing and no
-- column allowlist to keep in sync as the schema grows.
--
-- Also fixes a second, pre-existing bug. `increment_scroll_depth` (migration
-- 026) still guarded on ('article','review') and updated a table named
-- `articles`. Migration 032 renamed articles→guides and 034 fixed the same
-- problem for comments/likes/content_revisions but MISSED this function. The
-- route sends 'guide', which failed the guard and returned silently — guide
-- scroll data has been frozen since 032, with no error surfaced anywhere.
--
-- Expand → repair → contract. This file is EXPAND: the old columns keep their
-- values and nothing reads the new tables yet. See 132 (repair) and 133 (drop).
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. Metrics tables (Pattern C — admin-only) ──────────────────────────────
-- The content id is BOTH primary key and foreign key: exactly one metrics row
-- per item, enforced, and it cascades away with the parent. Two tables rather
-- than one polymorphic (content_type, content_id) table because Postgres cannot
-- enforce a polymorphic FK — orphaned metrics rows are precisely the class of
-- quiet wrongness this migration exists to remove.

create table if not exists review_metrics (
  review_id        uuid        primary key references reviews (id) on delete cascade,
  view_count       integer     not null default 0,
  scroll_25_count  integer     not null default 0,
  scroll_50_count  integer     not null default 0,
  scroll_75_count  integer     not null default 0,
  scroll_100_count integer     not null default 0,
  -- Preserves the one genuinely useful signal `updated_at` was accidentally
  -- carrying, in a column where it means what it says.
  last_viewed_at   timestamptz,
  created_at       timestamptz not null default now()
);

create table if not exists guide_metrics (
  guide_id         uuid        primary key references guides (id) on delete cascade,
  view_count       integer     not null default 0,
  scroll_25_count  integer     not null default 0,
  scroll_50_count  integer     not null default 0,
  scroll_75_count  integer     not null default 0,
  scroll_100_count integer     not null default 0,
  last_viewed_at   timestamptz,
  created_at       timestamptz not null default now()
);

-- Supports the dashboard's "top performers, most-viewed first" ordering.
-- The PK already indexes the id column — no redundant B-tree here.
create index if not exists idx_review_metrics_views on review_metrics (view_count desc);
create index if not exists idx_guide_metrics_views  on guide_metrics  (view_count desc);

alter table review_metrics enable row level security;
alter table guide_metrics  enable row level security;

-- Admin-only read. There is deliberately NO write policy: every write goes
-- through the SECURITY DEFINER RPCs below (which bypass RLS) or the
-- service-role client. Nothing public reads these — per the standing rule
-- against surfacing vanity metrics, view counts never appear on public pages.
drop policy if exists "review_metrics_admin_read" on review_metrics;
create policy "review_metrics_admin_read"
  on review_metrics for select
  to authenticated
  using (is_admin());

drop policy if exists "guide_metrics_admin_read" on guide_metrics;
create policy "guide_metrics_admin_read"
  on guide_metrics for select
  to authenticated
  using (is_admin());


-- ─── 2. Backfill from the existing columns ───────────────────────────────────
-- `on conflict do nothing` keeps this safe to re-run: a second pass will not
-- clobber counts the new RPCs have already started accumulating.

insert into review_metrics (
  review_id, view_count, scroll_25_count, scroll_50_count, scroll_75_count, scroll_100_count
)
select id, view_count, scroll_25_count, scroll_50_count, scroll_75_count, scroll_100_count
from reviews
on conflict (review_id) do nothing;

insert into guide_metrics (
  guide_id, view_count, scroll_25_count, scroll_50_count, scroll_75_count, scroll_100_count
)
select id, view_count, scroll_25_count, scroll_50_count, scroll_75_count, scroll_100_count
from guides
on conflict (guide_id) do nothing;


-- ─── 3. Rewrite the RPCs to write to the metrics tables ──────────────────────
-- Names and signatures are UNCHANGED so no application code has to move in
-- lockstep with this migration. Each guards on parent existence first: the old
-- `UPDATE ... WHERE id = row_id` silently affected zero rows for a stale id,
-- and an unguarded INSERT would instead raise a foreign-key violation — which
-- /api/track/scroll-depth surfaces as a 500. Keep the old silent no-op.
--
-- SECURITY DEFINER + `set search_path = public` (migration 006 predates that
-- convention and omitted it; 026 has it).

create or replace function increment_review_views(row_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from reviews where id = row_id) then
    return;
  end if;

  insert into review_metrics as m (review_id, view_count, last_viewed_at)
  values (row_id, 1, now())
  on conflict (review_id) do update
    set view_count     = m.view_count + 1,
        last_viewed_at = now();
end;
$$;

create or replace function increment_guide_views(row_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from guides where id = row_id) then
    return;
  end if;

  insert into guide_metrics as m (guide_id, view_count, last_viewed_at)
  values (row_id, 1, now())
  on conflict (guide_id) do update
    set view_count     = m.view_count + 1,
        last_viewed_at = now();
end;
$$;

-- Accepts ('review','guide'). The 'article' branch is gone — that value has not
-- existed since migration 034 renamed the stored content_type values, and its
-- presence here is exactly what silently killed guide scroll tracking.
create or replace function increment_scroll_depth(
  p_content_type text,
  p_content_id   uuid,
  p_milestone    integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_content_type not in ('review', 'guide') then
    return;
  end if;
  if p_milestone not in (25, 50, 75, 100) then
    return;
  end if;

  if p_content_type = 'review' then
    if not exists (select 1 from reviews where id = p_content_id) then
      return;
    end if;

    insert into review_metrics as m (
      review_id,
      scroll_25_count, scroll_50_count, scroll_75_count, scroll_100_count
    )
    values (
      p_content_id,
      (p_milestone =  25)::int, (p_milestone =  50)::int,
      (p_milestone =  75)::int, (p_milestone = 100)::int
    )
    on conflict (review_id) do update set
      scroll_25_count  = m.scroll_25_count  + (p_milestone =  25)::int,
      scroll_50_count  = m.scroll_50_count  + (p_milestone =  50)::int,
      scroll_75_count  = m.scroll_75_count  + (p_milestone =  75)::int,
      scroll_100_count = m.scroll_100_count + (p_milestone = 100)::int;

  else
    if not exists (select 1 from guides where id = p_content_id) then
      return;
    end if;

    insert into guide_metrics as m (
      guide_id,
      scroll_25_count, scroll_50_count, scroll_75_count, scroll_100_count
    )
    values (
      p_content_id,
      (p_milestone =  25)::int, (p_milestone =  50)::int,
      (p_milestone =  75)::int, (p_milestone = 100)::int
    )
    on conflict (guide_id) do update set
      scroll_25_count  = m.scroll_25_count  + (p_milestone =  25)::int,
      scroll_50_count  = m.scroll_50_count  + (p_milestone =  50)::int,
      scroll_75_count  = m.scroll_75_count  + (p_milestone =  75)::int,
      scroll_100_count = m.scroll_100_count + (p_milestone = 100)::int;
  end if;
end;
$$;

grant execute on function increment_review_views(uuid)                  to anon, authenticated;
grant execute on function increment_guide_views(uuid)                   to anon, authenticated;
grant execute on function increment_scroll_depth(text, uuid, integer)   to anon, authenticated;


-- ─── 4. Hygiene: the updated_at trigger on `guides` still has its old name ───
-- Migration 003 created `articles_updated_at`; migration 032 renamed the TABLE
-- articles→guides, which carries triggers across under their original names.
-- Matched by function rather than by name so this works whatever it is called.

do $$
declare
  t record;
begin
  for t in
    select tgname
    from pg_trigger
    where tgrelid = 'public.guides'::regclass
      and not tgisinternal
      and tgfoid = 'public.touch_updated_at()'::regprocedure
      and tgname <> 'guides_updated_at'
  loop
    execute format('alter trigger %I on public.guides rename to guides_updated_at', t.tgname);
  end loop;
end $$;

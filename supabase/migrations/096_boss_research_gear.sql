-- ─────────────────────────────────────────────────────────────────────────────
-- 096 — The Boss "gap fallback": researched (not tested) gear shortlist.
--
-- When a member asks for gear we haven't field-tested, The Boss can fall back to
-- a clearly-labeled "researched, not tested" shortlist (see lib/boss/tools/
-- research_gear.ts). This migration adds the catalog + capture plumbing:
--   1. products.status gains 'researched' — auto-seeded gap picks live here as
--      real catalog rows with a /go affiliate link, and auto-promote to a full
--      review when the founder later tests them (status flips to 'reviewed').
--   2. boss_research_requests — demand roadmap log (admin-only): which untested
--      gear members keep asking for, ranked by demand → tells the founder what to
--      test next where demand already exists.
--   3. boss_research_notify — "notify me when the Boss tests one" wait-list.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. products.status += 'researched' ──────────────────────────────────────
-- Existing values (migration 046): wishlist / testing / reviewed / passed /
-- archived. 'researched' is the new gap-fallback state. Internal name is stable
-- forever — display labels live in lib/labels.ts.
alter table products drop constraint if exists products_status_check;
alter table products add constraint products_status_check
  check (status in ('wishlist', 'testing', 'reviewed', 'passed', 'archived', 'researched'));


-- ─── 2. boss_research_requests — demand roadmap log (Pattern C, admin-only) ───
-- One row per gap query that triggered a researched fallback. Written by the
-- admin client from the tool handler (so it always lands regardless of caller),
-- read only by admins for the "most-requested untested" roadmap.
create table if not exists boss_research_requests (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references auth.users on delete set null,
  query         text        not null,
  category      text,
  fit           text,
  results_count integer     not null default 0,
  created_at    timestamptz not null default now()
);

-- Roadmap query: group recent gap queries by category / demand.
create index if not exists idx_boss_research_requests_recent
  on boss_research_requests (created_at desc);

alter table boss_research_requests enable row level security;

create policy "boss_research_requests_admin_all"
  on boss_research_requests for all
  to authenticated
  using (is_admin())
  with check (is_admin());


-- ─── 3. boss_research_notify — "notify me when tested" wait-list ──────────────
-- Email capture for a researched pick. Public INSERT (a member triggers it from
-- chat, but the email itself is the only thing we store — keep the gate light and
-- behind the API route's rate limit). No public SELECT; admins read the list to
-- batch the "we tested it" emails. user_id is denormalized when known.
create table if not exists boss_research_notify (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users on delete set null,
  email        text        not null,
  product_slug text,
  query        text,
  notified     boolean     not null default false,
  notified_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists idx_boss_research_notify_pending
  on boss_research_notify (product_slug, notified);

alter table boss_research_notify enable row level security;

-- Anyone may add themselves to the wait-list (the route rate-limits abuse).
create policy "boss_research_notify_insert"
  on boss_research_notify for insert
  to anon, authenticated
  with check (true);

-- Only admins read / manage the list.
create policy "boss_research_notify_admin_read"
  on boss_research_notify for select
  to authenticated
  using (is_admin());

create policy "boss_research_notify_admin_write"
  on boss_research_notify for update
  to authenticated
  using (is_admin())
  with check (is_admin());

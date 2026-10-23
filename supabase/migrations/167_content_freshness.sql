-- ─────────────────────────────────────────────────────────────────────────────
-- 167 — Content freshness (content pipeline plan, Phase 4)
--
-- WHY: the only "is this still true?" signal was a dashboard heuristic — a
-- top-level review untouched for 150 days. The author had no way to say
-- "revisit this in 60 days" while the plan was fresh, and nothing noticed when
-- a reviewed product left the catalog or a guide sat for a year. See
-- docs/content-pipeline-plan.md §7 and memory `project_premeditated_followup_scheduling`.
--
-- 1. `followup_intent_at` + `last_verified_at` on reviews + guides. Both are
--    EDITOR actions (set in the workspace), so they belong on the content row —
--    `touch_updated_at` stamping `updated_at` on a verify is correct. Nothing
--    the system records goes here (mig 131's rule).
-- 2. `content_freshness_flags` — what the weekly sweep found. The sweep owns
--    it as a reconciled set (upsert what holds, delete what no longer does), so
--    a page view or a dashboard load never writes to reviews/guides.
--    Pattern C: admin-only; the sweep + the dashboard use the service role.
--    No FK to the content rows — Postgres can't enforce a polymorphic one; the
--    sweep drops orphans on every pass instead.
-- ─────────────────────────────────────────────────────────────────────────────

alter table reviews
  add column if not exists followup_intent_at timestamptz,
  add column if not exists last_verified_at   timestamptz;

alter table guides
  add column if not exists followup_intent_at timestamptz,
  add column if not exists last_verified_at   timestamptz;

comment on column reviews.followup_intent_at is
  'Author-set date to revisit this review (30d/60d/6mo/1yr/custom at publish). Null = no plan; the sweep falls back to the 150-day heuristic.';
comment on column reviews.last_verified_at is
  'When the author last confirmed the review still stands. Verifying after followup_intent_at clears the due flag.';
comment on column guides.followup_intent_at is
  'Author-set date to refresh this guide in place. Null = no plan; the sweep falls back to the 12-month heuristic.';
comment on column guides.last_verified_at is
  'When the author last confirmed the guide is still current.';

-- ── The sweep's findings ─────────────────────────────────────────────────────

create table if not exists content_freshness_flags (
  id           uuid        primary key default gen_random_uuid(),
  content_type text        not null check (content_type in ('review', 'guide')),
  content_id   uuid        not null,
  -- followup-due        = followup_intent_at has passed and nothing was verified since
  -- product-unavailable = the reviewed product is archived in the catalog
  -- stale               = no intent set and the heuristic window has passed
  reason       text        not null check (reason in ('followup-due', 'product-unavailable', 'stale')),
  detail       text,
  -- First sighting (kept across sweeps) vs the sweep that last confirmed it.
  flagged_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (content_type, content_id, reason)
);

alter table content_freshness_flags enable row level security;

drop policy if exists "content_freshness_flags_admin_all" on content_freshness_flags;
create policy "content_freshness_flags_admin_all"
  on content_freshness_flags for all
  to authenticated
  using (is_admin())
  with check (is_admin());

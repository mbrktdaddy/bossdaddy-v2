-- Goals spine — the generalized goal / schedule / occurrence / entry model that
-- backs user-defined trackers: a smoking taper, daily vitamins or medication, a
-- workout program, a weight target, or a free-form reminder.
--
-- This is the "generalize savings_goals" step from the build-vs-buy decision,
-- built BESIDE savings rather than on top of it. Savings keeps its money-specific
-- participants/destinations/invitations machinery (078, 079, 104, 106) and can be
-- folded in later as kind='savings'; dragging that into this migration would have
-- doubled its surface for no user-visible gain.
--
-- FOUR LAYERS, ONE CRON
--   goals             the outcome  — kind, metric, target, deadline. No timing.
--   goal_schedules    the when     — RRULE + local wall clock + IANA zone.
--   goal_occurrences  materialized instances — the only thing the sweep scans.
--   goal_entries      the log      — what actually happened. Streaks derive here.
--   goal_deliveries   the outbox   — one row per (occurrence, channel). Idempotent.
--
-- ── FIVE DECISIONS ENCODED HERE ─────────────────────────────────────────────
--
-- 1. LOCAL WALL CLOCK + IANA ZONE, never a UTC hour.
--    savings_goals.reminder_hour_utc (078) has no zone and no minutes: an 8:00 am
--    vitamin reminder set in March fires at 7:00 am in November, and 8:30 is
--    unrepresentable. Schedules here store `local_time time` + `timezone text`,
--    and lib/goals/recurrence.ts resolves them to true UTC instants.
--
-- 2. THE ZONE LIVES ON THE SCHEDULE, NOT ON profiles.
--    `profiles` is `to anon, authenticated using (true)` (027, 043) — every
--    column is world-readable. A profiles.timezone column would publish every
--    member's approximate location to logged-out visitors for zero benefit.
--    Per-schedule is also more correct: a dad can keep a 6 am home-zone workout
--    while travelling.
--
-- 3. user_id IS DENORMALIZED onto every child table.
--    Deriving ownership through goal_id in a policy means a subquery per row,
--    and on any table that references itself it means recursive policy
--    evaluation — the problem migration 079 had to solve with the
--    is_savings_goal_participant() SECURITY DEFINER helper. A plain
--    `user_id = auth.uid()` needs no helper. The app writes both columns; the FK
--    to the parent keeps them consistent.
--
-- 4. PRIVATE USER DATA — NO is_admin(), ANYWHERE IN THIS FILE.
--    Medication schedules, cessation logs, and weight history are about as
--    private as this site gets. Admin is moderation-only (migs 106 savings + 107
--    everything else); cron and support reach these tables through the
--    service-role client, which bypasses RLS and is auditable.
--
-- 5. TWO IDEMPOTENCY KEYS, because both writers can retry.
--    unique (schedule_id, due_at)   — re-running the materializer can't duplicate
--                                     an occurrence.
--    unique (user_id, client_entry_id) — an offline log flushed twice from the
--                                     PWA queue can't double-count a dose.
--    unique (occurrence_id, channel)  — a cron retry or redeploy can't re-send a
--                                     reminder that already went out.


-- ════════════════════════════════════════════════════════════════════════════
-- 1. TABLES
-- ════════════════════════════════════════════════════════════════════════════

-- ── goals ───────────────────────────────────────────────────────────────────
-- The outcome. Carries no timing whatsoever — that's goal_schedules.
--
-- `kind` is a single-table discriminator, not a table per kind: the materializer
-- and sweep must not fork per goal type, or every new kind is a rebuild instead
-- of a row. Kind-specific extras go in `config` (validated by Zod at the API
-- edge, not by Postgres).
--
-- The target curve is what makes a taper or a training program work. A flat goal
-- leaves curve='none' and every occurrence inherits `target_value`. A taper sets
-- baseline_value=20, target_value=0, curve='linear' (or 'step' with
-- step_every_days=7) and the materializer writes a declining per-occurrence
-- target into goal_occurrences.target_value.

create table if not exists goals (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users on delete cascade,

  kind             text        not null
                               check (kind in ('reduce', 'adherence', 'program', 'metric', 'custom')),
  title            text        not null,
  description      text,

  -- What we measure. NULL for pure adherence goals ("took the vitamin").
  metric_key       text,                        -- 'cigarettes', 'weight', 'reps'
  metric_unit      text,                        -- 'per_day', 'lb', 'kg'
  direction        text        check (direction in ('down', 'up', 'hold')),

  -- Target curve.
  baseline_value   numeric(12,3),               -- where the user starts
  target_value     numeric(12,3),               -- where they're headed
  curve            text        not null default 'none'
                               check (curve in ('none', 'linear', 'step')),
  step_every_days  integer     check (step_every_days is null or step_every_days > 0),

  started_on       date        not null default current_date,
  target_date      date,

  config           jsonb       not null default '{}'::jsonb,

  status           text        not null default 'active'
                               check (status in ('active', 'paused', 'completed', 'archived')),
  completed_at     timestamptz,
  archived_at      timestamptz,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint goals_title_check
    check (length(trim(title)) > 0),

  -- A stepped curve needs a step length; linear interpolates over target_date.
  constraint goals_step_requires_interval
    check (curve <> 'step' or step_every_days is not null),

  -- Any curve needs both ends to interpolate between.
  constraint goals_curve_requires_endpoints
    check (curve = 'none' or (baseline_value is not null and target_value is not null))
);


-- ── goal_schedules ──────────────────────────────────────────────────────────
-- The when. One goal may own several: a workout program on MO/WE/FR plus a
-- Sunday weigh-in is one goal with two schedules, and the UI never makes the
-- user think in tables to express that.
--
-- `rrule` holds an RFC 5545 RRULE body with no DTSTART and no newline (both
-- rejected by assertValidSchedule in lib/goals/recurrence.ts and by the CHECKs
-- below — a stored newline could inject extra ICS properties into the string the
-- parser sees). The same string is the .ics export, so a subscribed calendar
-- cannot drift from the nudges.
--
-- `materialized_through` is the rolling-window pointer: the sweep tops schedules
-- up to ~60 days out and never re-expands history.

create table if not exists goal_schedules (
  id                   uuid        primary key default gen_random_uuid(),
  goal_id              uuid        not null references goals(id) on delete cascade,
  user_id              uuid        not null references auth.users on delete cascade,

  label                text,                    -- 'Weigh-in', 'Morning dose'
  rrule                text        not null,
  start_date           date        not null,
  local_time           time        not null,
  timezone             text        not null,     -- IANA, e.g. 'America/New_York'

  -- Nudge shaping.
  lead_minutes         integer     not null default 0
                                   check (lead_minutes between 0 and 1440),
  grace_minutes        integer     not null default 240
                                   check (grace_minutes between 0 and 10080),
  channels             text[]      not null default '{push,email}',
  muted                boolean     not null default false,

  materialized_through date,
  status               text        not null default 'active'
                                   check (status in ('active', 'paused', 'archived')),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  -- Mirrors the validation in lib/goals/recurrence.ts. Belt and braces: the app
  -- is the primary gate, but a bad rule reaching the cron is a 4 a.m. problem.
  -- chr()/strpos() rather than a '[\r\n]' regex: backslash escapes inside a
  -- bracket expression depend on standard_conforming_strings, and a CHECK that
  -- silently matches nothing is worse than no CHECK.
  constraint goal_schedules_rrule_single_line
    check (strpos(rrule, chr(10)) = 0 and strpos(rrule, chr(13)) = 0),
  constraint goal_schedules_rrule_no_dtstart
    check (rrule !~* 'DTSTART'),
  constraint goal_schedules_rrule_has_freq
    check (rrule ~* '(^|;)FREQ='),
  -- Sub-daily recurrence is a cron self-DoS: FREQ=MINUTELY over a 60-day window
  -- is ~86k occurrences for one schedule, and no reminder product needs it.
  constraint goal_schedules_rrule_freq_supported
    check (rrule ~* '(^|;)FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;|$)'),
  constraint goal_schedules_timezone_shape
    check (timezone ~ '^[A-Za-z][A-Za-z0-9_+-]*(/[A-Za-z0-9_+-]+)*$'),
  constraint goal_schedules_channels_known
    check (channels <@ array['push', 'email', 'inapp']::text[])
);


-- ── goal_occurrences ────────────────────────────────────────────────────────
-- One materialized instance. This is the only table the sweep scans, and the
-- only place per-instance state can live (snoozed to 9 pm, skipped, missed).
--
-- `due_at` is a true UTC instant. `local_date` is the user's calendar date in the
-- schedule's zone and is what streaks and "did I do it today" key on — never the
-- UTC date, or a dad who logs at 11 pm loses his streak the moment he travels.
--
-- `shifted` records that a spring-forward gap moved this occurrence off its
-- requested wall clock (02:30 doesn't exist, so it fires at 03:30). Surfacing it
-- lets the UI say "clocks changed" instead of appearing to fire at the wrong time.

create table if not exists goal_occurrences (
  id             uuid        primary key default gen_random_uuid(),
  goal_id        uuid        not null references goals(id) on delete cascade,
  schedule_id    uuid        not null references goal_schedules(id) on delete cascade,
  user_id        uuid        not null references auth.users on delete cascade,

  due_at         timestamptz not null,
  local_date     date        not null,
  local_time     time        not null,
  shifted        boolean     not null default false,

  -- Materialized point on the goal's curve. NULL for pure adherence.
  target_value   numeric(12,3),

  status         text        not null default 'pending'
                             check (status in ('pending', 'notified', 'completed',
                                               'skipped', 'missed', 'snoozed')),
  snoozed_until  timestamptz,
  resolved_at    timestamptz,

  created_at     timestamptz not null default now(),

  -- Re-running the materializer must be a no-op, not a duplicate nudge.
  -- (UNIQUE already indexes these two columns — no separate B-tree below.)
  unique (schedule_id, due_at),

  constraint goal_occurrences_snooze_requires_status
    check (status <> 'snoozed' or snoozed_until is not null)
);


-- ── goal_entries ────────────────────────────────────────────────────────────
-- The log. Append-oriented: one row per thing that happened. Streaks, charts,
-- and progress-against-curve are all derived from here — never stored as truth.
--
-- `occurrence_id` is NULL for unprompted logs ("I just weighed myself"), and
-- `on delete set null` keeps the history if a schedule is later deleted.
--
-- `client_entry_id` is generated by the CLIENT for offline logging: the PWA
-- queues entries in IndexedDB while offline and flushes later, and the unique
-- constraint makes a double flush a no-op instead of a double-counted dose.
-- Server-side writes just take the default.
--
-- `local_date` is computed on the client AT LOG TIME and sent with the payload.
-- Do not re-derive it at sync time: a dose logged at 11:40 pm and synced at 8 am
-- belongs to the night before.

create table if not exists goal_entries (
  id              uuid        primary key default gen_random_uuid(),
  goal_id         uuid        not null references goals(id) on delete cascade,
  occurrence_id   uuid        references goal_occurrences(id) on delete set null,
  user_id         uuid        not null references auth.users on delete cascade,

  local_date      date        not null,
  observed_at     timestamptz not null default now(),

  kind            text        not null default 'completed'
                              check (kind in ('completed', 'skipped', 'catchup',
                                              'relapse', 'measurement')),
  metric_key      text,
  value           numeric(12,3),
  note            text,

  source          text        not null default 'web'
                              check (source in ('web', 'push', 'email', 'boss',
                                                'offline_sync', 'import')),
  client_entry_id uuid        not null default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- Offline-queue idempotency. Scoped per user so a client-generated id can
  -- never collide across accounts.
  unique (user_id, client_entry_id),

  -- A measurement without a number is a no-op row.
  constraint goal_entries_measurement_needs_value
    check (kind <> 'measurement' or value is not null)
);


-- ── goal_deliveries ─────────────────────────────────────────────────────────
-- The outbox: one row per (occurrence, channel). Written by the cron through the
-- service-role client; the owner may read their own reminder history.
--
-- The unique constraint is the whole point — it makes the sweep idempotent, so a
-- retry, an overlapping invocation, or a redeploy mid-run cannot double-send.
-- The savings cron (app/api/cron/savings-reminders/route.ts) has no equivalent
-- and uses "has he logged anything this period?" as a de-facto dedupe, which
-- breaks the moment two invocations overlap.
--
-- Channel notes: 'push' goes through lib/push.ts (which already prunes dead
-- subscriptions on 404/410), 'email' through lib/email.ts, and 'inapp' INSERTs
-- into the existing `notifications` feed (082) rather than inventing a second one.

create table if not exists goal_deliveries (
  id            uuid        primary key default gen_random_uuid(),
  occurrence_id uuid        not null references goal_occurrences(id) on delete cascade,
  user_id       uuid        not null references auth.users on delete cascade,

  channel       text        not null check (channel in ('push', 'email', 'inapp')),
  status        text        not null default 'queued'
                            check (status in ('queued', 'sent', 'failed', 'suppressed')),
  attempts      integer     not null default 0,
  last_error    text,
  sent_at       timestamptz,
  created_at    timestamptz not null default now(),

  -- Idempotent sends. UNIQUE indexes the pair; no separate B-tree needed.
  unique (occurrence_id, channel)
);


-- ════════════════════════════════════════════════════════════════════════════
-- 2. INDEXES — shaped to the queries that actually run
-- ════════════════════════════════════════════════════════════════════════════

-- "This dad's active goals, newest first" — the dashboard list.
create index if not exists idx_goals_user
  on goals (user_id, status, created_at desc);

create index if not exists idx_goal_schedules_goal
  on goal_schedules (goal_id);

-- Materializer: "which active schedules need topping up?"
create index if not exists idx_goal_schedules_materialize
  on goal_schedules (materialized_through)
  where status = 'active' and muted = false;

-- THE sweep index. Partial, so it stays the size of the work queue rather than
-- the size of history — the difference between O(due) and O(all occurrences).
create index if not exists idx_goal_occurrences_due
  on goal_occurrences (due_at)
  where status = 'pending';

-- Re-arming snoozed occurrences.
create index if not exists idx_goal_occurrences_snoozed
  on goal_occurrences (snoozed_until)
  where status = 'snoozed';

-- The "Today" view and the missed-day sweep.
create index if not exists idx_goal_occurrences_user_date
  on goal_occurrences (user_id, local_date desc, due_at);

create index if not exists idx_goal_occurrences_goal_date
  on goal_occurrences (goal_id, local_date desc);

-- Streak + curve computation reads a goal's log in date order.
create index if not exists idx_goal_entries_goal_date
  on goal_entries (goal_id, local_date desc);

create index if not exists idx_goal_entries_user_date
  on goal_entries (user_id, local_date desc);

create index if not exists idx_goal_entries_occurrence
  on goal_entries (occurrence_id)
  where occurrence_id is not null;

-- Retry pass over the outbox.
create index if not exists idx_goal_deliveries_pending
  on goal_deliveries (created_at)
  where status in ('queued', 'failed');


-- ════════════════════════════════════════════════════════════════════════════
-- 3. TRIGGERS
-- ════════════════════════════════════════════════════════════════════════════

-- One function, attached to both mutable tables. Matches the per-domain
-- set_<table>_updated_at convention used since migration 078.
create or replace function set_goals_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_goals_updated_at on goals;
create trigger trg_goals_updated_at
  before update on goals
  for each row execute function set_goals_updated_at();

drop trigger if exists trg_goal_schedules_updated_at on goal_schedules;
create trigger trg_goal_schedules_updated_at
  before update on goal_schedules
  for each row execute function set_goals_updated_at();


-- ════════════════════════════════════════════════════════════════════════════
-- 4. ROW LEVEL SECURITY — enable before any policy references these tables
-- ════════════════════════════════════════════════════════════════════════════

alter table goals            enable row level security;
alter table goal_schedules   enable row level security;
alter table goal_occurrences enable row level security;
alter table goal_entries     enable row level security;
alter table goal_deliveries  enable row level security;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. POLICIES — Pattern B (private, user-owned) on all five.
--
-- `to authenticated` + `user_id = auth.uid()`. No `to anon`. No `is_admin()`:
-- these tables hold medication schedules, cessation logs, and weight history.
-- Admin is moderation-only (106 / 107); cron and support use the service-role
-- client, which bypasses RLS and is auditable.
-- ════════════════════════════════════════════════════════════════════════════

-- ── goals ───────────────────────────────────────────────────────────────────
create policy "goals_owner_read"
  on goals for select
  to authenticated
  using (user_id = auth.uid());

create policy "goals_owner_write"
  on goals for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── goal_schedules ──────────────────────────────────────────────────────────
create policy "goal_schedules_owner_read"
  on goal_schedules for select
  to authenticated
  using (user_id = auth.uid());

create policy "goal_schedules_owner_write"
  on goal_schedules for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── goal_occurrences ────────────────────────────────────────────────────────
-- Read + update only. INSERT/DELETE are deliberately unpoliced: occurrences are
-- derived state, materialized by the cron through the service-role client. A
-- client that could insert its own occurrences could manufacture a streak.

create policy "goal_occurrences_owner_read"
  on goal_occurrences for select
  to authenticated
  using (user_id = auth.uid());

-- Marking done / skipped / snoozed from the Today view or a one-tap link.
create policy "goal_occurrences_owner_update"
  on goal_occurrences for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── goal_entries ────────────────────────────────────────────────────────────
-- Full owner control: logging is the user's own act, and a mis-tap has to be
-- fixable. The append-only convention is an app-layer discipline, not a lock.

create policy "goal_entries_owner_read"
  on goal_entries for select
  to authenticated
  using (user_id = auth.uid());

create policy "goal_entries_owner_write"
  on goal_entries for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ── goal_deliveries ─────────────────────────────────────────────────────────
-- Owner-read only, so "why didn't I get reminded?" is answerable. No write
-- policy at all — the outbox is written exclusively by the cron via the
-- service-role client. Mirrors the notifications table (082).

create policy "goal_deliveries_owner_read"
  on goal_deliveries for select
  to authenticated
  using (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- 6. AFTER APPLYING
-- ════════════════════════════════════════════════════════════════════════════
--   • npm run db:types
--   • add the sweep to vercel.json: /api/cron/goals-sweep on "*/15 * * * *"
--     (hourly cannot express an 8:30 reminder — that's half the point of this
--     migration). Confirm CRON_SECRET is set in Vercel before the first deploy.
--   • the sweep must NOT copy savings-reminders' recipient lookup: it calls
--     admin.auth.admin.listUsers({ perPage: 1000 }) on every tick, which is
--     O(all users) per invocation and silently truncates past 1000 accounts.
--     Look up only the users who actually have due occurrences.
--   • display labels for this domain go in lib/labels.ts once the naming is
--     settled — the internal names above ("goals") are permanent either way.

-- Migration 135: derived goal stats in their own table
-- Apply via: supabase db push  OR paste into Supabase SQL editor
-- DO NOT push automatically — applied manually by operator.
-- All blocks are idempotent — safe to re-run if a partial application failed.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY A SEPARATE TABLE, NOT COLUMNS ON `goals`
--
-- `goals` carries a BEFORE UPDATE trigger (`set_goals_updated_at`, migration
-- 134) that stamps `updated_at = now()` on ANY update. Writing a recomputed
-- streak onto the goal row would therefore make every single log entry
-- indistinguishable from the user editing the goal — the exact bug migration 131
-- fixed for reviews/guides, where a page view minted a new og:image URL and told
-- Google the article had changed.
--
-- Nothing public reads `goals.updated_at` today, so the damage would be smaller
-- than 131's. But "derived numbers live off the entity row" is the rule that
-- prevented it, and re-learning it per table is how the first one happened.
--
-- WHY MATERIALIZE AT ALL
--
-- /goals computed streaks by loading up to 2,000 log entries across every goal
-- and folding them in memory. Correct, and fine at three goals — it's O(all
-- history) on a page a dad opens daily. Now the index reads one pre-computed row
-- per goal and the fold happens where the writes already are.
--
-- Recomputed on every log (Server Action + one-tap route) and at the end of each
-- sweep tick for the goals that tick touched, so nothing is ever staler than the
-- */15 cron. Everything here is DERIVED: dropping the table and letting it
-- rebuild loses nothing.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists goal_stats (
  -- Both primary key and foreign key: exactly one stats row per goal, enforced,
  -- and it cascades away with the parent. Same shape as review_metrics (131).
  goal_id          uuid        primary key references goals (id) on delete cascade,
  -- Denormalized so RLS is a flat owner check with no join, matching the rest of
  -- the goals spine.
  user_id          uuid        not null references auth.users on delete cascade,

  -- Consecutive days ending today (or yesterday — an unlogged today is grace,
  -- not a break). See lib/goals/progress.ts computeStreak.
  streak           integer     not null default 0,

  -- Completion over RESOLVED occurrences only. Pending days aren't misses, so a
  -- brand-new goal reads "no data" rather than 0%.
  logged_done      integer     not null default 0,
  logged_total     integer     not null default 0,

  -- Most recent measured value, for goals that measure something.
  latest_value     numeric(12,3),
  latest_local_date date,

  -- Anything unresolved and already due — drives the "Due" badge, which
  -- previously only noticed TODAY's occurrence and stayed silent on yesterday's
  -- missed one.
  open_count       integer     not null default 0,
  next_due_at      timestamptz,

  -- Today's curve target, stamped with the local date it was computed for. The
  -- reader compares that date against its own notion of today and only shows the
  -- number if they agree — a materialized "today" is wrong by construction the
  -- moment the day rolls over.
  today_local_date date,
  today_target     numeric(12,3),

  computed_at      timestamptz not null default now()
);

-- "All of this user's stats" — the index page's read.
create index if not exists idx_goal_stats_user
  on goal_stats (user_id);


alter table goal_stats enable row level security;

-- Pattern B, private user data. No `is_admin()` — these numbers describe
-- medication adherence and cessation progress.
create policy "goal_stats_owner_read"
  on goal_stats for select
  to authenticated
  using (user_id = auth.uid());

-- The owner may write their own row: the recompute runs inside their own Server
-- Action on the session client, and every value is re-derivable from the log they
-- already control. The sweep writes the same rows through the service-role
-- client, which bypasses RLS.
create policy "goal_stats_owner_write"
  on goal_stats for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ─── AFTER APPLYING ──────────────────────────────────────────────────────────
--   • npm run db:types
--   • no backfill needed: the first sweep tick recomputes every goal it touches,
--     and any goal without a stats row renders from its own live query until
--     then. Deleting rows here is always safe.

-- Migration 146: the metrics a habit tracker is expected to have
-- Apply via: supabase db push  OR paste into the Supabase SQL editor.
-- DO NOT push automatically — applied manually by the operator.
-- Every block is idempotent — safe to re-run if a partial application failed.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THESE FOUR
--
-- `goal_stats` (135) already caches the streak, the lifetime logged pair, the
-- latest value and the open count. Three things were missing that every tracker
-- in the field shows, and their absence isn't cosmetic:
--
--   longest_streak  A current streak alone means a man's best run is deleted by
--                   the day he breaks it. The number that survives a bad week is
--                   the one worth keeping.
--
--   rate_30d_*      `logged_done / logged_total` is LIFETIME, which makes it the
--                   one metric on the page that cannot recover: after a bad
--                   month, a perfect fortnight barely moves it. A rolling window
--                   answers "how am I doing NOW", which is the question being
--                   asked. Stored as a PAIR, not a percentage, for the same
--                   reason the lifetime pair is: 0 of 0 must render "no data"
--                   rather than 0%, and the reader wants "18 of 21" as the hint.
--
--   kept_total      All-time days kept. Votes are deliberately scoped to the
--                   current plan window (136) and therefore reset when a new plan
--                   starts; this is the companion number for a habit somebody has
--                   held for a year across three plans. It only ever goes up.
--
-- ⚠️ longest_streak MAY ONLY BE RAISED.
--   lib/goals/stats.ts writes it as max(stored, computed), and that guard is
--   load-bearing rather than defensive. The recompute folds a goal's FULL
--   occurrence and entry history today; the moment anyone caps those reads for
--   performance, an unguarded write would silently shorten a man's best run to
--   whatever fits in the window. Cheaper to make the column monotonic now than
--   to discover it from a support message later.
--
-- NO RLS CHANGES. `goal_stats_owner_read` / `goal_stats_owner_write` (135) and
-- `goal_stats_teammate_read` (137) are table-scoped, so new columns inherit them.
-- Still private user data: no is_admin() anywhere near this table.
--
-- NO BACKFILL. Everything here is derived. `refreshStaleStats` in lib/goals/sweep.ts
-- rewrites any goal whose stats row is missing or older than 90 minutes, which is
-- exactly the cold start it was written for — the defaults below are correct until
-- the sweep gets to each goal, and dropping rows here is always safe.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Best run ever, in scheduled days kept. Monotonic — see the note above.
alter table goal_stats add column if not exists longest_streak integer not null default 0;

-- Completion over the last 30 local days, over RESOLVED occurrences only. Same
-- shape as logged_done / logged_total so both render through one code path.
alter table goal_stats add column if not exists rate_30d_done  integer not null default 0;
alter table goal_stats add column if not exists rate_30d_total integer not null default 0;

-- All-time days kept (completed + catchup entries). Never decreases in practice;
-- not enforced, because deleting a mis-tapped entry legitimately lowers it.
alter table goal_stats add column if not exists kept_total integer not null default 0;

comment on column goal_stats.longest_streak is
  'Best run of consecutive KEPT SCHEDULED DAYS. Written as max(stored, computed) by lib/goals/stats.ts — this column may only be raised, so that capping the recompute''s history reads can never shorten a past best run.';
comment on column goal_stats.rate_30d_done is
  'Occurrences completed in the last 30 local days. Pair with rate_30d_total; a total of 0 means "no data", never 0%.';
comment on column goal_stats.rate_30d_total is
  'Occurrences RESOLVED in the last 30 local days. Pending and snoozed days are excluded — a day that has not happened is not a miss.';
comment on column goal_stats.kept_total is
  'All-time count of completed/catchup entries. The companion to plan-scoped votes (136), for a habit held across several plans.';

COMMIT;


-- ─── AFTER APPLYING ─────────────────────────────────────────────────────────
--   • npm run db:types
--   • no backfill; the next sweep tick (*/15) recomputes every goal it touches and
--     refreshStaleStats picks up the rest within 90 minutes. To force it for one
--     goal, log something on it — lib/goals/log.ts recomputes inline.
--   • the streak these feed is SCHEDULE-AWARE as of this change: a MO/WE/FR goal
--     counts consecutive scheduled days, not consecutive calendar dates. Existing
--     rows self-correct on the next recompute; nothing needs rewriting by hand.

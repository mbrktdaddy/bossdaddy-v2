-- ─────────────────────────────────────────────────────────────────────────────
-- Give a savings goal an owner timezone, so "today" means the same thing when
-- the streak is WRITTEN and when it is READ. Audit findings #5, #34, #60.
--
-- THE BUG
--   Contributions are stamped with the BROWSER's local date:
--   `ContributionButton.tsx` calls `todayYMDLocal()`, with a comment explaining
--   that a server-UTC stamp would file a late-evening contribution under
--   tomorrow. Correct — and the read path never got the same treatment.
--
--   `computeStats(goal, entries)` defaulted `asOf` to `new Date()`, and every
--   day-key inside `lib/dad-tools/savings.ts` is derived with `dateToYMD`,
--   which reads `getFullYear/getMonth/getDate` — i.e. the PROCESS zone, which
--   on Vercel is UTC. So after 17:00 Pacific the server already believes it is
--   tomorrow, yesterday's unit is uncovered and not current, and
--   `walkStreakAndBank` sets `streak = 0`.
--
--   A Pacific dad on a 14-day run opens his goal at 19:30 and reads "0 days".
--   `expectedTotalAsOf` counts an extra day in the same breath, so the catch-up
--   panel also tells him to double up. Every evening, 17:00–24:00 local.
--
--   The savings reminder cron has the same root cause from the other side
--   (#34): it compares `e.contributed_on` — a browser-local date — against
--   `isoYmd(now)`, a UTC one.
--
-- WHY A STORED ZONE AND NOT THE REQUEST HEADER
--   `x-vercel-ip-timezone` is available per request and needs no migration, but
--   it makes the streak a property of the VIEWER. A goal shared with a partner
--   in another zone would show two different streaks, and checking your own
--   goal from an airport would change it. A streak is a property of the goal.
--   The goals spine already settled this the same way — `goal_schedules.timezone`
--   (134:144) — and reusing that model is the point.
--
-- NULLABLE, WITH A REAL BACKFILL
--   No default. A wrong zone is worse than a known-absent one, and 'UTC' would
--   have silently preserved the bug for every existing row while looking fixed.
--   Instead the backfill takes the zone the user's own goals spine already
--   records — real data, not a guess. Rows that stay null fall back at read
--   time to the request header, then UTC, and new goals capture the zone on
--   create.
-- ─────────────────────────────────────────────────────────────────────────────

alter table savings_goals
  add column if not exists timezone text;

comment on column savings_goals.timezone is
  'IANA zone of the goal OWNER, e.g. America/Los_Angeles. Defines which calendar day a contribution counts for, so the streak is stable regardless of who is looking or where from. Null → caller falls back to the request zone, then UTC. Set on create from x-vercel-ip-timezone.';

-- Backfill from the same user''s most recent goal schedule. If they use the
-- goals spine at all, we already know their zone.
update savings_goals sg
   set timezone = latest.tz
  from (
    select g.user_id,
           gs.timezone as tz,
           row_number() over (partition by g.user_id order by gs.created_at desc) as rn
      from goal_schedules gs
      join goals g on g.id = gs.goal_id
  ) as latest
 where latest.user_id = sg.owner_id   -- savings_goals keys the owner as owner_id
   and latest.rn = 1
   and sg.timezone is null;

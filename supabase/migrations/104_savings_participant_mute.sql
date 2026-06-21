-- Migration 104 — Per-participant mute for savings goals
--
-- Until now, savings reminder emails (savings-reminders cron) and the
-- end-of-day spouse nudge (savings-spouse-nudge cron) were only controllable
-- at the GOAL level via savings_goals.reminder_enabled — and that flag is
-- owner-only. An invited participant (spouse/partner) had no way to silence a
-- goal's emails short of leaving the goal entirely. The email footer's "Turn
-- off reminders" link sent them to an owner-only edit page they couldn't act on.
--
-- This adds a per-participant `muted` flag. When true, BOTH email crons skip
-- that participant for that goal (and any future goal-scoped notifications
-- honor it too). It's self-service: the existing "self_update" RLS policy
-- already lets a participant update their own row, and "owner_manage" lets the
-- owner mute on someone's behalf — so no new policy is needed.

alter table savings_goal_participants
  add column if not exists muted boolean not null default false;

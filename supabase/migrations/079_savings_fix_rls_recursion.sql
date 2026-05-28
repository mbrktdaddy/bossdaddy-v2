-- Fix RLS recursion in the savings policies.
--
-- Migration 078's "peer_read" policy on savings_goal_participants does a
-- sub-SELECT against the same table to check peer membership, which re-
-- triggers the SELECT policy, which re-triggers the sub-SELECT, etc.
-- Postgres detects the loop and errors with:
--   "infinite recursion detected in policy for relation savings_goal_participants"
--
-- The fix mirrors the pattern migration 002 used for profiles + is_admin():
-- pull the membership lookup into a SECURITY DEFINER function so the inner
-- SELECT runs with the function owner's rights, bypassing RLS and breaking
-- the loop. The cross-table policies on savings_goals and savings_entries
-- benefit from the same helper.

-- ── Helper ──────────────────────────────────────────────────────────────────

create or replace function is_savings_goal_participant(_goal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from savings_goal_participants
    where goal_id = _goal_id and user_id = auth.uid()
  );
$$;

grant execute on function is_savings_goal_participant(uuid) to authenticated;

-- ── Re-create the affected policies using the helper ────────────────────────
--
-- We drop and recreate rather than alter because Postgres has no "alter
-- policy" syntax for USING clauses prior to PG15+ in all hosted environments.
-- DROP IF EXISTS keeps this idempotent.

-- savings_goals: read for owner OR participant OR admin
drop policy if exists "savings_goals participant_read" on savings_goals;
create policy "savings_goals participant_read"
  on savings_goals for select
  to authenticated
  using (
    owner_id = auth.uid()
    or is_savings_goal_participant(id)
    or is_admin()
  );

-- savings_goal_participants: read own row, or any peer row on the same goal
drop policy if exists "savings_participants peer_read" on savings_goal_participants;
create policy "savings_participants peer_read"
  on savings_goal_participants for select
  to authenticated
  using (
    user_id = auth.uid()
    or is_savings_goal_participant(goal_id)
    or is_admin()
  );

-- savings_entries: read for any participant of the goal, or admin
drop policy if exists "savings_entries participant_read" on savings_entries;
create policy "savings_entries participant_read"
  on savings_entries for select
  to authenticated
  using (
    is_savings_goal_participant(goal_id)
    or is_admin()
  );

-- savings_entries write: contributor_id must match auth.uid() AND user must
-- be a participant of the goal. Same helper, paired with the contributor check.
drop policy if exists "savings_entries self_write" on savings_entries;
create policy "savings_entries self_write"
  on savings_entries for all
  to authenticated
  using (
    contributor_id = auth.uid() or is_admin()
  )
  with check (
    (
      contributor_id = auth.uid()
      and is_savings_goal_participant(goal_id)
    )
    or is_admin()
  );

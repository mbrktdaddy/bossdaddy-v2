-- Scope admin out of private savings data — moderation-only admin doctrine.
--
-- Migrations 078 + 079 baked `or is_admin()` into EVERY savings RLS policy
-- (read + write) on savings_goals, savings_goal_participants,
-- savings_goal_invitations, and savings_entries. That gave the admin account
-- silent read/write of every user's private financial data — balances,
-- PayPal/Venmo destinations, contribution history — and leaked other users'
-- goals into the admin's own /tools/savings list (getGoals trusts RLS).
--
-- Savings is private, user-owned data. Admin powers belong at the ACCOUNT
-- layer (suspend/ban/delete — see account moderation) and on PUBLIC content
-- (reviews/guides/products), NOT inside a user's personal savings tool. Any
-- legitimate server/cron/support access already goes through the service-role
-- admin client (createAdminClient), which bypasses RLS entirely and is
-- auditable — so removing the in-policy admin override breaks nothing real.
--
-- This migration drops + recreates the affected policies WITHOUT `or
-- is_admin()`, leaving them strictly owner + invited-participant scoped. The
-- is_savings_goal_participant() SECURITY DEFINER helper (079) is preserved.
--
-- Doctrine going forward: `is_admin()` belongs only on public-content tables
-- and admin-only tables (moderation/audit) — NEVER on private user data.

-- ════════════════════════════════════════════════════════════════════════════
-- savings_goals
-- ════════════════════════════════════════════════════════════════════════════

-- Read: owner OR participant (no admin override)
drop policy if exists "savings_goals participant_read" on savings_goals;
create policy "savings_goals participant_read"
  on savings_goals for select
  to authenticated
  using (
    owner_id = auth.uid()
    or is_savings_goal_participant(id)
  );

-- Write: owner only
drop policy if exists "savings_goals owner_write" on savings_goals;
create policy "savings_goals owner_write"
  on savings_goals for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- savings_goal_participants
-- ════════════════════════════════════════════════════════════════════════════

-- Read: own row OR peer participant on the same goal
drop policy if exists "savings_participants peer_read" on savings_goal_participants;
create policy "savings_participants peer_read"
  on savings_goal_participants for select
  to authenticated
  using (
    user_id = auth.uid()
    or is_savings_goal_participant(goal_id)
  );

-- Manage (add/remove/change role): goal owner only
drop policy if exists "savings_participants owner_manage" on savings_goal_participants;
create policy "savings_participants owner_manage"
  on savings_goal_participants for all
  to authenticated
  using (
    exists (
      select 1 from savings_goals g
      where g.id = savings_goal_participants.goal_id and g.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from savings_goals g
      where g.id = savings_goal_participants.goal_id and g.owner_id = auth.uid()
    )
  );

-- NOTE: "savings_participants self_update" (078) has no admin override — left as-is.


-- ════════════════════════════════════════════════════════════════════════════
-- savings_goal_invitations
-- ════════════════════════════════════════════════════════════════════════════

-- Read: inviter OR goal owner (token lookup still happens via service role)
drop policy if exists "savings_invites owner_read" on savings_goal_invitations;
create policy "savings_invites owner_read"
  on savings_goal_invitations for select
  to authenticated
  using (
    inviter_id = auth.uid()
    or exists (
      select 1 from savings_goals g
      where g.id = savings_goal_invitations.goal_id and g.owner_id = auth.uid()
    )
  );


-- ════════════════════════════════════════════════════════════════════════════
-- savings_entries
-- ════════════════════════════════════════════════════════════════════════════

-- Read: any participant of the goal
drop policy if exists "savings_entries participant_read" on savings_entries;
create policy "savings_entries participant_read"
  on savings_entries for select
  to authenticated
  using (
    is_savings_goal_participant(goal_id)
  );

-- Write: contributor writes their OWN entries on goals they participate in
drop policy if exists "savings_entries self_write" on savings_entries;
create policy "savings_entries self_write"
  on savings_entries for all
  to authenticated
  using (
    contributor_id = auth.uid()
  )
  with check (
    contributor_id = auth.uid()
    and is_savings_goal_participant(goal_id)
  );

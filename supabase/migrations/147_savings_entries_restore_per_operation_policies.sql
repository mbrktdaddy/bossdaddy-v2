-- ─────────────────────────────────────────────────────────────────────────────
-- Restore migration 080's per-operation savings_entries policies, which
-- migration 106 silently reverted, and finish 106's own stated job.
--
-- WHAT WENT WRONG
--   079 created `savings_entries self_write` as a single `for all` policy.
--   080 dropped it and split it into `self_insert` / `self_update` /
--   `self_delete`, because Postgres applies WITH CHECK only to INSERT and
--   UPDATE — never to DELETE. Under the `for all` form the DELETE predicate
--   collapsed to `contributor_id = auth.uid()`, so a contributor REMOVED from
--   savings_goal_participants could still delete their historical rows from a
--   shared goal. 080's whole point was the participation check on DELETE.
--
--   106 — whose stated purpose was to strip is_admin() from savings writes —
--   RE-CREATED `savings_entries self_write` as `for all ... using
--   (contributor_id = auth.uid())` at :114-124. Permissive policies OR
--   together, so the effective DELETE predicate collapsed straight back to
--   `contributor_id = auth.uid()` and 080's fix was undone. Nothing after 106
--   touched these policies.
--
--   106 also never touched 080's three policies, so they still carry the
--   `or is_admin()` clauses that 106 existed to remove — meaning an admin's
--   ORDINARY SESSION CLIENT can still write any user's savings entries.
--   Savings is PRIVATE user data: Pattern B, owner-only, no admin override.
--   Legitimate admin/cron access goes through the service-role client.
--
-- WHAT THIS DOES
--   1. Drops `self_write` again — and this time it must not come back. If a
--      future migration needs to touch savings_entries writes, it edits the
--      three per-operation policies below; it does NOT add a `for all`.
--   2. Recreates insert/update/delete WITHOUT `or is_admin()`, completing 106.
--
-- No schema change, no data change — policies only.
-- Found as finding #1 in docs/audit-2026-08-16.md.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Remove the reverted catch-all ────────────────────────────────────────
-- ⚠️  DO NOT RE-CREATE THIS POLICY. A `for all` policy on this table cannot
--     express the DELETE participation check (WITH CHECK is not applied to
--     DELETE), and re-adding it silently re-opens the removed-contributor
--     hole. This is the second time it has been removed.
drop policy if exists "savings_entries self_write" on savings_entries;

-- ─── 2. Per-operation policies, owner-only (Pattern B — no is_admin()) ───────

-- INSERT: contributor must be the current user AND a participant of the goal.
drop policy if exists "savings_entries self_insert" on savings_entries;
create policy "savings_entries self_insert"
  on savings_entries for insert
  to authenticated
  with check (
    contributor_id = auth.uid()
    and is_savings_goal_participant(goal_id)
  );

-- UPDATE: constrained on both the pre-image (USING) and the post-image
-- (WITH CHECK) — blocks editing someone else's row, and blocks moving a row
-- onto a goal the user isn't part of.
drop policy if exists "savings_entries self_update" on savings_entries;
create policy "savings_entries self_update"
  on savings_entries for update
  to authenticated
  using (
    contributor_id = auth.uid()
    and is_savings_goal_participant(goal_id)
  )
  with check (
    contributor_id = auth.uid()
    and is_savings_goal_participant(goal_id)
  );

-- DELETE: the participation check here is the entire point. A contributor who
-- has been removed from the goal can no longer delete their history from it.
drop policy if exists "savings_entries self_delete" on savings_entries;
create policy "savings_entries self_delete"
  on savings_entries for delete
  to authenticated
  using (
    contributor_id = auth.uid()
    and is_savings_goal_participant(goal_id)
  );

-- Read policy is left as 106 set it (`participant_read`, any participant of
-- the goal) — that one is correct and is not touched here.

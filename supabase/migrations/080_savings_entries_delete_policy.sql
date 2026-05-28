-- Tighten savings_entries DELETE so a removed contributor can't wipe their
-- historical entries from a shared goal.
--
-- The original 079 policy was `for all` with:
--   using       (contributor_id = auth.uid() or is_admin())
--   with check  (contributor_id = auth.uid() and is_savings_goal_participant(goal_id) or is_admin())
--
-- Postgres applies WITH CHECK only to INSERT/UPDATE — not DELETE. So a
-- contributor who was removed from savings_goal_participants could still
-- DELETE rows they had previously inserted, because their old contributor_id
-- still matched the USING clause. Phase 3 risk: a removed spouse silently
-- nuking the shared goal's history.
--
-- Fix: split `for all` into explicit per-operation policies. DELETE now
-- requires the deleter to STILL be a participant of the goal.

drop policy if exists "savings_entries self_write" on savings_entries;

-- INSERT: contributor must be the current user AND a participant of the goal
create policy "savings_entries self_insert"
  on savings_entries for insert
  to authenticated
  with check (
    (
      contributor_id = auth.uid()
      and is_savings_goal_participant(goal_id)
    )
    or is_admin()
  );

-- UPDATE: same constraint, applied to both pre-image (USING) and post-image
-- (WITH CHECK). Prevents both editing someone else's row AND moving a row to
-- a goal the user isn't part of.
create policy "savings_entries self_update"
  on savings_entries for update
  to authenticated
  using (
    (
      contributor_id = auth.uid()
      and is_savings_goal_participant(goal_id)
    )
    or is_admin()
  )
  with check (
    (
      contributor_id = auth.uid()
      and is_savings_goal_participant(goal_id)
    )
    or is_admin()
  );

-- DELETE: same constraint. The participant check here is the entire point of
-- this migration — it blocks a removed contributor from deleting history.
create policy "savings_entries self_delete"
  on savings_entries for delete
  to authenticated
  using (
    (
      contributor_id = auth.uid()
      and is_savings_goal_participant(goal_id)
    )
    or is_admin()
  );

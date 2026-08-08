-- Migration 138: take the goal-share views away from `anon`
-- Apply via: supabase db push  OR paste into the Supabase SQL editor.
-- DO NOT push automatically — applied manually by the operator.
-- Idempotent — safe to re-run.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS EXISTS: A VERIFICATION FOUND MY ASSUMPTION WRONG
--
-- Migration 137 ends with `grant select on goal_share_summary to authenticated`
-- and the same for goal_share_days, written in the belief that naming one role
-- granted it to that role alone. It doesn't. Supabase ships
--
--   alter default privileges in schema public
--     grant all on tables to anon, authenticated, service_role;
--
-- and that applies to VIEWS as well as tables — so both views were already
-- readable by `anon` the moment CREATE VIEW ran, and the explicit grant was
-- redundant rather than restrictive.
--
-- Caught by the post-apply check in 137's own AFTER APPLYING block: as `anon`,
--   select count(*) from goal_share_summary
-- returned 0 instead of erroring with permission denied. The ZERO was correct —
-- no data leaked — but it came from the view's WHERE clause, not from the grant.
--
-- WHY THAT'S WORTH A MIGRATION RATHER THAN A SHRUG
--
-- These are DEFINER views (137 §7, deliberately not security_invoker). A definer
-- view does not evaluate base-table RLS, so its WHERE clause is the ONLY thing
-- standing between a caller and `goals` / `goal_stats` / `goal_occurrences`. I
-- believed the grant was a second, independent gate. It wasn't — there was one
-- gate, and a single bad edit to a WHERE clause would have exposed both views to
-- logged-out traffic.
--
-- Revoking makes the privileges match the intent, so the grant becomes the
-- backstop it was supposed to be all along. Nothing needs this access: sharing is
-- member-only and both /goals/shared pages require a session.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

revoke all on goal_share_summary from anon;
revoke all on goal_share_days    from anon;

-- Re-assert the intended grant. Harmless if already present, and it keeps the
-- whole privilege story readable in one place.
grant select on goal_share_summary to authenticated;
grant select on goal_share_days    to authenticated;

COMMIT;


-- ─── AFTER APPLYING ─────────────────────────────────────────────────────────
--   • No `npm run db:types` needed — privileges only, no shape change.
--   • RE-RUN THE CHECK THAT CAUGHT THIS. It must now ERROR rather than return 0:
--
--       begin;
--       set local role anon;
--       select count(*) from goal_share_summary;
--       rollback;
--
--     Expect: permission denied for view goal_share_summary
--
--   • And confirm a real participant is unaffected — as `authenticated` with a
--     participant's sub, goal_share_summary must still return their shared goals.
--     A revoke aimed at the wrong role fails closed, which looks identical to
--     "sharing is broken".
--
--   • FUTURE VIEWS IN THIS SCHEMA INHERIT THE SAME DEFAULT. Any new definer view
--     that filters by caller must revoke from anon explicitly — naming
--     `authenticated` in a grant does not exclude anybody.

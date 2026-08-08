-- ═════════════════════════════════════════════════════════════════════════════
-- 141 — two fixes to migration 140
--
-- Functions only. No table, column, policy or index changes: 140's schema is
-- right, and both statements below are `create or replace`, so this applies on
-- top of a live 140 with no downtime and nothing to back-fill.
--
-- Both were reproduced against the real database before this file was written,
-- using the throwaway e2e accounts. A third suspected defect — that the DELETE
-- cascade would throw because NEW is unassigned in a DELETE trigger — was tested
-- and is NOT real: in a ROW-level DELETE trigger PL/pgSQL supplies NEW as a NULL
-- record, so `coalesce(old.user_a, new.user_a)` evaluates correctly. That line is
-- deliberately left as it was, with a comment, so the next reader doesn't
-- "fix" it either.
--
-- 1. THE INVITATION REVOKE WAS UNSCOPED — REPRODUCED.
--    140's cascade revoked every pending invitation on every goal owned by either
--    party. Ending one relationship called back invitations addressed to
--    uninvolved third parties. Verified: a pending invite to
--    someone-else@example.com on one of A's goals came back revoked after A and B
--    disconnected.
--
--    It cannot be scoped correctly, either. goal_invitations has no
--    invitee_user_id — only invitee_email, which is optional AND unverified — so
--    no column identifies who an invite is actually for. Removed entirely.
--
--    That leaves the hole it was reaching for: a stale token in an ex-partner's
--    inbox could re-establish participation the cascade had just removed. The
--    right gate is acceptInvitation() in lib/goals/participants.ts — already the
--    sole opt-in path, already refusing blocked pairs, and now requiring an
--    accepted connection. One check, at the one door, where the invitee's
--    identity is finally known.
--
-- 2. connection_state_with() LEAKED THE DECLINE.
--    It returned 'declined' to the requester, contradicting migration 140's own
--    rule 4 — a refusal is the decliner's business and is never announced. It now
--    reads 'pending_out' to the requester while the cooldown runs, then 'none'
--    once it lapses so they may ask again. The decliner sees 'none' throughout and
--    can reach out themselves if they change their mind.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─── 1. THE CASCADE, WITHOUT THE COLLATERAL DAMAGE ───────────────────────────

create or replace function drop_goal_participation_for_pair()
returns trigger as $$
declare
  -- Serves both AFTER DELETE and AFTER UPDATE. The coalesce is correct and
  -- tested: in a ROW-level DELETE trigger PL/pgSQL binds NEW to a NULL record
  -- (not an unassigned one), so new.user_a yields NULL rather than raising.
  -- The pair columns never change on UPDATE, so OLD-first is right either way.
  _a uuid := coalesce(old.user_a, new.user_a);
  _b uuid := coalesce(old.user_b, new.user_b);
begin
  -- The whole cascade, and deliberately only this. goal_entries.logged_by is
  -- ON DELETE SET NULL, so a departing partner never takes the owner's history.
  delete from goal_participants gp
   using goals g
   where gp.goal_id = g.id
     and ((g.user_id = _a and gp.user_id = _b) or (g.user_id = _b and gp.user_id = _a));

  -- NO goal_invitations UPDATE HERE. See the header: there is no column saying
  -- who an invitation is for, so any statement here hits bystanders. The stale-
  -- token risk is closed in acceptInvitation() instead.

  return null;
end;
$$ language plpgsql security definer set search_path = public;


-- ─── 2. THE STATE READ ───────────────────────────────────────────────────────

create or replace function connection_state_with(_other uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when auth.uid() is null or _other is null or _other = auth.uid() then 'none'
    when exists (
      select 1 from user_blocks
      where (blocker_id = auth.uid() and blocked_id = _other)
         or (blocker_id = _other and blocked_id = auth.uid())
    ) then 'blocked'
    else coalesce((
      select case
        when c.status = 'accepted' then 'accepted'
        -- A DECLINE IS SILENT (migration 140, rule 4). To the person who asked it
        -- still reads as waiting, until the cooldown lapses and they may ask
        -- again — at which point it reads as though nothing ever happened.
        -- Never 'declined' to the requester: that IS the rejection notice this
        -- design exists to not send.
        when c.status = 'declined' and c.requester_id = auth.uid() then
          case
            when c.declined_at + make_interval(days => connection_cooldown_days(c.decline_count)) > now()
              then 'pending_out'
            else 'none'
          end
        -- The decliner sees a clean slate and may reach out themselves.
        when c.status = 'declined' then 'none'
        when c.requester_id = auth.uid() then 'pending_out'
        else 'pending_in'
      end
      from user_connections c
      where c.user_a = least(auth.uid(), _other)
        and c.user_b = greatest(auth.uid(), _other)
    ), 'none')
  end;
$$;

grant execute on function connection_state_with(uuid) to authenticated;

-- ═════════════════════════════════════════════════════════════════════════════
-- 144 — invitations learn WHO they are for
--
-- One column on each invitation table, plus the two things that column finally
-- makes possible. Additive; no data is moved and nothing is dropped.
--
-- THE GAP. `goal_invitations` records an optional, unverified `invitee_email` and
-- nothing else. `savings_goal_invitations` is the same, and its create action even
-- RECEIVES an invitee user id — it just uses it to fire a notification and throws
-- it away. So an invitation has never known who it was for, and three separate
-- problems all trace back to that one missing fact:
--
--   1. DUPLICATE INVITES CAN'T BE DEDUPED for a member picked by name. Every mint
--      is another BEARER TOKEN and revocation is per-row, so inviting the same
--      person three times and calling one back leaves two links that still open
--      the door. The app can already dedupe by address; by member it has nothing
--      to match on.
--
--   2. MIGRATION 141'S CASCADE HAD TO GIVE UP. Ending a connection removes the
--      goal participation built on it, and should also call back any pending
--      invitation between those two people — otherwise a stale token in an
--      ex-partner's inbox re-establishes what was just ended. 140 tried, and
--      revoked every pending invitation on every goal the pair owned, hitting
--      uninvolved third parties; 141 removed the statement entirely because it
--      could not be scoped. Now it can.
--
--   3. ACCEPT TRUSTS THE BEARER TOKEN ALONE. Whoever opens the link becomes the
--      participant. Fine for a link you text someone; wrong for an invitation
--      addressed to a specific member, where we know the intended recipient and
--      should say so.
--
-- The column is NULLABLE and stays that way. A link invite with no named
-- recipient is a legitimate, first-class case — "make me something I can text" —
-- and must not be forced to name anyone.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─── 1. THE COLUMN ───────────────────────────────────────────────────────────

alter table goal_invitations
  add column if not exists invitee_user_id uuid references auth.users on delete cascade;

comment on column goal_invitations.invitee_user_id is
  'The member this invitation is FOR, when one was named (picked from contacts). NULL for a bare link invite, which is a legitimate case — the token is then the only addressing there is. Unlike invitee_email this is verified: it comes from a server-side contact lookup, never from a form field.';

alter table savings_goal_invitations
  add column if not exists invitee_user_id uuid references auth.users on delete cascade;

comment on column savings_goal_invitations.invitee_user_id is
  'The member this invitation is FOR. createInvite already accepted this and used it only to send a notification; storing it is what lets a repeat invite replace the earlier one instead of minting a second live token.';


-- ─── 2. CLEAN UP EXISTING DUPLICATES ─────────────────────────────────────────
-- Must run BEFORE the unique indexes below, or creating them fails on data that
-- already violates them. Keeps the NEWEST live invitation in each group and calls
-- the rest back — the newest is the one the owner most recently intended, and its
-- link is the one he most likely just sent.

with ranked as (
  select id,
         row_number() over (
           partition by goal_id, lower(invitee_email)
           order by created_at desc
         ) as rn
    from goal_invitations
   where invitee_email is not null
     and accepted_at is null
     and declined_at is null
     and revoked_at  is null
)
update goal_invitations gi
   set revoked_at = now()
  from ranked r
 where gi.id = r.id
   and r.rn > 1;


-- ─── 3. ONE LIVE INVITE PER RECIPIENT ────────────────────────────────────────
-- The app already revokes-then-mints, but an invariant enforced only by the
-- writer is a convention. These make it a rule.
--
-- Predicates use columns ONLY — no now(), which isn't immutable and can't be
-- indexed on. So "live" here means "no outcome recorded yet", which deliberately
-- includes an EXPIRED-but-un-revoked invite: re-inviting after an expiry must go
-- through the same revoke-then-mint path as any other repeat, and this index is
-- what forces that rather than leaving it to whoever writes the next call site.

create unique index if not exists goal_invitations_one_live_per_member
  on goal_invitations (goal_id, invitee_user_id)
  where invitee_user_id is not null
    and accepted_at is null
    and declined_at is null
    and revoked_at  is null;

-- lower() so casing can't be used to slip a second live invite past the first.
create unique index if not exists goal_invitations_one_live_per_email
  on goal_invitations (goal_id, lower(invitee_email))
  where invitee_email is not null
    and accepted_at is null
    and declined_at is null
    and revoked_at  is null;

-- NOTE: savings_goal_invitations gets NO equivalent index yet, deliberately. It
-- has no `revoked_at` — it expresses "called back" by moving `expires_at` into the
-- past — so the only column-based liveness predicate available is `used_at is
-- null`, which would treat a long-expired invite as live and permanently block
-- re-inviting that person. Fixing it properly means adding revoked_at there and
-- teaching four existing queries (countActive, claimMyPendingInvites, acceptInvite,
-- revokeInvite) to respect it. Its app-side dedupe covers the common case in the
-- meantime.


-- ─── 4. THE CASCADE 141 HAD TO ABANDON ───────────────────────────────────────
-- Now scopeable, so it comes back — narrowed to invitations actually addressed to
-- the other party. Compare migration 140, which revoked every pending invitation
-- on every goal either person owned and caught bystanders.
--
-- Email is matched too: an invitation addressed to the ex-partner's address is
-- the same stale key to the same door, whichever field it was written in.

create or replace function drop_goal_participation_for_pair()
returns trigger as $$
declare
  -- Serves both AFTER DELETE and AFTER UPDATE. The coalesce is correct and
  -- tested: in a ROW-level DELETE trigger PL/pgSQL binds NEW to a NULL record
  -- (not an unassigned one), so new.user_a yields NULL rather than raising.
  _a uuid := coalesce(old.user_a, new.user_a);
  _b uuid := coalesce(old.user_b, new.user_b);
begin
  -- The participation itself. goal_entries.logged_by is ON DELETE SET NULL, so a
  -- departing partner never takes the owner's history with them.
  delete from goal_participants gp
   using goals g
   where gp.goal_id = g.id
     and ((g.user_id = _a and gp.user_id = _b) or (g.user_id = _b and gp.user_id = _a));

  -- And any live invitation from one to the other, so a stale token can't undo it.
  update goal_invitations gi
     set revoked_at = now()
    from goals g
   where gi.goal_id = g.id
     and gi.accepted_at is null
     and gi.declined_at is null
     and gi.revoked_at  is null
     and (
       (g.user_id = _a and gi.invitee_user_id = _b) or
       (g.user_id = _b and gi.invitee_user_id = _a) or
       (g.user_id = _a and lower(gi.invitee_email) = (select lower(email) from auth.users where id = _b)) or
       (g.user_id = _b and lower(gi.invitee_email) = (select lower(email) from auth.users where id = _a))
     );

  return null;
end;
$$ language plpgsql security definer set search_path = public;

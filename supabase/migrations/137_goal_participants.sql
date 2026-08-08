-- Migration 137: accountability partners on the goals spine
-- Apply via: supabase db push  OR paste into the Supabase SQL editor.
-- DO NOT push automatically — applied manually by the operator.
-- Every block is idempotent — safe to re-run if a partial application failed.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS IS NOT A COPY OF THE SAVINGS PARTICIPANT MODEL
--
-- `savings_goal_participants` (078/079) has a binary role — owner | contributor —
-- and either way a participant sees the whole goal. That is fine when every field
-- on the row is a dollar figure toward a kid's bike.
--
-- The same switch here would expose every logged dose, every missed day, the
-- relapse entries, the free-text notes, and the identity statement — on goals
-- whose first vertical is cessation and medication.
--
-- THE DECIDING ARGUMENT IS NOT PRIVACY, IT'S DATA QUALITY. This product only works
-- if logging is honest, and migrations 134–136 deliberately made honesty the
-- rewarded behaviour: no target gate on votes, missed days silent, protective copy.
-- The moment a dad knows his wife sees the number, the incentive flips — he logs a
-- tidy 4 instead of a true 6, or he logs nothing. Full-visibility sharing would
-- undo the identity layer in one migration. There is also the case that is not
-- hypothetical: a controlling partner with per-dose visibility is a surveillance
-- tool, which is why leaving and revoking are both instant and unilateral below.
--
-- So visibility is GRADUATED, and the default is the least revealing thing that
-- still creates accountability. Accountability doesn't need the log — it needs
-- someone to know you're doing it and to notice if you stop.
--
--   cheer     the goal exists, the streak, the plan window. NO entries, NO
--             numbers, NO notes, NO relapses, NO identity statement.
--   witness   adds the per-day done/missed calendar. Still no numbers, no notes.
--   teammate  full read, and (in a LATER migration) may log on his behalf.
--
-- ⚠️ FOUR RULES ENCODED HERE ON PURPOSE. Each one is a thing a reasonable person
--    would "fix" later without knowing why it was built this way.
--
-- 1. NO PARTICIPANT EVER GETS A NOTIFICATION. Not now, not as a setting. A push
--    to his wife saying "he missed his meds" is the snitch product and the exact
--    surveillance failure this design exists to avoid. The sweep's recipient
--    lookup stays owner-only. Partners LOOK; that's the whole mechanic. Sharing
--    state changes (a partner leaving, a tier change) are visible IN-APP only, in
--    both directions — never pushed, never emailed.
--
-- 2. SENSITIVE GOALS CAP AT 'cheer'. Enforced by a trigger, not by trust: going
--    above cheer on a cessation or medication goal requires an explicit
--    per-participant acknowledgement (`sensitive_ack`) that the UI must earn by
--    naming what the partner will see. `sensitive` comes from goals.config, set
--    from the template at create time (migration 136).
--
-- 3. OPT-IN IS THE ONLY WAY IN, AND EITHER SIDE CAN END IT. Nobody is added
--    without accepting an invitation. `goal_participants` has NO insert policy —
--    the accept path verifies the token server-side. Both the participant and the
--    owner get their own DELETE policy, so leaving needs no approval and revoking
--    needs no notice.
--
-- 4. CHEER AND WITNESS NEVER TOUCH THE BASE TABLES. Every tier boundary here is a
--    COLUMN decision, and RLS is row-level: `goal_stats.latest_value` leaks the
--    count even at cheer, `goal_occurrences.target_value` leaks the day's number,
--    and `goals.identity_statement` is intimate. So those two tiers read only the
--    views at the bottom of this file.
--
--    The views are DEFINER views (the Postgres default, `security_invoker = false`)
--    and do their own authorization in the WHERE clause. This is deliberate and
--    NOT an oversight: an invoker view would evaluate base-table RLS as the
--    caller, which would require granting those tiers base-table access and defeat
--    the entire point of the view.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. WHO LOGGED IT
-- ════════════════════════════════════════════════════════════════════════════
--
-- `goal_entries.user_id` is denormalized OWNERSHIP and must stay the goal owner's
-- id — every policy and every one of the owner's own queries depends on it. So a
-- teammate's write needs a separate authorship column. Without it, "Kim logged my
-- dose" is indistinguishable from "I logged my dose" in a medication history,
-- permanently. `source` doesn't cover this: it records which SURFACE (web, push,
-- boss), not which person.
--
-- NULL means the owner logged it, which is every existing row.
--
-- ON DELETE SET NULL, not CASCADE: if the partner later deletes their account the
-- OWNER'S history must survive intact — deleting his logged days because someone
-- else left would corrupt his streaks and his votes. The entry stays, the departed
-- partner's identity is released.

alter table goal_entries
  add column if not exists logged_by uuid references auth.users on delete set null;

comment on column goal_entries.logged_by is
  'Who physically logged this entry. NULL = the goal owner (every pre-137 row). Set = a teammate participant. user_id stays the OWNER either way — that column is ownership, not authorship.';

-- Only useful for "what did this partner log", so keep it off the hot paths.
create index if not exists idx_goal_entries_logged_by
  on goal_entries (logged_by)
  where logged_by is not null;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. PARTICIPANTS
-- ════════════════════════════════════════════════════════════════════════════
--
-- The OWNER IS NOT A ROW HERE. Ownership is `goals.user_id` — savings puts its
-- owner in the participant table, which then needs every read to union two
-- concepts. An owner row in this table would be harmless but meaningless, and the
-- policies below never consult it for the owner's own access.

create table if not exists goal_participants (
  id             uuid        primary key default gen_random_uuid(),
  goal_id        uuid        not null references goals(id) on delete cascade,
  -- profiles, not auth.users: every surface that shows a partner needs the
  -- username and avatar, and profiles.id IS the auth.users id. Same choice
  -- savings made for the same reason.
  user_id        uuid        not null references profiles(id) on delete cascade,

  tier           text        not null default 'cheer'
                             check (tier in ('cheer', 'witness', 'teammate')),

  -- Set only when the owner has explicitly acknowledged what a partner will see
  -- on a sensitive goal. Enforced by the trigger below, not by convention.
  sensitive_ack  boolean     not null default false,

  invited_by     uuid        references auth.users on delete set null,
  joined_at      timestamptz not null default now(),
  created_at     timestamptz not null default now(),

  unique (goal_id, user_id)
);

comment on table goal_participants is
  'Accountability partners on a goal. Graduated visibility: cheer (streak only) < witness (per-day calendar) < teammate (full read, and later write). Opt-in via goal_invitations only; both the participant and the owner may DELETE a row unilaterally. Participants NEVER receive notifications — see migration 137 header.';

-- "Which goals am I watching?" — the shared-with-me list.
create index if not exists idx_goal_participants_user
  on goal_participants (user_id);

-- "Who's watching this goal?" is covered by the unique (goal_id, user_id) index.


-- ════════════════════════════════════════════════════════════════════════════
-- 3. INVITATIONS — opt-in, and declinable
-- ════════════════════════════════════════════════════════════════════════════
--
-- Mirrors the savings invite flow (078), which is proven: a single-use token
-- generated server-side, short expiry, and no client write path.
--
-- Three separate timestamps rather than one status enum, because each is a
-- different person's decision and the audit matters: the invitee accepted, the
-- invitee DECLINED, or the owner revoked before either. A declined invite is not
-- the same as an expired one, and neither should be silently reusable.

create table if not exists goal_invitations (
  id            uuid        primary key default gen_random_uuid(),
  goal_id       uuid        not null references goals(id) on delete cascade,
  invited_by    uuid        not null references auth.users on delete cascade,

  -- Audit-only, exactly as in savings: whether mail is actually sent depends on
  -- how the inviter chooses to share the link.
  invitee_email text,

  -- The tier being offered. The invitee sees this spelled out in plain words
  -- before accepting — that's the "informed" half of informed consent.
  tier          text        not null default 'cheer'
                            check (tier in ('cheer', 'witness', 'teammate')),

  token         text        not null unique,
  expires_at    timestamptz not null,
  accepted_at   timestamptz,
  declined_at   timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),

  -- An invitation can end exactly one way.
  constraint goal_invitations_single_outcome
    check (
      (accepted_at is not null)::int
      + (declined_at is not null)::int
      + (revoked_at  is not null)::int <= 1
    )
);

comment on table goal_invitations is
  'Single-use, expiring invitations to watch a goal. Token generated server-side; no client INSERT/UPDATE policy — the accept/decline paths run server-side. Declined and revoked are recorded separately from expired on purpose.';

create index if not exists idx_goal_invitations_goal
  on goal_invitations (goal_id, created_at desc);

-- The accept path's lookup is by token, which the UNIQUE constraint already
-- indexes. No second B-tree.


-- ════════════════════════════════════════════════════════════════════════════
-- 4. HELPERS
-- ════════════════════════════════════════════════════════════════════════════
--
-- SECURITY DEFINER because a policy on `goals` that reads `goal_participants`
-- (whose own policy reads `goals`) is recursive policy evaluation — the problem
-- migration 079 hit and solved the same way.
--
-- This is a KNOWING partial reversal of migration 134's decision 3, which
-- denormalized user_id onto every child table specifically to avoid needing a
-- helper. That decision still stands for the OWNER path: owner policies remain a
-- flat `user_id = auth.uid()` with no subquery, and the participant policies below
-- are ADDITIVE permissive policies. Postgres ORs permissive policies, so the
-- owner's fast path is byte-for-byte what it was before this migration.

create or replace function goal_owner_id(_goal_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select user_id from goals where id = _goal_id;
$$;

grant execute on function goal_owner_id(uuid) to authenticated;

create or replace function goal_participant_tier(_goal_id uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select tier from goal_participants
  where goal_id = _goal_id and user_id = auth.uid();
$$;

grant execute on function goal_participant_tier(uuid) to authenticated;

-- Tier comparison in one place, so no policy hand-rolls the ranking and gets it
-- backwards. Returns false for a non-participant.
create or replace function goal_tier_at_least(_goal_id uuid, _min text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    case goal_participant_tier(_goal_id)
      when 'teammate' then 3
      when 'witness'  then 2
      when 'cheer'    then 1
      else 0
    end
    >=
    case _min
      when 'teammate' then 3
      when 'witness'  then 2
      else 1
    end,
    false
  );
$$;

grant execute on function goal_tier_at_least(uuid, text) to authenticated;

-- Reads the flag migration 136 writes into goals.config from the template.
create or replace function goal_is_sensitive(_goal_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((config ->> 'sensitive')::boolean, false)
  from goals where id = _goal_id;
$$;

grant execute on function goal_is_sensitive(uuid) to authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. THE SENSITIVE CAP — a trigger, because a CHECK can't do this
-- ════════════════════════════════════════════════════════════════════════════
--
-- A CHECK constraint may not read another table (it would have to call a
-- non-immutable function, which Postgres rightly refuses). So the cap is a
-- BEFORE trigger. It fires on INSERT and on UPDATE, which is what stops the
-- obvious bypass: invite at cheer, then quietly promote to witness afterwards.

create or replace function enforce_goal_sensitive_share_cap()
returns trigger as $$
begin
  if new.tier <> 'cheer'
     and goal_is_sensitive(new.goal_id)
     and new.sensitive_ack is not true then
    raise exception
      'This goal tracks something sensitive. Sharing it above "cheer" needs an explicit acknowledgement of what the partner will see.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_goal_participants_sensitive_cap on goal_participants;
create trigger trg_goal_participants_sensitive_cap
  before insert or update on goal_participants
  for each row execute function enforce_goal_sensitive_share_cap();


-- ════════════════════════════════════════════════════════════════════════════
-- 6. RLS
-- ════════════════════════════════════════════════════════════════════════════

alter table goal_participants enable row level security;
alter table goal_invitations  enable row level security;

-- ── goal_participants ──────────────────────────────────────────────────────
-- Read: your own row, or every row on a goal you own. Deliberately NOT peer-read
-- (savings allows it): partners on a medication goal have no business enumerating
-- each other.

drop policy if exists "goal_participants_self_read" on goal_participants;
create policy "goal_participants_self_read"
  on goal_participants for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "goal_participants_owner_read" on goal_participants;
create policy "goal_participants_owner_read"
  on goal_participants for select
  to authenticated
  using (goal_owner_id(goal_id) = auth.uid());

-- NO INSERT POLICY. The only way in is accepting an invitation, which is verified
-- server-side (token validity, expiry, single-use, and the block check) before the
-- row is written with the service-role client. A client-side INSERT path would let
-- anyone add themselves to any goal they could name.

-- Tier changes are the owner's call. The trigger above still applies, so promoting
-- a sensitive goal's partner without an acknowledgement fails here too.
drop policy if exists "goal_participants_owner_update" on goal_participants;
create policy "goal_participants_owner_update"
  on goal_participants for update
  to authenticated
  using (goal_owner_id(goal_id) = auth.uid())
  with check (goal_owner_id(goal_id) = auth.uid());

-- ── BOTH SIDES CAN END IT, IMMEDIATELY AND ALONE ──────────────────────────
-- Two policies rather than one combined predicate, so each intent is legible and
-- neither can be dropped by accident while "simplifying" the other.

-- LEAVE. A participant removes themselves. No owner approval, no request, no
-- notification to anyone: needing permission to stop watching someone's
-- medication log would be its own kind of trap.
drop policy if exists "goal_participants_self_leave" on goal_participants;
create policy "goal_participants_self_leave"
  on goal_participants for delete
  to authenticated
  using (user_id = auth.uid());

-- REVOKE. The owner removes a participant. Silent by design — a "you were removed"
-- notification is a hazard in exactly the situation where revoking matters most.
drop policy if exists "goal_participants_owner_revoke" on goal_participants;
create policy "goal_participants_owner_revoke"
  on goal_participants for delete
  to authenticated
  using (goal_owner_id(goal_id) = auth.uid());


-- ── goal_invitations ───────────────────────────────────────────────────────
-- The owner sees the invitations he sent. The invitee reaches an invitation by
-- TOKEN through a server-side path, not by querying this table — an invitation is
-- addressed to an email that may not correspond to an account yet, so there is no
-- user_id to match on.

drop policy if exists "goal_invitations_owner_read" on goal_invitations;
create policy "goal_invitations_owner_read"
  on goal_invitations for select
  to authenticated
  using (goal_owner_id(goal_id) = auth.uid());

-- The owner may create and revoke his own invitations. Accept/decline are
-- server-side (they must also write goal_participants, which has no insert policy).
drop policy if exists "goal_invitations_owner_write" on goal_invitations;
create policy "goal_invitations_owner_write"
  on goal_invitations for insert
  to authenticated
  with check (
    goal_owner_id(goal_id) = auth.uid()
    and invited_by = auth.uid()
  );

drop policy if exists "goal_invitations_owner_revoke" on goal_invitations;
create policy "goal_invitations_owner_revoke"
  on goal_invitations for update
  to authenticated
  using (goal_owner_id(goal_id) = auth.uid())
  with check (goal_owner_id(goal_id) = auth.uid());


-- ── the spine's own tables ─────────────────────────────────────────────────
-- ONLY teammates get base-table reads. cheer and witness read the views in §7,
-- because their limits are per-COLUMN and RLS cannot express that.
--
-- goal_schedules and goal_deliveries get NO participant access at any tier: when
-- and how a man is reminded, and whether the email landed, is nobody else's
-- business. goal_templates is public content and needs nothing here.
--
-- COST OF THE ADDED PREDICATE: these policies are ORed with the owner's flat
-- check, so the helper only matters for rows the owner check rejects. Every real
-- read of a child table filters by a single `goal_id`, which makes the helper's
-- argument a constant the planner can evaluate once per statement rather than once
-- per row — the reason a per-row SECURITY DEFINER call isn't a problem on the goal
-- page's 400-entry read. A future query that scans entries across MANY goals
-- without a goal_id filter would lose that; there is no such query today.

drop policy if exists "goals_teammate_read" on goals;
create policy "goals_teammate_read"
  on goals for select
  to authenticated
  using (goal_tier_at_least(id, 'teammate'));

drop policy if exists "goal_occurrences_teammate_read" on goal_occurrences;
create policy "goal_occurrences_teammate_read"
  on goal_occurrences for select
  to authenticated
  using (goal_tier_at_least(goal_id, 'teammate'));

drop policy if exists "goal_entries_teammate_read" on goal_entries;
create policy "goal_entries_teammate_read"
  on goal_entries for select
  to authenticated
  using (goal_tier_at_least(goal_id, 'teammate'));

drop policy if exists "goal_stats_teammate_read" on goal_stats;
create policy "goal_stats_teammate_read"
  on goal_stats for select
  to authenticated
  using (goal_tier_at_least(goal_id, 'teammate'));

-- NOTE: a teammate's WRITE policies (logging on the owner's behalf, and deleting
-- only what they themselves logged) are deliberately NOT in this migration. A
-- write path onto another person's medication history deserves its own review
-- pass rather than riding along with six tables of new RLS. `logged_by` and the
-- 'teammate' tier are here so that change is additive and nothing gets rebuilt.


-- ════════════════════════════════════════════════════════════════════════════
-- 7. THE VIEWS — column-level privacy for cheer and witness
-- ════════════════════════════════════════════════════════════════════════════
--
-- DEFINER views (Postgres default). They authorize in the WHERE clause and expose
-- only safe columns. Do NOT convert these to `security_invoker = true`: that would
-- evaluate base-table RLS as the caller, which would require granting cheer and
-- witness direct access to `goals`, `goal_stats` and `goal_occurrences` — the
-- exact thing these views exist to prevent.

-- ── cheer and up ───────────────────────────────────────────────────────────
-- Enough to say "he's on day 24 and hasn't missed one this week". NOT enough to
-- say what he smoked on Tuesday.
--
-- OMITTED ON PURPOSE: identity_statement / identity_short (intimate, and his to
-- share in his own words), latest_value and today_target (both are the NUMBER),
-- metric_key/metric_unit (naming the unit implies the count), description and any
-- note (free text is unreviewable).
create or replace view goal_share_summary as
select
  g.id                as goal_id,
  g.user_id           as owner_id,
  g.title,
  g.kind,
  g.status,
  g.started_on,
  g.target_date,
  s.streak,
  s.logged_done,
  s.logged_total,
  s.open_count,
  goal_participant_tier(g.id) as my_tier
from goals g
left join goal_stats s on s.goal_id = g.id
where goal_tier_at_least(g.id, 'cheer');

comment on view goal_share_summary is
  'What an accountability partner sees at any tier: the goal, the plan window, and the streak. No numbers, no identity statement, no free text. Definer view — authorizes in its own WHERE clause; do not make it security_invoker.';

-- ── witness and up ─────────────────────────────────────────────────────────
-- The calendar, and only the calendar. `status` is collapsed so the shape of the
-- week is visible without leaking the reminder's plumbing: pending/notified/
-- snoozed all read as 'open', because "he snoozed it twice" is a detail a partner
-- has no need for.
--
-- OMITTED ON PURPOSE: target_value (the number), local_time and due_at (the
-- reminder's timing), and anything from goal_entries at all — an entry carries the
-- value and the note.
create or replace view goal_share_days as
select
  o.goal_id,
  o.local_date,
  case o.status
    when 'completed' then 'done'
    when 'skipped'   then 'skipped'
    when 'missed'    then 'missed'
    else 'open'
  end as day_state
from goal_occurrences o
where goal_tier_at_least(o.goal_id, 'witness');

comment on view goal_share_days is
  'The per-day done/missed calendar for witness and teammate participants. No values, no notes, no reminder times. Definer view — see goal_share_summary.';

grant select on goal_share_summary to authenticated;
grant select on goal_share_days    to authenticated;

COMMIT;


-- ─── AFTER APPLYING ─────────────────────────────────────────────────────────
--   • npm run db:types
--   • VERIFY THE OWNER PATH DIDN'T CHANGE: the new policies on goals /
--     goal_occurrences / goal_entries / goal_stats are additive and permissive, so
--     an owner with no participants must behave exactly as before. Load /goals and
--     a goal page as a normal member before trusting anything else here.
--   • VERIFY THE VIEWS REFUSE A STRANGER: as a signed-in member who is NOT a
--     participant, `select * from goal_share_summary` must return zero rows. A
--     definer view with a broken WHERE clause is a data leak, not a bug.
--   • The invite flow, the shared-with-me surface, and the sensitive-share
--     confirmation are app-layer and land next. Until they do, nothing writes to
--     goal_participants, so this migration is inert by design.
--   • Blocking: the accept path must refuse when either party has blocked the
--     other (`user_blocks`, migration 083). That check lives in the server-side
--     accept path, which is also where token validity and single-use are enforced.

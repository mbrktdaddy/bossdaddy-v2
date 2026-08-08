-- ═════════════════════════════════════════════════════════════════════════════
-- 140 — user_connections: one consent gate for every member-to-member feature
--
-- WHY THIS EXISTS
--
-- Until now this app had no concept of a relationship between two members. A DM
-- thread was the closest thing, and DM threads are unguarded: /api/members/search
-- returns every active member on the site, and get_or_create_dm (migration 083)
-- opens a thread with any of them, checked against nothing but user_blocks. So
-- "someone you already talk to" meant "anyone who once typed your name".
--
-- That surfaced while building the accountability-partner picker (migration 137).
-- You cannot honestly offer "invite a contact" until the app can say what a
-- contact IS. This is that: a request one member sends another, which the other
-- accepts, declines, or blocks. An ACCEPTED CONNECTION IS THE GATE for DMs, goal
-- partners, and anything participant-shaped added later — one answer to the
-- consent question rather than a new toggle per feature.
--
-- THE FIVE RULES THIS FILE ENFORCES, AND WHY EACH IS HERE AND NOT IN THE APP
--
-- 1. ONE ROW PER PAIR, ORDERED. user_a < user_b is a CHECK, not a convention.
--    Without it A→B and B→A both exist, and every question ("are we connected?")
--    becomes a two-branch query that some future call site will get half right.
--
-- 2. WRITES GO THROUGH FUNCTIONS. user_connections has NO INSERT and NO UPDATE
--    policy — the same stance goal_participants takes. Ordering, the self-request
--    refusal, blocks in both directions, the decline cooldown, and the
--    simultaneous-request merge all have to hold together as one decision. A
--    client-side insert can satisfy an RLS predicate and still violate four of
--    them.
--
-- 3. DECLINED ROWS PERSIST. They are what the cooldown is computed from. Deleting
--    a decline would make "no" mean "ask me again immediately", which is exactly
--    the person the decline button exists for.
--
-- 4. A DECLINE IS SILENT. Nothing in here notifies the requester, and nothing
--    should. An accept notifies; a refusal reads as rejection and is nobody's
--    business but the decliner's. From the requester's side a declined request
--    simply stops being pending.
--
-- 5. REMOVING A CONNECTION CASCADES to goal_participants. The connection is the
--    consent; withdrawing it withdraws what was built on top. Leaving a partner
--    watching your medication log after you have cut ties with them is the single
--    worst failure this feature could have, and it is not something to leave to an
--    app-layer call site remembering to clean up.
--
-- Private user-owned data — Pattern B. `to authenticated`, owner-scoped, and NO
-- is_admin() anywhere near it. Admin reaches this through the service-role client
-- if it ever needs to, which is auditable.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─── 1. THE TABLE ────────────────────────────────────────────────────────────

create table if not exists user_connections (
  -- Canonical ordered pair. See rule 1 above — the CHECK is the enforcement.
  user_a        uuid        not null references auth.users on delete cascade,
  user_b        uuid        not null references auth.users on delete cascade,

  -- Who asked. Needed to tell "waiting on you" from "waiting on them", and to
  -- decide who may respond. NOT derivable from the ordered pair.
  requester_id  uuid        not null references auth.users on delete cascade,

  status        text        not null default 'pending'
                            check (status in ('pending', 'accepted', 'declined')),

  -- Rule 3. Both columns drive the escalating cooldown in request_connection().
  declined_at   timestamptz,
  decline_count integer     not null default 0 check (decline_count >= 0),

  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  primary key (user_a, user_b),

  constraint user_connections_ordered
    check (user_a < user_b),

  -- An accepted row without a timestamp is a bug that only shows up months later
  -- in an ordering query, so refuse it at the door.
  constraint user_connections_accepted_has_timestamp
    check (status <> 'accepted' or accepted_at is not null),
  constraint user_connections_declined_has_timestamp
    check (status <> 'declined' or declined_at is not null)
);

comment on table user_connections is
  'Member-to-member connections. One row per pair, ordered user_a < user_b. An accepted row is the consent gate for DMs (migration 083 get_or_create_dm) and goal partners (migration 137). Writes only via request_connection/respond_to_connection — the table has no INSERT or UPDATE policy on purpose.';

comment on column user_connections.requester_id is
  'Who sent the request. Not derivable from the ordered pair, and it decides who is allowed to respond.';

comment on column user_connections.decline_count is
  'How many times this pair has been declined. Multiplies the re-request cooldown, so repeated refusals get progressively harder to ignore.';

-- The two hot query shapes: "my accepted connections" and "requests waiting on
-- me". The primary key already indexes (user_a, user_b) left-to-right, so only
-- the user_b lookup needs its own index.
create index if not exists idx_user_connections_b
  on user_connections (user_b, status);

create index if not exists idx_user_connections_a_status
  on user_connections (user_a, status);


-- ─── 2. PREFERENCES ──────────────────────────────────────────────────────────
-- Alongside the existing profiles.email_new_message. Both default to the
-- permissive value: a setting nobody knows to look for, defaulting to off, ships
-- the feature dark and reads as broken.

alter table profiles
  add column if not exists connection_requests_from text not null default 'everyone'
    check (connection_requests_from in ('everyone', 'nobody'));

alter table profiles
  add column if not exists discoverable_by_email boolean not null default true;

comment on column profiles.discoverable_by_email is
  'Whether an EXACT-match email lookup may surface this member in /api/members/search. Exact match only, ever — partial matching on an address is an enumeration surface, and the address is never returned in results.';


-- ─── 3. HELPERS ──────────────────────────────────────────────────────────────
-- Same shape as migration 137's goal_owner_id / goal_tier_at_least: sql,
-- security definer, pinned search_path, stable, granted to authenticated.

-- The gate. Every caller that asks "may these two interact" asks this.
create or replace function are_connected(_other uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from user_connections
    where status = 'accepted'
      and user_a = least(auth.uid(), _other)
      and user_b = greatest(auth.uid(), _other)
  );
$$;

grant execute on function are_connected(uuid) to authenticated;

-- What the UI should render. One call answers "Message" vs "Connect" vs
-- "Pending" vs nothing, so a button never has to stitch three queries together.
-- 'blocked' wins over everything: if either side has blocked, no other state is
-- worth reporting and reporting one would leak.
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
        when c.status = 'declined' then 'declined'
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


-- ─── 4. WRITES ───────────────────────────────────────────────────────────────
-- Rule 2. These are the only way a row is created or its status changed.

-- Days a decline holds, multiplied by how many times they've declined. First
-- refusal buys 30 days; a second buys 60. Long enough to be a real answer,
-- finite so a misclick isn't permanent.
create or replace function connection_cooldown_days(_decline_count integer)
returns integer
language sql
immutable
as $$
  select greatest(_decline_count, 1) * 30;
$$;

create or replace function request_connection(_other uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _me        uuid := auth.uid();
  _a         uuid;
  _b         uuid;
  _existing  user_connections%rowtype;
  _pref      text;
begin
  if _me is null then raise exception 'not authenticated'; end if;
  if _other is null or _other = _me then
    raise exception 'cannot connect with yourself';
  end if;
  if not exists (select 1 from profiles where id = _other) then
    raise exception 'user not found';
  end if;

  -- Blocks win, both directions, and the message is deliberately identical to
  -- the not-found case's tone: confirming a block to the blocked party is itself
  -- a leak.
  if exists (
    select 1 from user_blocks
    where (blocker_id = _me and blocked_id = _other)
       or (blocker_id = _other and blocked_id = _me)
  ) then
    raise exception 'blocked';
  end if;

  select connection_requests_from into _pref from profiles where id = _other;
  if _pref = 'nobody' then
    raise exception 'not accepting requests';
  end if;

  _a := least(_me, _other);
  _b := greatest(_me, _other);

  select * into _existing from user_connections where user_a = _a and user_b = _b;

  if found then
    if _existing.status = 'accepted' then
      return 'accepted';
    end if;

    if _existing.status = 'pending' then
      -- SIMULTANEOUS CROSS-REQUEST. They asked first and we're now asking them:
      -- that is two yeses, so merge rather than creating a second row (which the
      -- primary key forbids anyway) or erroring at someone who did nothing wrong.
      if _existing.requester_id <> _me then
        update user_connections
           set status = 'accepted', accepted_at = now(), updated_at = now()
         where user_a = _a and user_b = _b;
        return 'accepted';
      end if;
      return 'pending';   -- already ours; idempotent
    end if;

    -- status = 'declined' — rule 3's cooldown.
    if _existing.declined_at + make_interval(days => connection_cooldown_days(_existing.decline_count)) > now() then
      raise exception 'cooldown';
    end if;

    update user_connections
       set status = 'pending', requester_id = _me, updated_at = now()
     where user_a = _a and user_b = _b;
    return 'pending';
  end if;

  insert into user_connections (user_a, user_b, requester_id)
  values (_a, _b, _me);
  return 'pending';
end;
$$;

grant execute on function request_connection(uuid) to authenticated;

create or replace function respond_to_connection(_other uuid, _accept boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _me       uuid := auth.uid();
  _a        uuid;
  _b        uuid;
  _existing user_connections%rowtype;
begin
  if _me is null then raise exception 'not authenticated'; end if;

  _a := least(_me, _other);
  _b := greatest(_me, _other);

  select * into _existing from user_connections
   where user_a = _a and user_b = _b and status = 'pending';
  if not found then raise exception 'no pending request'; end if;

  -- Only the ADDRESSEE responds. The requester's verb is withdraw, which is a
  -- DELETE and has its own policy below.
  if _existing.requester_id = _me then
    raise exception 'you sent this request';
  end if;

  if _accept then
    update user_connections
       set status = 'accepted', accepted_at = now(), updated_at = now()
     where user_a = _a and user_b = _b;
    return 'accepted';
  end if;

  -- Rule 4: silent. Nothing is written anywhere the requester can see, and the
  -- row stays only so the cooldown has something to measure from.
  update user_connections
     set status        = 'declined',
         declined_at   = now(),
         decline_count = user_connections.decline_count + 1,
         accepted_at   = null,
         updated_at    = now()
   where user_a = _a and user_b = _b;
  return 'declined';
end;
$$;

grant execute on function respond_to_connection(uuid, boolean) to authenticated;


-- ─── 5. RLS ──────────────────────────────────────────────────────────────────

alter table user_connections enable row level security;

-- Read your own relationships and nobody else's. This is also what makes
-- "who is X connected to" unanswerable, which it should be.
drop policy if exists "user_connections_read" on user_connections;
create policy "user_connections_read"
  on user_connections for select
  to authenticated
  using (user_a = auth.uid() or user_b = auth.uid());

-- NO INSERT POLICY and NO UPDATE POLICY — rule 2. request_connection() and
-- respond_to_connection() are security definer and are the only writers.

-- Two DELETE policies rather than one predicate, mirroring migration 137's
-- self-leave / owner-revoke pair: the two acts are different things that happen
-- to compile to the same statement, and naming them separately is what makes an
-- audit of "who can end this" readable.
drop policy if exists "user_connections_withdraw" on user_connections;
create policy "user_connections_withdraw"
  on user_connections for delete
  to authenticated
  using (status = 'pending' and requester_id = auth.uid());

drop policy if exists "user_connections_either_side_removes" on user_connections;
create policy "user_connections_either_side_removes"
  on user_connections for delete
  to authenticated
  using (status = 'accepted' and (user_a = auth.uid() or user_b = auth.uid()));


-- ─── 6. THE CASCADE ──────────────────────────────────────────────────────────
-- Rule 5. Ending a connection ends the goal sharing that was built on it.
--
-- A trigger and not app code, deliberately: there are already three ways to end a
-- connection (withdraw, remove, block) and there will be more. Every one of them
-- has to clean up, and the one that forgets is the one that leaves an ex-partner
-- reading a medication log.
--
-- Silent on both sides, like every other exit in migration 137. Deleting the
-- participant row is all that's needed — goal_entries.logged_by is ON DELETE SET
-- NULL, so a departing partner never takes the owner's history with them.

create or replace function drop_goal_participation_for_pair()
returns trigger as $$
declare
  _a uuid := coalesce(old.user_a, new.user_a);
  _b uuid := coalesce(old.user_b, new.user_b);
begin
  delete from goal_participants gp
   using goals g
   where gp.goal_id = g.id
     and ((g.user_id = _a and gp.user_id = _b) or (g.user_id = _b and gp.user_id = _a));

  -- Pending invitations between the two are dead letters now; calling them back
  -- stops a stale token in someone's inbox re-establishing what was just ended.
  update goal_invitations gi
     set revoked_at = now()
    from goals g
   where gi.goal_id = g.id
     and gi.accepted_at is null and gi.revoked_at is null and gi.declined_at is null
     and g.user_id in (_a, _b);

  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_user_connections_cascade_delete on user_connections;
create trigger trg_user_connections_cascade_delete
  after delete on user_connections
  for each row execute function drop_goal_participation_for_pair();

drop trigger if exists trg_user_connections_cascade_decline on user_connections;
create trigger trg_user_connections_cascade_decline
  after update of status on user_connections
  for each row
  when (new.status = 'declined' and old.status = 'accepted')
  execute function drop_goal_participation_for_pair();

-- Blocking is the hardest form of ending it, so it ends everything: the
-- connection row goes, which fires the cascade above. Blocking someone you were
-- never connected to is a no-op here, which is correct — it still records the
-- block, and that's what keeps them out of search and out of request_connection.
create or replace function drop_connection_on_block()
returns trigger as $$
begin
  delete from user_connections
   where user_a = least(new.blocker_id, new.blocked_id)
     and user_b = greatest(new.blocker_id, new.blocked_id);
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_user_blocks_drop_connection on user_blocks;
create trigger trg_user_blocks_drop_connection
  after insert on user_blocks
  for each row execute function drop_connection_on_block();


-- ─── 7. THE DM GATE ──────────────────────────────────────────────────────────
-- Replaces migration 083's get_or_create_dm, adding the connection requirement
-- beside the existing block check. Everything else is byte-for-byte the original.
--
-- The exception string is distinguishable from 'blocked' on purpose:
-- lib/messaging.ts already maps 'blocked' to friendly copy by substring, and
-- "you're not connected yet" needs a different sentence and a different button.

create or replace function get_or_create_dm(_other_user uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  _me   uuid := auth.uid();
  _key  text;
  _conv uuid;
begin
  if _me is null then raise exception 'not authenticated'; end if;
  if _other_user = _me then raise exception 'cannot message yourself'; end if;
  if not exists (select 1 from profiles where id = _other_user) then
    raise exception 'user not found';
  end if;
  if exists (
    select 1 from user_blocks
    where (blocker_id = _me and blocked_id = _other_user)
       or (blocker_id = _other_user and blocked_id = _me)
  ) then
    raise exception 'blocked';
  end if;

  -- THE GATE.
  if not exists (
    select 1 from user_connections
    where status = 'accepted'
      and user_a = least(_me, _other_user)
      and user_b = greatest(_me, _other_user)
  ) then
    raise exception 'not connected';
  end if;

  _key := least(_me::text, _other_user::text) || ':' || greatest(_me::text, _other_user::text);
  select id into _conv from conversations where dm_key = _key;
  if _conv is null then
    insert into conversations (dm_key) values (_key) returning id into _conv;
    insert into conversation_participants (conversation_id, user_id)
      values (_conv, _me), (_conv, _other_user);
  end if;
  return _conv;
end;
$$;

grant execute on function get_or_create_dm(uuid) to authenticated;


-- ─── 8. GRANDFATHER EXISTING CONVERSATIONS ───────────────────────────────────
-- LAST, and it matters that it is last: section 7 just made an accepted
-- connection mandatory for messaging, so without this every live conversation on
-- the site becomes unreplyable the moment this migration lands.
--
-- One accepted connection per existing 1:1 thread, dated to when the thread
-- started. requester_id is whoever sorts first — the real answer is unknowable
-- from the schema, and nothing reads requester_id on an accepted row.
--
-- Both sides can remove these afterwards exactly like any other connection.

insert into user_connections (user_a, user_b, requester_id, status, accepted_at, created_at)
select least(a.user_id, b.user_id),
       greatest(a.user_id, b.user_id),
       least(a.user_id, b.user_id),
       'accepted',
       c.created_at,
       c.created_at
  from conversations c
  join conversation_participants a on a.conversation_id = c.id
  join conversation_participants b on b.conversation_id = c.id
 where c.dm_key is not null
   and a.user_id < b.user_id
on conflict (user_a, user_b) do nothing;

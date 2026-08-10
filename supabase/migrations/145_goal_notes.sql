-- Migration 145: goal notes — a private journal that becomes a conversation
-- Apply via: supabase db push  OR paste into the Supabase SQL editor.
-- DO NOT push automatically — applied manually by the operator.
-- Every block is idempotent — safe to re-run if a partial application failed.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT THIS IS
--
-- Free text on a goal today is per-EVENT only: goal_entries.note (134) and
-- savings_entries.note (078) hang off a single logged dose or contribution.
-- There is nowhere to write about the goal itself — "why I set this", "week 3
-- was rough" — and nowhere for a partner to answer.
--
-- One surface, two characters, decided by who can read it:
--
--   SOLO    a private journal. The owner writes; nobody else can read it.
--   SHARED  a conversation. Once partners hold thread_access, the same rows are
--           a back-and-forth, with unread state and notifications.
--
-- ⚠️ FIVE THINGS ENCODED ON PURPOSE. Each is something a reasonable person would
--    "fix" later without knowing why it is this way.
--
-- 1. THREAD ACCESS IS ORTHOGONAL TO TIER, AND THAT IS THE WHOLE DESIGN.
--    Migration 137 graduates what the SYSTEM reveals: cheer sees a streak,
--    witness adds a calendar, teammate sees the log. thread_access governs
--    something categorically different — what the OWNER CHOOSES TO TYPE. A
--    'cheer' partner who sees no numbers, no calendar and no entries can still
--    hold 'write' here and be fully in the conversation. Do not collapse these
--    two into one ladder: doing so either locks cheer partners out of the only
--    engagement surface they have, or drags the log along with the words.
--
-- 2. GRANTING ACCESS EXPOSES THE WHOLE HISTORY, DELIBERATELY.
--    There is no per-note visibility flag and no joined_at cutoff. A partner
--    granted access reads everything, including notes written while the goal was
--    solo. This was chosen over a cutoff so the owner never has to reason about
--    which of his own notes are which — but it makes the UI legible-warning
--    surface load-bearing, not decoration:
--      • the composer on an unshared goal says the history may be shared later
--      • the grant control names the COUNT before the owner confirms
--    Removing that copy turns a deliberate choice into a trap.
--
-- 3. SENSITIVE GOALS REQUIRE THE SAME ACKNOWLEDGEMENT AS A TIER BUMP.
--    Because of rule 2, granting thread_access on a cessation or medication goal
--    hands over free text the owner wrote believing he was alone — the most
--    intimate data in the product. §5 extends 137's existing trigger rather than
--    adding a second one, so the INSERT-and-UPDATE coverage (which closes the
--    invite-low-then-promote bypass) carries over for free.
--
-- 4. PARTICIPANTS DO GET NOTIFIED HERE. THIS IS NOT A REGRESSION OF 137 RULE 1.
--    Migration 137 says "NO PARTICIPANT EVER GETS A NOTIFICATION", and that rule
--    stands untouched for what it was written about: the SWEEP reporting on
--    BEHAVIOUR. A push to his wife saying "he missed his meds" is the snitch
--    product, and the sweep's recipient lookup remains owner-only — nothing in
--    this migration touches it.
--    A person choosing to type a sentence to you is the opposite act: authored by
--    a human, opted into by both sides, and carrying no logged data. Silence
--    there is not privacy, it is just a dead feed.
--    THE LINE IS: the system never reports on you; people may speak to you.
--    Keep note bodies OUT of push payloads (app layer) so the words themselves
--    stay behind the auth wall.
--
-- 5. POLYMORPHIC subject_id CARRIES NO FOREIGN KEY, SO §7 SWEEPS ORPHANS.
--    One table serves both the goals spine (134) and savings (078) because the
--    feed is identical on both and forking it means writing every query, action
--    and component twice. The cost is that Postgres cannot cascade the delete,
--    so goals and savings_goals each get an AFTER DELETE trigger. Without them a
--    deleted goal leaves private text readable by whoever next holds a colliding
--    id — orphaned private text is the worst kind of leak.
--
-- RLS is Pattern B throughout: `to authenticated`, owner/participant predicate,
-- and NO is_admin() anywhere (134 decision 4, and the 106/107 cleanup).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. THE PERMISSION
-- ════════════════════════════════════════════════════════════════════════════
--
-- Default 'none' so this migration is inert for every existing participant: no
-- one gains access to anything by applying it. The owner grants explicitly.
--
-- Carried on goal_invitations too, so the invitee reads what is being offered
-- BEFORE accepting — the informed-consent half of 137's invite flow, which
-- spells out the tier the same way.

alter table goal_participants
  add column if not exists thread_access text not null default 'none';

alter table goal_invitations
  add column if not exists thread_access text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'goal_participants_thread_access_check'
  ) then
    alter table goal_participants
      add constraint goal_participants_thread_access_check
      check (thread_access in ('none', 'read', 'write'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'goal_invitations_thread_access_check'
  ) then
    alter table goal_invitations
      add constraint goal_invitations_thread_access_check
      check (thread_access in ('none', 'read', 'write'));
  end if;
end $$;

comment on column goal_participants.thread_access is
  'Access to this goal''s notes feed: none | read | write. ORTHOGONAL TO tier on purpose — tier governs what the system reveals (numbers, calendar, log), this governs what the owner chooses to type. A cheer partner may hold write. See migration 145 rule 1.';

comment on column goal_invitations.thread_access is
  'The feed access being offered. Shown to the invitee in plain words before they accept, exactly as tier is.';

-- savings_goal_participants gets NO equivalent column. That model is already
-- full-visibility by design (078) — every participant sees every dollar — so
-- there is no lesser state for a notes feed to sit in. Membership IS write.


-- ════════════════════════════════════════════════════════════════════════════
-- 2. THE NOTES
-- ════════════════════════════════════════════════════════════════════════════
--
-- author_id references profiles, not auth.users: every rendered note needs a
-- username and avatar, and profiles.id IS the auth.users id. Same choice
-- goal_participants (137) and savings_goal_participants (078) made.
--
-- ON DELETE CASCADE on the author mirrors messages.sender_id (083): a departed
-- member's words leave with them. This differs on purpose from
-- goal_entries.logged_by, which is SET NULL — that column annotates the OWNER'S
-- history and deleting those rows would corrupt his streaks. A note is nobody's
-- record but its author's.
--
-- 4000 matches MAX_BODY in lib/messaging.ts.

create table if not exists goal_notes (
  id           uuid        primary key default gen_random_uuid(),

  subject_type text        not null check (subject_type in ('goal', 'savings_goal')),
  subject_id   uuid        not null,

  author_id    uuid        not null references profiles(id) on delete cascade,
  body         text        not null,

  edited_at    timestamptz,
  created_at   timestamptz not null default now(),

  constraint goal_notes_body_length
    check (length(btrim(body)) between 1 and 4000)
);

comment on table goal_notes is
  'Notes on a goal (goals spine 134) or a savings goal (078). Private journal while unshared; a conversation once partners hold thread_access. Polymorphic subject_id has no FK — §7 triggers sweep orphans. No is_admin() on any policy: this is private user data.';

-- The only read shape: one subject's notes, newest work at the bottom of the
-- feed but fetched newest-first for pagination.
create index if not exists idx_goal_notes_subject
  on goal_notes (subject_type, subject_id, created_at desc);

-- Account deletion has to find this user's notes across every subject.
create index if not exists idx_goal_notes_author
  on goal_notes (author_id);


-- ── goal_note_reads ─────────────────────────────────────────────────────────
-- Unread state, one row per (subject, reader). Same role as
-- conversation_participants.last_read_at (083): the unread count is
--   count(*) where created_at > last_read_at and author_id <> me
-- and it is what makes the badge on /goals and /tools/savings pull people back.
--
-- Not folded into goal_participants because (a) the OWNER has no row there, and
-- (b) savings participants live in a different table entirely. A standalone
-- read-marker keyed by subject serves all three readers with one shape.

create table if not exists goal_note_reads (
  subject_type text        not null check (subject_type in ('goal', 'savings_goal')),
  subject_id   uuid        not null,
  user_id      uuid        not null references auth.users on delete cascade,
  last_read_at timestamptz not null default now(),

  primary key (subject_type, subject_id, user_id)
);

comment on table goal_note_reads is
  'Per-reader last_read_at for a notes feed, backing the unread badge. Mirrors conversation_participants.last_read_at (083).';


-- ════════════════════════════════════════════════════════════════════════════
-- 3. THE ACCESS HELPER
-- ════════════════════════════════════════════════════════════════════════════
--
-- SECURITY DEFINER for the reason 079 established and 137 reused: a policy on
-- goal_notes that reads goal_participants (whose own policy reads goals) is
-- recursive policy evaluation. Same shape as goal_tier_at_least.
--
-- Returns 'none' | 'read' | 'write'. One function for both subject types so no
-- policy, action, or query hand-rolls the branch and gets one side wrong.
--
-- Savings: membership is write. savings_goal_participants holds the owner too
-- (078), so the participant check alone covers him — but the owner_id fallback
-- is kept so a goal whose owner row was never written is not silently locked out
-- of his own feed.
--
-- ⚠️ A BLOCK REVOKES ACCESS HERE, NOT JUST AT JOIN TIME.
--    blockUser() (lib/messaging.ts) writes only to user_blocks: it does not end
--    the connection, so migration 140's cascade onto goal_participants never
--    fires, and acceptInvitation's block check (137) already ran when they
--    joined. Without the check below, blocking a partner would leave them
--    reading and posting in the feed indefinitely. sendMessage re-checks
--    isBlockedBetween on EVERY send for exactly this reason; putting the
--    equivalent here rather than in the action means a block HIDES the feed
--    instead of merely refusing the write.
--
--    Blocks are evaluated against the OWNER, who is the hub of the conversation.
--    A block between two PARTNERS does not fragment the feed into per-viewer
--    slices — that way lies a thread nobody can reason about. If two partners
--    cannot be in the same room, the owner removes one.

create or replace function goal_note_access(_subject_type text, _subject_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  _me    uuid := auth.uid();
  _owner uuid;
begin
  if _me is null then return 'none'; end if;

  if _subject_type = 'goal' then
    select user_id  into _owner from goals         where id = _subject_id;
  elsif _subject_type = 'savings_goal' then
    select owner_id into _owner from savings_goals where id = _subject_id;
  else
    return 'none';
  end if;

  -- Deleted subject, or an id that never existed.
  if _owner is null then return 'none'; end if;

  if _owner = _me then return 'write'; end if;

  if exists (
    select 1 from user_blocks
    where (blocker_id = _me    and blocked_id = _owner)
       or (blocker_id = _owner and blocked_id = _me)
  ) then
    return 'none';
  end if;

  if _subject_type = 'goal' then
    return coalesce(
      (select thread_access from goal_participants
        where goal_id = _subject_id and user_id = _me),
      'none'
    );
  end if;

  -- Savings: membership IS write — 078 is full-visibility by design.
  if exists (
    select 1 from savings_goal_participants
    where goal_id = _subject_id and user_id = _me
  ) then
    return 'write';
  end if;

  return 'none';
end;
$$;

grant execute on function goal_note_access(text, uuid) to authenticated;

comment on function goal_note_access(text, uuid) is
  'Caller''s access to a notes feed: none | read | write. Definer to avoid recursive policy evaluation (see 079/137). The single source of truth for feed access — policies, server actions and the UI all read it.';


-- ════════════════════════════════════════════════════════════════════════════
-- 4. RLS
-- ════════════════════════════════════════════════════════════════════════════

alter table goal_notes      enable row level security;
alter table goal_note_reads enable row level security;

-- ── goal_notes ──────────────────────────────────────────────────────────────

drop policy if exists "goal_notes_read" on goal_notes;
create policy "goal_notes_read"
  on goal_notes for select
  to authenticated
  using (goal_note_access(subject_type, subject_id) <> 'none');

-- is_account_active() (083): a suspended account cannot post, same as DMs.
drop policy if exists "goal_notes_insert" on goal_notes;
create policy "goal_notes_insert"
  on goal_notes for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and goal_note_access(subject_type, subject_id) = 'write'
    and is_account_active(auth.uid())
  );

-- Edit your own words only. Deliberately NOT extended to the subject owner:
-- putting words in someone else's mouth is a different act from removing them.
--
-- ⚠️ THE WITH CHECK MUST RE-TEST ACCESS. `author_id = auth.uid()` alone is NOT
--    enough, and the hole it leaves is a text-injection vector into any feed on
--    the site:
--        insert ... (subject_id => a goal I own, author_id => me)
--        update goal_notes set subject_id = '<any other goal>'
--    Both USING and WITH CHECK pass on authorship alone, and the victim — who
--    owns that goal and therefore has 'write' on it — then reads the row through
--    goal_notes_read. A 'cheer' partner holding thread_access='none' reads the
--    goal UUID straight out of /goals/shared/[id], so this is reachable by
--    someone who cannot even see the feed they are writing into. §5a freezes the
--    parent columns as well; the predicate here is the belt to that's braces.
drop policy if exists "goal_notes_author_update" on goal_notes;
create policy "goal_notes_author_update"
  on goal_notes for update
  to authenticated
  using (author_id = auth.uid())
  with check (
    author_id = auth.uid()
    and goal_note_access(subject_type, subject_id) = 'write'
  );

-- Two DELETE policies rather than one predicate, so each intent is legible and
-- neither gets dropped while "simplifying" the other. Postgres ORs them.
drop policy if exists "goal_notes_author_delete" on goal_notes;
create policy "goal_notes_author_delete"
  on goal_notes for delete
  to authenticated
  using (author_id = auth.uid());

-- The owner moderates his own feed. He invited these people onto a goal about
-- his own recovery or his kid's savings; he must be able to remove something
-- said there without waiting for the author or for an admin.
drop policy if exists "goal_notes_subject_owner_delete" on goal_notes;
create policy "goal_notes_subject_owner_delete"
  on goal_notes for delete
  to authenticated
  using (
    case subject_type
      when 'goal' then
        exists (select 1 from goals where id = subject_id and user_id = auth.uid())
      when 'savings_goal' then
        exists (select 1 from savings_goals where id = subject_id and owner_id = auth.uid())
      else false
    end
  );

-- ── goal_note_reads ─────────────────────────────────────────────────────────
-- Flat Pattern B. A read marker is only ever about yourself; no cross-user read,
-- so nobody can see whether a partner has opened the feed. "Seen at 11:42pm" is
-- a pressure this product does not need.

drop policy if exists "goal_note_reads_owner" on goal_note_reads;
create policy "goal_note_reads_owner"
  on goal_note_reads for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════
-- 5a. A NOTE'S PARENT AND AUTHOR ARE IMMUTABLE; edited_at IS STAMPED, NOT SENT
-- ════════════════════════════════════════════════════════════════════════════
--
-- Two jobs, one BEFORE UPDATE trigger, because both are about the same thing:
-- an UPDATE may change the BODY and nothing else.
--
-- 1. Re-parenting is the injection vector described above the update policy. RLS
--    now refuses a move to a feed the author cannot write to, but that still
--    permits shuffling a note between two feeds he CAN write to — which would
--    silently rewrite the history of a shared conversation. There is no
--    legitimate reason to move a note, so the columns are simply frozen. Also
--    frozen: author_id (no forging who said it) and created_at (no back-dating
--    into a conversation).
--
-- 2. edited_at is STAMPED HERE rather than written by the app. A client-supplied
--    value can be omitted — "edited" would then be a claim the author opts into,
--    which is worthless on a surface where partners are reading each other. The
--    goals domain already stamps through a trigger (set_goals_updated_at, 134);
--    this follows it. NULL means never edited.

create or replace function guard_goal_note_update()
returns trigger as $$
begin
  if new.subject_type is distinct from old.subject_type
     or new.subject_id is distinct from old.subject_id then
    raise exception 'A note cannot be moved to a different goal.'
      using errcode = 'check_violation';
  end if;

  if new.author_id is distinct from old.author_id then
    raise exception 'A note cannot change author.'
      using errcode = 'check_violation';
  end if;

  new.created_at := old.created_at;
  new.edited_at  := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_goal_notes_guard_update on goal_notes;
create trigger trg_goal_notes_guard_update
  before update on goal_notes
  for each row execute function guard_goal_note_update();


-- ════════════════════════════════════════════════════════════════════════════
-- 5b. THE SENSITIVE CAP — extend 137's trigger, don't add a second one
-- ════════════════════════════════════════════════════════════════════════════
--
-- 137 §5 already refuses tier > 'cheer' on a sensitive goal without an explicit
-- sensitive_ack, on INSERT and on UPDATE. Adding thread_access to the same
-- condition inherits that UPDATE coverage, which is what closes the obvious
-- bypass: invite with no feed access, then quietly grant it afterwards.
--
-- Why free text needs the same gate as the log: rule 2 above. Granting access
-- hands over every note written while the goal was solo, and on a cessation or
-- medication goal that is the most revealing text in the product.
--
-- ⚠️ THIS BREAKS acceptInvitation() UNTIL IT IS UPDATED TOO.
--    lib/goals/participants.ts writes `sensitive_ack: tier !== 'cheer'`. An
--    invitation to a sensitive goal at tier='cheer' WITH thread_access='write'
--    therefore arrives with ack=false and this trigger refuses the accept — the
--    invitee gets a dead link. The condition there must become
--        tier !== 'cheer' || threadAccess !== 'none'
--    and setParticipantTier() must carry thread_access through the same UPDATE,
--    or a later grant hits the same wall. Both are done in this change set.
--
-- ⚠️ THE ACK IS PER-PARTICIPANT, NOT PER-GRANT. It is a column on the row, so a
--    partner already acked for a tier bump satisfies a later thread_access grant
--    with no second confirmation. That is inherited 137 behaviour, not new here,
--    but it matters more now: past that point the share page's "…and all N notes,
--    including the ones you wrote before today" copy is the ONLY thing standing
--    between the owner and handing over his private journal. Treat that string as
--    load-bearing.

create or replace function enforce_goal_sensitive_share_cap()
returns trigger as $$
begin
  if (new.tier <> 'cheer' or new.thread_access <> 'none')
     and goal_is_sensitive(new.goal_id)
     and new.sensitive_ack is not true then
    raise exception
      'This goal tracks something sensitive. Sharing it above "cheer", or opening its notes, needs an explicit acknowledgement of what the partner will see.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$ language plpgsql;

-- Trigger itself is unchanged from 137; re-created here only so a partial
-- application of this file still leaves it bound to the new function body.
drop trigger if exists trg_goal_participants_sensitive_cap on goal_participants;
create trigger trg_goal_participants_sensitive_cap
  before insert or update on goal_participants
  for each row execute function enforce_goal_sensitive_share_cap();


-- ════════════════════════════════════════════════════════════════════════════
-- 5c. REPORTING A NOTE
-- ════════════════════════════════════════════════════════════════════════════
--
-- abuse_reports (083) can point at a DM but had nowhere to point at a note. The
-- owner's DELETE policy lets him remove something said in his feed, but removing
-- it is not the same as escalating it: deletion is silent and leaves no record,
-- and the person who most needs the report route is the one being spoken to.
-- Every other place two members can address each other has this path; this one
-- should not be the exception.
--
-- SET NULL, matching message_id: the report survives the note being deleted,
-- which is precisely the case where the report still matters.

alter table abuse_reports
  add column if not exists goal_note_id uuid references goal_notes on delete set null;

comment on column abuse_reports.goal_note_id is
  'The reported note, when the report is about a goal notes feed rather than a DM. SET NULL so the report outlives the note.';


-- ════════════════════════════════════════════════════════════════════════════
-- 5d. UNREAD COUNTS, BATCHED
-- ════════════════════════════════════════════════════════════════════════════
--
-- /goals and /tools/savings render a card per goal, each wanting an unread
-- badge. Done per card that is one round trip per goal; done as a client-side
-- join it is two full table reads. One set-returning function keeps the list
-- pages at a single call regardless of how many goals a dad has.
--
-- Definer for the same reason as goal_note_access, and it calls it per subject
-- so the badge can never disagree with what the feed will actually show — a
-- count of notes you are not allowed to read would be its own small leak.
--
-- Own notes are excluded: your own writing is not unread.

create or replace function unread_note_counts(_subject_type text, _subject_ids uuid[])
returns table (subject_id uuid, unread integer)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  _me uuid := auth.uid();
begin
  if _me is null then return; end if;

  return query
  select s.id,
         (select count(*) from goal_notes n
           where n.subject_type = _subject_type
             and n.subject_id   = s.id
             and n.author_id   <> _me
             and n.created_at   > coalesce(r.last_read_at, '-infinity'::timestamptz)
         )::integer
    from unnest(_subject_ids) as s(id)
    left join goal_note_reads r
      on  r.subject_type = _subject_type
      and r.subject_id   = s.id
      and r.user_id      = _me
   where goal_note_access(_subject_type, s.id) <> 'none';
end;
$$;

grant execute on function unread_note_counts(text, uuid[]) to authenticated;

comment on function unread_note_counts(text, uuid[]) is
  'Unread note count per subject for the caller, for the badges on /goals and /tools/savings. Excludes the caller''s own notes and any subject they cannot read. One call per list page — do not loop this per card.';


-- ════════════════════════════════════════════════════════════════════════════
-- 6. REALTIME
-- ════════════════════════════════════════════════════════════════════════════
--
-- Matches messages (083) so a reply lands in an open feed without a refetch.
-- Subscribers still read through RLS, so a non-participant receives nothing.
-- Guarded: adding a table already in the publication is an error, not a no-op.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'goal_notes'
  ) then
    alter publication supabase_realtime add table goal_notes;
  end if;
end $$;


-- ════════════════════════════════════════════════════════════════════════════
-- 7. ORPHAN CLEANUP — the price of a polymorphic parent
-- ════════════════════════════════════════════════════════════════════════════
--
-- subject_id has no FK, so `delete from goals` leaves notes behind. Left alone
-- they are private text with no owner and no access path except a future
-- colliding id. One function, two triggers.
--
-- The reads table is swept alongside; a stale read marker is harmless but there
-- is no reason to keep one.

create or replace function delete_goal_notes_for_subject()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _type text := tg_argv[0];
begin
  delete from goal_notes      where subject_type = _type and subject_id = old.id;
  delete from goal_note_reads where subject_type = _type and subject_id = old.id;
  return old;
end;
$$;

drop trigger if exists trg_goals_delete_notes on goals;
create trigger trg_goals_delete_notes
  after delete on goals
  for each row execute function delete_goal_notes_for_subject('goal');

drop trigger if exists trg_savings_goals_delete_notes on savings_goals;
create trigger trg_savings_goals_delete_notes
  after delete on savings_goals
  for each row execute function delete_goal_notes_for_subject('savings_goal');

COMMIT;


-- ─── AFTER APPLYING ─────────────────────────────────────────────────────────
--   • npm run db:types
--
--   • VERIFY THE POLICIES REFUSE A STRANGER. A broken predicate on this table is
--     a leak of private journal text, not a bug. As a signed-in member who is
--     NOT the owner and NOT a participant:
--         select * from goal_notes;                     -- must be 0 rows
--     As a 'cheer' participant with thread_access='none':
--         select * from goal_notes where subject_id = '<goal>';   -- 0 rows
--     As a 'cheer' participant with thread_access='read':
--         select ...                                    -- rows visible
--         insert into goal_notes (...)                  -- must be REFUSED
--
--   • VERIFY THE INJECTION HOLE IS SHUT. As a 'cheer' partner with
--     thread_access='none' on someone else's goal — the worst case, because they
--     can read that goal's UUID off /goals/shared/[id]:
--         insert into goal_notes (subject_type, subject_id, author_id, body)
--           values ('goal', '<a goal I DO own>', auth.uid(), 'probe');
--         update goal_notes set subject_id = '<their goal>' where body = 'probe';
--     must RAISE ("cannot be moved"). Then confirm the victim sees no 'probe' row.
--
--   • VERIFY A BLOCK CUTS ACCESS. With a partner holding thread_access='write',
--     insert into user_blocks (blocker_id => owner, blocked_id => partner). As
--     that partner, goal_note_access must return 'none', the feed must read as 0
--     rows, and an insert must be REFUSED. Then delete the block and confirm it
--     all comes back — a block is reversible, not a tombstone.
--
--   • VERIFY edited_at IS STAMPED, NOT SENT. Update a note's body WITHOUT passing
--     edited_at; the column must be non-null afterwards. Try to set created_at to
--     last year in the same update; it must come back unchanged.
--
--   • VERIFY THE SENSITIVE GATE. On a goal with config->>'sensitive' = 'true':
--         update goal_participants set thread_access = 'write' where id = '<row>';
--     must RAISE. It must succeed only with sensitive_ack = true. Then accept a
--     real invitation to a sensitive goal at tier='cheer' with
--     thread_access='write' through the UI — that is the path the trigger change
--     breaks if lib/goals/participants.ts was not updated alongside it.
--
--   • VERIFY NOTHING CHANGED FOR EXISTING PARTICIPANTS. thread_access defaults to
--     'none', so every pre-145 partner must see no feed at all until the owner
--     grants it. Load a shared goal as a partner before trusting anything else.
--
--   • VERIFY THE ORPHAN SWEEP: delete a throwaway goal and confirm its
--     goal_notes and goal_note_reads rows are gone.
--
--   • THE SWEEP IS UNTOUCHED. app/api/cron/goals-sweep still resolves recipients
--     owner-only. If a change ever makes a participant receive a SWEEP nudge,
--     that is 137 rule 1 being broken — not this migration's notifications.

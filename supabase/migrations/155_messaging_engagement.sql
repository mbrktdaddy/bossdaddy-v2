-- ═════════════════════════════════════════════════════════════════════════════
-- 155 — the messaging engagement layer: mute, replies, reactions.
--
-- Three additive changes behind one review of /account/messages. Nothing is
-- dropped and nothing is backfilled.
--
--   1. MUTE, because BLOCK WAS THE ONLY LEVER and it is a cliff. The only way to
--      quiet a chatty-but-fine contact was to sever the relationship — which
--      cascades away goal participation too (migration 140's trigger). Mute is
--      SELF-DIRECTED, like savings_goal_participants.muted (104): it says "stop
--      pinging me", not "you may not speak to me". The thread stays, the history
--      stays, the badge and the pings stop.
--
--   2. reply_to_id, so a two-day-old question can be answered without quoting it
--      by hand.
--
--   3. message_reactions, the cheapest engagement mechanic in messaging: it turns
--      "I read it and have nothing to type" from a dropped thread into a closed
--      loop.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─── 1. MUTE ─────────────────────────────────────────────────────────────────
-- On the PARTICIPANT row, not the conversation: two people in one thread must be
-- able to disagree about whether it pings. Same column shape and same RLS as
-- deleted_at (084) — `conv_participants_self_update` already allows a user to
-- update their own row, so no new policy is needed.
--
-- Nullable timestamp rather than a boolean, matching deleted_at, because "when
-- did he mute this" is the question you want answered when someone reports that
-- notifications stopped working.

alter table conversation_participants
  add column if not exists muted_at timestamptz;

comment on column conversation_participants.muted_at is
  'Self-directed mute (155). When set, this participant is excluded from the unread badge count, web push, and the digest email for this conversation. The thread and its history stay fully visible — mute is not block. Enforced in lib/messaging-queries.ts (badge), lib/messaging-shared.ts (push), and app/api/cron/message-emails (email); all three must agree or a "muted" thread still pings.';


-- ─── 2. REPLIES ──────────────────────────────────────────────────────────────
-- ON DELETE SET NULL, not CASCADE: deleting a message must never delete the
-- replies to it. The UI renders a "message removed" stub for a null parent, which
-- is the honest thing to show and cannot be confused with a reply to nothing.
--
-- No CHECK that the parent is in the same conversation — a CHECK cannot subquery.
-- The server action enforces it (see sendMessage); the risk if it ever regressed
-- is a quoted stub the reader can't open, not a data leak, because the reply
-- preview is resolved from messages the reader can already SELECT under
-- messages_read.

alter table messages
  add column if not exists reply_to_id uuid references messages (id) on delete set null;

create index if not exists idx_messages_reply_to
  on messages (reply_to_id)
  where reply_to_id is not null;


-- ─── 3. REACTIONS ────────────────────────────────────────────────────────────
-- ⚠️ `kind` STORES A STABLE ASCII KEY, NOT THE EMOJI, and that is deliberate —
--    it is the naming doctrine (CLAUDE.md) applied to a glyph. Storing '👍'
--    would mean the DB's CHECK constraint had to match a specific unicode
--    sequence forever: '❤️' is U+2764 U+FE0F, and one missing variation selector
--    between the app constant and the constraint is a silent insert failure that
--    only reproduces for the one reaction. The key is the internal name, the emoji
--    is the display label, and lib/messaging-reactions.ts is the single map
--    between them. Swapping which glyph 'strong' renders as touches no data.
--
-- ONE REACTION PER PERSON PER MESSAGE — the primary key is (message_id, user_id)
-- with `kind` as a plain column, so tapping a different one REPLACES via upsert
-- and tapping the same one removes. That is the iMessage/WhatsApp model, and in a
-- 1:1 thread it keeps the row under a bubble to at most two chips. Slack's
-- many-reactions-per-person model would need the key to include `kind`; it is a
-- different product and a busier bubble.

create table if not exists message_reactions (
  message_id uuid        not null references messages on delete cascade,
  user_id    uuid        not null references auth.users on delete cascade,
  kind       text        not null check (kind in ('up', 'heart', 'laugh', 'strong', 'pray')),
  created_at timestamptz not null default now(),

  primary key (message_id, user_id)
);

comment on table message_reactions is
  'One reaction per member per DM message. `kind` is a stable ASCII key (up/heart/laugh/strong/pray) mapped to an emoji in lib/messaging-reactions.ts — never store the glyph. Private participant-scoped data: NO is_admin() in any policy here (migration 107 doctrine).';

-- The read shape is "every reaction on these messages", batched by message id.
-- The PK already indexes (message_id, user_id) left-to-right, so message_id
-- lookups are covered and a second index would be redundant.

-- ── The participant gate ─────────────────────────────────────────────────────
-- SECURITY DEFINER for the same reason is_conversation_participant is (083):
-- the policy needs to read `messages` to find the conversation, and doing that
-- inside a policy ON a table that joins back to messages is how RLS recursion
-- starts. `stable` so the planner can cache it per statement.

create or replace function is_message_participant(_message_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1
      from messages m
      join conversation_participants cp
        on cp.conversation_id = m.conversation_id
     where m.id = _message_id
       and cp.user_id = auth.uid()
  );
$$;
grant execute on function is_message_participant(uuid) to authenticated;

alter table message_reactions enable row level security;

-- PATTERN B, participant-scoped. NOT `user_id = auth.uid()` on read: the whole
-- point of a reaction is that the OTHER person sees it. So read mirrors
-- messages_read as migration 107 left it — participants only, no admin override.
create policy "message_reactions_read"
  on message_reactions for select
  to authenticated
  using (is_message_participant(message_id));

-- Write is narrower than read: mine only, on a message I can actually see, and
-- only while my account is active — the same three conditions messages_insert
-- carries, for the same reason. A suspended member must not be able to keep
-- poking someone via reactions after their sends are cut off.
create policy "message_reactions_insert"
  on message_reactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and is_message_participant(message_id)
    and is_account_active(auth.uid())
  );

create policy "message_reactions_update"
  on message_reactions for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and is_message_participant(message_id)
    and is_account_active(auth.uid())
  );

-- Un-reacting stays possible for a suspended account on purpose: withdrawing
-- something you said is never the action to block.
create policy "message_reactions_delete"
  on message_reactions for delete
  to authenticated
  using (user_id = auth.uid());

-- Realtime, so a reaction lands in the other person's open thread without a
-- refresh — the same reason `messages` is published (083).
alter publication supabase_realtime add table message_reactions;

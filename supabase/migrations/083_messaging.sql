-- Member-to-member direct messaging.
--
-- Open DMs between active members, with block + report safety. 1:1
-- conversations are deduped via a canonical `dm_key`. Reads are gated to
-- conversation participants via a SECURITY DEFINER helper (mirrors
-- is_savings_goal_participant in 079 to avoid RLS recursion). Sends are gated
-- to active accounts; block enforcement (which needs the peer id) is layered
-- in the send action + the get_or_create_dm RPC.

-- ── Tables ────────────────────────────────────────────────────────────────

create table if not exists conversations (
  id              uuid        primary key default gen_random_uuid(),
  -- canonical "least:greatest" of the two user ids for 1:1 dedupe
  dm_key          text        unique,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists conversation_participants (
  conversation_id  uuid        not null references conversations on delete cascade,
  user_id          uuid        not null references auth.users on delete cascade,
  last_read_at     timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  joined_at        timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

-- Conversation list + realtime trigger surface ("my conversations, recent first").
create index if not exists idx_conv_participants_user
  on conversation_participants (user_id, last_activity_at desc);

create table if not exists messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references conversations on delete cascade,
  sender_id       uuid        not null references auth.users on delete cascade,
  body            text        not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_messages_conv
  on messages (conversation_id, created_at);

create table if not exists user_blocks (
  blocker_id uuid        not null references auth.users on delete cascade,
  blocked_id uuid        not null references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists abuse_reports (
  id               uuid        primary key default gen_random_uuid(),
  reporter_id      uuid        not null references auth.users on delete cascade,
  reported_user_id uuid        references auth.users on delete set null,
  message_id       uuid        references messages on delete set null,
  conversation_id  uuid        references conversations on delete set null,
  reason           text        not null,
  note             text,
  status           text        not null default 'open' check (status in ('open','reviewed','dismissed')),
  created_at       timestamptz not null default now()
);

-- ── Helpers (SECURITY DEFINER — break RLS recursion / bypass for gating) ────

create or replace function is_conversation_participant(_conversation_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from conversation_participants
    where conversation_id = _conversation_id and user_id = auth.uid()
  );
$$;
grant execute on function is_conversation_participant(uuid) to authenticated;

create or replace function is_account_active(_uid uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  -- null status (legacy rows) counts as active; suspended/banned/pending do not.
  select coalesce((select account_status from profiles where id = _uid), 'active') = 'active';
$$;
grant execute on function is_account_active(uuid) to authenticated;

-- Atomically find-or-create the 1:1 conversation between the caller and
-- _other_user. SECURITY DEFINER so it can insert participant rows past RLS.
-- Enforces: authenticated, not self, peer exists, neither side has blocked.
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

-- On new message: bump conversation + every participant's activity so each
-- member's realtime subscription on conversation_participants fires.
create or replace function bump_conversation_on_message()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update conversations
    set last_message_at = NEW.created_at
    where id = NEW.conversation_id;
  update conversation_participants
    set last_activity_at = NEW.created_at
    where conversation_id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists trg_bump_conversation_on_message on messages;
create trigger trg_bump_conversation_on_message
  after insert on messages
  for each row execute function bump_conversation_on_message();

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table conversations            enable row level security;
alter table conversation_participants enable row level security;
alter table messages                 enable row level security;
alter table user_blocks              enable row level security;
alter table abuse_reports            enable row level security;

-- conversations: participants + admin read. Creation via get_or_create_dm RPC.
create policy "conversations_read"
  on conversations for select to authenticated
  using (is_conversation_participant(id) or is_admin());

-- participants: peers read; self updates own last_read_at. Inserts via RPC.
create policy "conv_participants_read"
  on conversation_participants for select to authenticated
  using (is_conversation_participant(conversation_id) or is_admin());
create policy "conv_participants_self_update"
  on conversation_participants for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- messages: participants read; sender inserts into a conversation they're in,
-- and only while their account is active. Block enforcement is in the action.
create policy "messages_read"
  on messages for select to authenticated
  using (is_conversation_participant(conversation_id) or is_admin());
create policy "messages_insert"
  on messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and is_conversation_participant(conversation_id)
    and is_account_active(auth.uid())
  );

-- blocks: owner-managed.
create policy "user_blocks_owner"
  on user_blocks for all to authenticated
  using (blocker_id = auth.uid() or is_admin())
  with check (blocker_id = auth.uid());

-- reports: anyone can file; only admins read.
create policy "abuse_reports_insert"
  on abuse_reports for insert to authenticated
  with check (reporter_id = auth.uid());
create policy "abuse_reports_admin_read"
  on abuse_reports for select to authenticated
  using (is_admin());

-- ── Realtime ──────────────────────────────────────────────────────────────
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table conversation_participants;

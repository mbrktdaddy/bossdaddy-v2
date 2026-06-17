-- ─────────────────────────────────────────────────────────────────────────────
-- 095_boss_conversations.sql
-- "The Boss" concierge chat persistence.
--
-- User-owned data (Pattern B): members get conversation history + a safety/abuse
-- log. Logged-out visitors are EPHEMERAL — their turns are never written here;
-- visitor history lives only in client state for the session.
--
-- Internal names (boss_conversations, boss_messages) are STABLE FOREVER — display
-- copy lives in lib/labels.ts.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists boss_conversations (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  title      text,        -- first user line, for the history list
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_boss_conversations_user
  on boss_conversations (user_id, updated_at desc);

alter table boss_conversations enable row level security;

create policy "boss_conversations_read"
  on boss_conversations for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "boss_conversations_write"
  on boss_conversations for all
  to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());


create table if not exists boss_messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references boss_conversations on delete cascade,
  user_id         uuid        not null references auth.users on delete cascade, -- denormalized so RLS needs no join
  role            text        not null check (role in ('user', 'assistant')),
  content         text        not null,
  tool_calls      jsonb,       -- [{ name, input, resultSummary }]
  citations       jsonb,       -- Citation[] for rendered links/cards
  created_at      timestamptz not null default now()
);

create index if not exists idx_boss_messages_conversation
  on boss_messages (conversation_id, created_at);

alter table boss_messages enable row level security;

create policy "boss_messages_read"
  on boss_messages for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "boss_messages_write"
  on boss_messages for all
  to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

-- After applying: npm run db:types

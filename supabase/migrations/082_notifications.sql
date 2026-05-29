-- In-app notifications feed.
--
-- A recipient-owned table backing the header bell + /account/notifications.
-- Rows are produced server-side (event producers using the admin client):
-- savings invites, merch purchase completion, review moderation results,
-- account moderation actions, and new-message pings. Users only read their
-- own rows and update read_at / action_state on them.
--
-- RLS: Pattern B (user-owned). Inserts intentionally have NO policy — they
-- flow through the service-role admin client, which bypasses RLS.

create table if not exists notifications (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users on delete cascade,
  type            text        not null,
  title           text        not null,
  body            text,
  link            text,                         -- in-app URL to open on click
  payload         jsonb       not null default '{}'::jsonb,
  action_required boolean     not null default false,
  action_state    text        check (action_state in ('pending','accepted','declined','completed')),
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

-- Drives the unread badge ("my rows where read_at is null, newest first").
create index if not exists idx_notifications_user_unread
  on notifications (user_id, read_at, created_at desc);

alter table notifications enable row level security;

-- Owner reads their own; admins read all.
create policy "notifications_read"
  on notifications for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- Owner may mark read / set action_state on their own rows. (The app only
-- ever updates read_at + action_state; tampering with one's own notification
-- text is harmless since rows are private.)
create policy "notifications_self_update"
  on notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Live unread updates in the bell.
alter publication supabase_realtime add table notifications;

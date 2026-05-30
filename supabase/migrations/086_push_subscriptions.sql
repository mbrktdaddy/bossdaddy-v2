-- Web push subscriptions (Phase 2: push for new messages).
--
-- One row per device/browser the user has granted notification permission on.
-- Sends go through the admin client (lib/push.ts) signed with our VAPID keys;
-- dead endpoints (404/410) are pruned on send. Subscribing IS the opt-in, so
-- there's no separate pref toggle — presence of a row = push on for that device.

create table if not exists push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  endpoint    text        not null unique,   -- UNIQUE already indexes endpoint
  p256dh      text        not null,
  auth        text        not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Lookup by owner on send ("all of this user's devices").
create index if not exists idx_push_subscriptions_user
  on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

-- User-owned: each member manages their own device subscriptions. Sends use
-- the service-role admin client, which bypasses RLS.
create policy "push_subscriptions_owner"
  on push_subscriptions for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

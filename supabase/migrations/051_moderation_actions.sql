-- Migration 051: Moderation audit log
--
-- Every suspend / ban / unban / delete / restore action gets a row here. Used
-- for compliance trail, "why did this happen?" investigations, and to populate
-- a per-user history view in the admin dashboard.
--
-- actor_id is the admin who took the action; target_id is the user it was
-- taken against. Kept separately from the profile snapshot so we can show the
-- chain of actions even after status changes.

create table if not exists moderation_actions (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid        references profiles(id) on delete set null,
  target_id   uuid        not null references profiles(id) on delete cascade,
  action_type text        not null check (action_type in (
                            'suspend', 'unsuspend', 'ban', 'unban',
                            'delete', 'restore', 'request_deletion', 'cancel_deletion'
                          )),
  reason      text,
  payload     jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_moderation_actions_target
  on moderation_actions (target_id, created_at desc);
create index if not exists idx_moderation_actions_actor
  on moderation_actions (actor_id, created_at desc);

alter table moderation_actions enable row level security;

create policy "admins read moderation_actions"
  on moderation_actions for select
  to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "admins insert moderation_actions"
  on moderation_actions for insert
  to authenticated
  with check (
    actor_id = auth.uid() and
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Users can read actions taken against THEM (so they can see why they were suspended/banned).
create policy "users read own moderation_actions"
  on moderation_actions for select
  to authenticated
  using (target_id = auth.uid());

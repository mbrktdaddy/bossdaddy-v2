-- Migration 050: Account moderation — status, suspension, deletion request
--
-- Adds an account_status column with four states: active (default), suspended
-- (temporary, has end date), banned (permanent, content hidden), and
-- pending_deletion (30-day cooldown before hard delete).
--
-- The other columns capture the reason, an internal admin note, and an audit
-- trail of who did what when. The full moderation_actions audit log lives in
-- migration 051.

alter table profiles add column if not exists account_status text not null default 'active'
  check (account_status in ('active', 'suspended', 'banned', 'pending_deletion'));

alter table profiles add column if not exists suspended_until timestamptz;
alter table profiles add column if not exists moderation_reason text;
alter table profiles add column if not exists moderation_note text;
alter table profiles add column if not exists moderation_action_at timestamptz;
alter table profiles add column if not exists moderation_action_by uuid references profiles(id) on delete set null;
alter table profiles add column if not exists deletion_requested_at timestamptz;

create index if not exists idx_profiles_account_status on profiles (account_status)
  where account_status <> 'active';

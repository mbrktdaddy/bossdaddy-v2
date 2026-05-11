-- Extend social_posts with image, link, and posted tracking.
-- Add hashtag_presets for saved tag sets per platform.

alter table social_posts
  add column if not exists link_url   text,
  add column if not exists image_url  text,
  add column if not exists posted_at  timestamptz;

-- Widen status check to include 'posted'
alter table social_posts drop constraint if exists social_posts_status_check;
alter table social_posts add constraint social_posts_status_check
  check (status in ('draft', 'ready', 'posted'));

-- Hashtag presets — reusable tag sets per platform
create table if not exists hashtag_presets (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  platform   text        not null default 'x',
  name       text        not null,
  tags       text[]      not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_hashtag_presets_user
  on hashtag_presets (user_id, platform, created_at desc);

alter table hashtag_presets enable row level security;

create policy "hashtag_presets_read"
  on hashtag_presets for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "hashtag_presets_write"
  on hashtag_presets for all
  to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

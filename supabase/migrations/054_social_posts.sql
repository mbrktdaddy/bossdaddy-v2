-- Social posts — AI-generated content for X, Instagram, Threads, etc.
-- Platform stored as text (not enum) so adding new platforms needs no migration.
-- Status: draft (working) → ready (polished, copy-paste when you want).
-- Source: optional link to the review/guide that inspired the post.

create table if not exists social_posts (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  platform    text        not null default 'x'
                          check (platform in ('x', 'instagram', 'threads', 'facebook')),
  content     text        not null,
  status      text        not null default 'draft'
                          check (status in ('draft', 'ready')),
  source_type text        check (source_type in ('review', 'guide', 'original')),
  source_id   uuid,
  source_title text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_social_posts_user
  on social_posts (user_id, created_at desc);

create index if not exists idx_social_posts_status
  on social_posts (status, platform, created_at desc);

alter table social_posts enable row level security;

create policy "social_posts_read"
  on social_posts for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "social_posts_write"
  on social_posts for all
  to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

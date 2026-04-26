-- v4.6 — Stored AI-generated social media copy per content
-- One row per content+platform — easy to regenerate, easy to copy/paste.

create table if not exists social_posts (
  id            uuid        primary key default gen_random_uuid(),
  content_type  text        not null check (content_type in ('article', 'review')),
  content_id    uuid        not null,
  platform      text        not null check (platform in ('twitter', 'instagram', 'facebook', 'linkedin', 'threads')),
  body          text        not null,
  hashtags      text[]      not null default '{}',
  generated_at  timestamptz not null default now(),
  generated_by  uuid        references profiles(id) on delete set null,

  unique (content_type, content_id, platform)
);

create index if not exists idx_social_posts_content
  on social_posts (content_type, content_id);

-- RLS: admins manage; nothing public. Authors can read their own content's posts.
alter table social_posts enable row level security;

create policy "admins manage social posts"
  on social_posts for all
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy "authors read own social posts"
  on social_posts for select
  to authenticated
  using (
    -- Author can read posts for content they wrote (cheap: check articles + reviews tables)
    exists (
      select 1 from articles a
      where a.id = social_posts.content_id and a.author_id = auth.uid()
        and social_posts.content_type = 'article'
    )
    or exists (
      select 1 from reviews r
      where r.id = social_posts.content_id and r.author_id = auth.uid()
        and social_posts.content_type = 'review'
    )
  );

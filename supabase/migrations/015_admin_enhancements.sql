-- Admin dashboard enhancements: scheduled publishing, SEO meta, version history
-- ────────────────────────────────────────────────────────────────────────

-- 1) Scheduled publishing + SEO meta on articles + reviews
alter table articles
  add column if not exists scheduled_publish_at timestamptz,
  add column if not exists meta_title           text,
  add column if not exists meta_description     text;

alter table reviews
  add column if not exists scheduled_publish_at timestamptz,
  add column if not exists meta_title           text,
  add column if not exists meta_description     text;

-- Index for fast cron scans of items due for auto-publish
create index if not exists idx_articles_scheduled_publish_at
  on articles (scheduled_publish_at)
  where scheduled_publish_at is not null;

create index if not exists idx_reviews_scheduled_publish_at
  on reviews (scheduled_publish_at)
  where scheduled_publish_at is not null;

-- ────────────────────────────────────────────────────────────────────────

-- 2) Version history — snapshots of article/review state on each save
create table if not exists content_revisions (
  id             uuid        primary key default gen_random_uuid(),
  content_type   text        not null check (content_type in ('article', 'review')),
  content_id     uuid        not null,
  version_number integer     not null,
  snapshot       jsonb       not null,
  created_at     timestamptz not null default now(),
  created_by     uuid        references profiles(id) on delete set null
);

create index if not exists idx_content_revisions_lookup
  on content_revisions (content_type, content_id, version_number desc);

alter table content_revisions enable row level security;

-- Only admins can read/write revisions
create policy "admins read revisions"
  on content_revisions for select
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "admins insert revisions"
  on content_revisions for insert
  to authenticated
  with check (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "admins delete revisions"
  on content_revisions for delete
  to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

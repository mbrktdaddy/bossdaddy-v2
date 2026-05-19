-- Migration 072: Site-wide settings singleton.
--
-- The homepage hero is polymorphic — it can point at either a review or
-- a guide, the admin picks which. This table holds that pointer (and
-- becomes the natural home for any future site-wide editorial setting
-- like "footer feature pick" or "lead-magnet override").
--
-- Singleton enforced by `id = 1` check + UNIQUE primary key, mirroring
-- the pattern used by Postgres-on-Supabase examples.
--
-- Resolution at render time:
--   1. If homepage_hero_type + homepage_hero_id are set → use that.
--   2. Else fall back to reviews.featured (migration 062).
--   3. Else fall back to algorithmic (highest-rated approved review).

create table if not exists site_settings (
  id                   integer     primary key default 1,
  homepage_hero_type   text        check (homepage_hero_type in ('review', 'guide')),
  homepage_hero_id     uuid,
  updated_at           timestamptz not null default now(),
  -- Singleton invariant: only one row allowed, always id=1.
  constraint site_settings_singleton check (id = 1)
);

-- Seed the single row so the homepage always finds something to read.
insert into site_settings (id) values (1) on conflict (id) do nothing;

alter table site_settings enable row level security;

-- Public read — the homepage hero value is visible to every visitor by
-- definition (it's what they see), so logged-out reads are correct.
create policy "site_settings_public_read"
  on site_settings for select
  to anon, authenticated
  using (true);

-- Admin-only writes.
create policy "site_settings_admin_write"
  on site_settings for all
  to authenticated
  using (is_admin())
  with check (is_admin());

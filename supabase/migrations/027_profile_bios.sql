-- v4.4 — Author bio fields on profiles + public read policy
-- Drives the AuthorBio component on every article + review and the
-- public /author/[username] page header.

alter table profiles
  add column if not exists display_name text,
  add column if not exists tagline      text,
  add column if not exists bio          text,
  add column if not exists avatar_url   text;

-- AuthorBio renders for anonymous visitors. Add a public select policy.
-- (profiles_self continues to govern writes — this only affects SELECT.)
drop policy if exists "profiles_public_read" on profiles;
create policy "profiles_public_read"
  on profiles for select
  to anon, authenticated
  using (true);

-- Allow public (unauthenticated) reads on the profiles table.
--
-- Same root cause as 042_products_public_read.sql: the profiles table only
-- allowed `authenticated` users to SELECT, which silently broke author
-- identity display across the public site. Logged-out visitors saw the
-- fallback "Boss Daddy" instead of the real @username on every review,
-- guide, and comment, and the /author/[username] route returned empty.
--
-- profiles in this schema only stores public-facing identity data (username,
-- display info, role flag). Sensitive auth data (email, password) lives in
-- auth.users which is NOT exposed by this policy. Sensitive write operations
-- (changing role, marking trusted_commenter) remain locked to admin-only and
-- self-only via the existing profiles_admin_* and profiles_self_* policies.
--
-- 2026-05-08: added `drop policy if exists` so this migration is idempotent
-- and replays cleanly in CI / fresh environments. Migration 027 already
-- created a `profiles_public_read` policy; this one was a defensive duplicate
-- that never actually ran in production (027's drop+create won the race).

drop policy if exists "profiles_public_read" on profiles;
create policy "profiles_public_read"
  on profiles for select
  to anon, authenticated
  using (true);

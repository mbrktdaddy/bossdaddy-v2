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

create policy "profiles_public_read"
  on profiles for select
  to anon, authenticated
  using (true);

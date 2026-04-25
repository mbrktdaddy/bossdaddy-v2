-- Cleanup pass before v4
-- 1. Drop orphan affiliate_links table (created in 001, never queried by app code)
-- 2. Replace content_revisions inline subquery RLS with is_admin() helper
--    (matches the pattern used by every other admin-only table after migration 002)

-- ── 1. Drop orphan affiliate_links ────────────────────────────────────────────
drop table if exists affiliate_links cascade;

-- ── 2. Fix content_revisions RLS to use is_admin() helper ────────────────────
drop policy if exists "admins read revisions"   on content_revisions;
drop policy if exists "admins insert revisions" on content_revisions;
drop policy if exists "admins delete revisions" on content_revisions;

create policy "admins read revisions"
  on content_revisions for select
  to authenticated
  using (is_admin());

create policy "admins insert revisions"
  on content_revisions for insert
  to authenticated
  with check (is_admin());

create policy "admins delete revisions"
  on content_revisions for delete
  to authenticated
  using (is_admin());

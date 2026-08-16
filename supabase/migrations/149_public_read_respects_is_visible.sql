-- ─────────────────────────────────────────────────────────────────────────────
-- Make the public read policies on `reviews` and `guides` respect `is_visible`.
--
-- THE GAP
--   `is_visible` was added in migration 004, whose own header states its
--   purpose: "Allows soft-hiding live content without changing status or
--   triggering re-moderation." The public read policies predate it — 001 for
--   reviews, 003 for articles (later renamed to guides by 032) — and check only
--   `status = 'approved'`. They were never revisited when 004 landed.
--
--   So hiding a review or guide removes it from every page (the app filters
--   `is_visible` at 20+ public call sites) but NOT from the database's answer to
--   a direct PostgREST query with the public anon key. Withdrawn content stays
--   readable. The one thing `is_visible` exists to do is the one thing it does
--   not do against the API.
--
--   Everything else already encodes the correct rule, which is how we know this
--   is an oversight and not a design choice:
--     * `review_tags` / `guide_tags` policies (041) check
--       `status = 'approved' AND is_visible = true` ON THE PARENT — the join
--       table is stricter than the table it joins to.
--     * `collections` (044 → 065) checks `is_visible = true`.
--     * `boss_hybrid_reviews` / `boss_hybrid_guides` (125) filter both.
--     * The performance indexes (040, 052) are built on
--       `(status, is_visible, …)` — they assume the filter.
--     * `supabase/migrations/_TEMPLATE.sql:64` documents the pattern.
--
--   Audit finding #9, docs/audit-2026-08-16.md.
--
-- WHY THE DROP MATTERS MORE THAN THE CREATE
--   Permissive policies OR together. Adding a correct policy WITHOUT dropping
--   the old one changes nothing — the old `using (status = 'approved')` still
--   grants the row on its own. That is exactly how migration 106 silently
--   undid 080 (audit finding #1, repaired by 147). The drops below are the
--   load-bearing half of this migration.
--
--   The guides policy was created as `articles_public_approved` in 003 and
--   renamed programmatically by 032 (`ILIKE '%article%'` → `guide`). Both names
--   are dropped defensively.
--
-- WHO KEEPS ACCESS
--   Admins via `reviews_admin_all` / `guides_admin_all`, authors via
--   `reviews_author_select` / `guides_author_own` (both scoped to
--   `author_id = auth.uid()`), and anything on the service-role client, which
--   bypasses RLS. Hiding stays a reversible moderation action, not a delete.
--
-- ALSO: the recreated policies name `to anon, authenticated` explicitly. The
-- originals had no `TO` clause, which defaults to PUBLIC. Behaviourally
-- equivalent for these two roles, but it matches the doctrine table in
-- CLAUDE.md and states the intent instead of relying on a default.
--
-- Policies only — no schema change, no data change.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── reviews ─────────────────────────────────────────────────────────────────
drop policy if exists "reviews_public_approved" on reviews;

create policy "reviews_public_approved"
  on reviews for select
  to anon, authenticated
  using (
    status = 'approved'
    and is_visible = true
  );

-- ─── guides ──────────────────────────────────────────────────────────────────
drop policy if exists "guides_public_approved"   on guides;
drop policy if exists "articles_public_approved" on guides;  -- pre-032 name

create policy "guides_public_approved"
  on guides for select
  to anon, authenticated
  using (
    status = 'approved'
    and is_visible = true
  );

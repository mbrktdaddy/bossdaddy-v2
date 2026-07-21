-- ─────────────────────────────────────────────────────────────────────────────
-- 123 — let comment authors delete their OWN comments regardless of status.
--
-- Previously `comments_delete_own` was `(author_id = auth.uid()) AND
-- (status <> 'approved')`. Because the comment flow is publish-first (almost
-- everything auto-approves on submit), that guard meant a user could never
-- delete their own comment in practice. Deleting your own content is baseline,
-- low-risk, and expected. Relax the policy to owner-only, any status.
--
-- Comments are MODERATED user content: read stays `to anon, authenticated`
-- (approved rows), and admin moderation is unchanged via `comments_admin`
-- (all, is_admin()). This only widens an author's control over their OWN rows.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "comments_delete_own" on comments;

create policy "comments_delete_own"
  on comments for delete
  to authenticated
  using (author_id = auth.uid());

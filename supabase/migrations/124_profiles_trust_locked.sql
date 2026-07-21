-- ─────────────────────────────────────────────────────────────────────────────
-- 124 — manual comment-trust override lock.
--
-- `trusted_commenter` is auto-promoted to true after 5 approved+clean comments
-- (see /api/comments checkTrustPromotion) and never demoted. That single field
-- had two writers with conflicting intent: an admin revoke would be silently
-- re-promoted on the user's next clean comment.
--
-- `trust_locked` records "an admin has decided this — the automatic rule must
-- not override it." When true, checkTrustPromotion skips the user entirely, so
-- a manual trust/untrust decision sticks. Cleared by the "reset to automatic"
-- admin action, which hands the user back to auto-promotion.
--
-- No RLS change: profiles admin-write / owner-read policies already cover it.
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles
  add column if not exists trust_locked boolean not null default false;

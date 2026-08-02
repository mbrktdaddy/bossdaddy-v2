-- Migration 133: Drop the legacy engagement counters from the content tables
-- Apply via: supabase db push  OR paste into Supabase SQL editor
-- DO NOT push automatically — applied manually by operator.
-- Idempotent (`if exists`).
--
-- ─────────────────────────────────────────────────────────────────────────────
-- HOLD until all three are true:
--
--   1. Migration 131 is applied and `review_metrics` / `guide_metrics` are
--      accumulating (view a review, confirm its row's view_count moves).
--   2. The dashboard deploy that reads the new tables is live —
--      /dashboard/admin/engagement and /dashboard Top Performers show the same
--      numbers they did before 131.
--   3. You are satisfied you will not need the old values as a cross-check.
--
-- This is the CONTRACT step of expand → repair → contract. It is the only
-- irreversible part: after this, the backfilled copies in the metrics tables
-- are the sole record. Nothing reads these columns once the dashboard deploy
-- has shipped, so there is no rush — days later is fine.
-- ─────────────────────────────────────────────────────────────────────────────

alter table reviews
  drop column if exists view_count,
  drop column if exists scroll_25_count,
  drop column if exists scroll_50_count,
  drop column if exists scroll_75_count,
  drop column if exists scroll_100_count;

alter table guides
  drop column if exists view_count,
  drop column if exists scroll_25_count,
  drop column if exists scroll_50_count,
  drop column if exists scroll_75_count,
  drop column if exists scroll_100_count;

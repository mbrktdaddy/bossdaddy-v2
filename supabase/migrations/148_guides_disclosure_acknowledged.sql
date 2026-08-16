-- ─────────────────────────────────────────────────────────────────────────────
-- Give `guides` the FTC affiliate disclosure gate that `reviews` already has.
--
-- THE GAP
--   `guides` has carried `has_affiliate_links` since 003, but no
--   `disclosure_acknowledged` column — so a guide could contain affiliate
--   links and be published with nothing anywhere in the system recording that
--   the author acknowledged the disclosure. `reviews` gates this on create
--   (`api/reviews/route.ts:48`) and on submit (`api/reviews/[id]/submit:36`);
--   the guides pipeline had no equivalent because there was no column to
--   check. CLAUDE.md Security Rule 3 treats this gate as a legal compliance
--   requirement, and it applied to only half the publishable content types.
--
--   Found while closing audit finding #61 (docs/audit-2026-08-16.md), which
--   fixed the review side.
--
-- SHAPE
--   `not null default false` — stricter than the reviews column, which is
--   nullable (`boolean | null`) because 001 declared it without NOT NULL. New
--   code treats null and false identically (`lib/reviews.ts::isDisclosureBlocked`),
--   so there is no behavioural difference; guides simply gets the tighter
--   shape from the start rather than inheriting a historical accident.
--
-- DELIBERATELY NOT BACKFILLED
--   Existing guides all get `false`, including already-published ones with
--   affiliate links. That is intentional: backfilling `true` would record an
--   acknowledgement that never happened, which is exactly the attestation this
--   column exists to make truthful. Already-approved guides stay public and
--   are unaffected — the gate fires only on a transition INTO a published
--   state. Re-approving or re-scheduling an old guide with affiliate links
--   will require ticking the box, which is the correct legal act.
--
-- No RLS change: `guides` policies are unchanged and this column inherits the
-- table's existing public-content read policy. No index — it is never a filter
-- on its own, only read alongside a row already being fetched by id.
-- ─────────────────────────────────────────────────────────────────────────────

alter table guides
  add column if not exists disclosure_acknowledged boolean not null default false;

comment on column guides.disclosure_acknowledged is
  'FTC gate: author confirms the guide''s affiliate links will carry a disclosure. Checked at every transition into a published state (submit, admin approve, scheduled publish) — not just at authoring time, because has_affiliate_links is recomputed on every content edit.';

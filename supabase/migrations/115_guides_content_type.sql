-- ─────────────────────────────────────────────────────────────────────────────
-- 115 — guides.content_type (piece-type depth toggle)
--
-- Decision A (operator, 2026-07-05): reframe the guide goal from "most
-- comprehensive" to "most useful + scannable" via a 3-way depth toggle that
-- drives BOTH the generated structure AND the token budget:
--   • essay → free-form narrative, no forced TL;DR / takeaways / FAQ
--   • howto → tight + scannable, TL;DR + key takeaways, no forced FAQ
--   • guide → the comprehensive treatment (TL;DR + takeaways + FAQ), long-form
--
-- The public guide page already renders tldr / key_takeaways / faqs
-- conditionally (guarded by presence), so essays/how-tos with empty blocks show
-- nothing while deep guides render the full structure. content_type additionally
-- lets the render + listing distinguish essays from how-tos (both blockless) and
-- enables the distinct essay treatment on the roadmap.
--
-- guides is existing PUBLIC content — RLS is already correct (mig-era public
-- read + is_admin write). This is a pure additive column; no policy changes.
-- Default 'guide' so every existing row keeps the comprehensive treatment.
-- ─────────────────────────────────────────────────────────────────────────────

alter table guides
  add column if not exists content_type text not null default 'guide';

alter table guides
  drop constraint if exists guides_content_type_check;
alter table guides
  add constraint guides_content_type_check
    check (content_type in ('essay', 'howto', 'guide'));

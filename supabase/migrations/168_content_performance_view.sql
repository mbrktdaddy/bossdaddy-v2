-- ─────────────────────────────────────────────────────────────────────────────
-- 168 — content_performance view (content pipeline plan, Phase 4)
--
-- WHY: the eval's outcome signal. Reader scroll depth lives in
-- review_metrics / guide_metrics (mig 131); which prompt version and method
-- wrote the piece lives on the content row (mig 164). This joins them per
-- published item so the dashboard can show scroll-75 rate BY PROMPT VERSION —
-- the one number that says whether a prompt change helped readers finish.
--
-- Per-item, not pre-aggregated: the dashboard groups in code, and the same
-- rows answer "which pieces under version X are the weak ones?".
--
-- Access: security_invoker so the metrics tables' admin-only RLS still applies,
-- AND the default grants are revoked — Supabase grants new views to anon +
-- authenticated automatically (memory `feedback_supabase_default_privileges`),
-- and nothing public should be able to even enumerate this. The dashboard reads
-- it through the service-role client.
--
-- Verify after applying (expect an ERROR, not an empty result):
--   begin; set local role anon; select count(*) from content_performance; rollback;
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view content_performance
with (security_invoker = true) as
select
  'review'::text        as content_type,
  r.id                  as content_id,
  r.slug,
  r.title,
  r.prompt_version,
  r.generation_method,
  r.published_at,
  coalesce(m.view_count, 0)       as view_count,
  coalesce(m.scroll_25_count, 0)  as scroll_25_count,
  coalesce(m.scroll_50_count, 0)  as scroll_50_count,
  coalesce(m.scroll_75_count, 0)  as scroll_75_count,
  coalesce(m.scroll_100_count, 0) as scroll_100_count
from reviews r
left join review_metrics m on m.review_id = r.id
where r.status = 'approved' and r.is_visible = true
union all
select
  'guide'::text,
  g.id,
  g.slug,
  g.title,
  g.prompt_version,
  g.generation_method,
  g.published_at,
  coalesce(m.view_count, 0),
  coalesce(m.scroll_25_count, 0),
  coalesce(m.scroll_50_count, 0),
  coalesce(m.scroll_75_count, 0),
  coalesce(m.scroll_100_count, 0)
from guides g
left join guide_metrics m on m.guide_id = g.id
where g.status = 'approved' and g.is_visible = true;

revoke all on content_performance from anon, authenticated;

comment on view content_performance is
  'Published reviews + guides with their reader metrics and generation provenance. Service-role only; the dashboard groups by prompt_version.';

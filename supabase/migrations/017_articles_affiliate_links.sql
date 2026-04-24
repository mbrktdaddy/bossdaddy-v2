-- Affiliate-link awareness for articles.
-- Reviews have carried `has_affiliate_links` since 001_initial.sql; articles
-- acquire it now that [[BUY:slug]] tokens are resolved on article save too.
-- The public /articles/[slug] page renders the FTC disclosure block whenever
-- this flag is true, matching the review page's behavior.
-- ────────────────────────────────────────────────────────────────────────

alter table articles
  add column if not exists has_affiliate_links boolean not null default false;

-- Existing articles default to false; they'll flip to true on their next
-- save if their content contains affiliate anchors or [[BUY:...]] tokens.

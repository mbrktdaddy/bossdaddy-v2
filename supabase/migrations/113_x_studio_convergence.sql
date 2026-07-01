-- ─────────────────────────────────────────────────────────────────────────────
-- 113 — X Studio convergence: planned-time ("scheduled_at") on social content
--
-- Phase 5 of the workspace-unification roadmap. Adds a nullable planned post-time
-- to both social content tables. This is a REMINDER/queue-ordering field only —
-- posting to X stays manual (copy/paste); there is NO cron and NO automation
-- reading this column. If/when X API write access lands, an XApiPublisher can
-- consume scheduled_at, but nothing does today.
--
-- Both tables are already Pattern B owner-scoped (migs 107 + 109). ADD COLUMN
-- does not touch RLS policies, so there are NO policy changes here.
-- ─────────────────────────────────────────────────────────────────────────────

alter table social_posts    add column if not exists scheduled_at timestamptz;
alter table social_articles add column if not exists scheduled_at timestamptz;

-- Queue-ordering: "my planned posts, soonest first". Partial index keeps it lean
-- (only rows that actually have a planned time).
create index if not exists idx_social_posts_scheduled
  on social_posts (user_id, scheduled_at)
  where scheduled_at is not null;

create index if not exists idx_social_articles_scheduled
  on social_articles (user_id, scheduled_at)
  where scheduled_at is not null;

-- After applying: npm run db:types

-- ─────────────────────────────────────────────────────────────────────────────
-- 112 — Collections: enable Social posts + Version history (Phase 2b leftovers).
--
-- Collections (picks/stacks/comparisons/gifts) were rebuilt onto the shared
-- WorkspaceShell rails in Phase 2a/2b but two shared panels stayed off because
-- their backing tables didn't recognize collections as a source:
--   • SocialPostsPanel writes social_posts.source_type — allowed only
--     'review','guide','original' (mig 054).
--   • VersionHistoryPanel reads/writes content_revisions.content_type — allowed
--     only 'review','guide' (migs 015/034).
-- This migration widens both CHECK constraints to add 'collection'. Additive and
-- back-compatible: no rows change, existing values stay valid. The app wiring
-- (rendering both panels in CollectionWorkspace + a snapshotRevision('collection')
-- call in the picks PATCH handler) ships alongside this migration.
--
-- Note on source_type reach: SocialPostsPanel targets social_posts only. The
-- X-Studio thread/article tables (social_thread_groups, social_articles from
-- mig 109) are NOT touched here — collections don't feed those flows yet. Widen
-- them in Phase 5 if/when collection→thread/article repurposing lands.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── 1. social_posts.source_type — add 'collection' ──────────────────────────
alter table social_posts drop constraint if exists social_posts_source_type_check;
alter table social_posts add constraint social_posts_source_type_check
  check (source_type in ('review', 'guide', 'original', 'collection'));


-- ─── 2. content_revisions.content_type — add 'collection' ────────────────────
alter table content_revisions drop constraint if exists content_revisions_content_type_check;
alter table content_revisions add constraint content_revisions_content_type_check
  check (content_type in ('review', 'guide', 'collection'));

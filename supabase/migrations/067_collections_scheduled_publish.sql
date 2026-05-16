-- Migration 067: scheduled_publish_at on collections
--
-- Mirrors reviews.scheduled_publish_at + guides.scheduled_publish_at. Editor
-- sets a future timestamp via the SchedulePanel in the Vault workspace; the
-- daily cron at /api/cron/publish-scheduled flips is_visible=true once the
-- scheduled time has passed. Enables drafting a Father's Day gift guide on
-- May 20 and having it auto-drop on June 1 at midnight without manual toggle.

alter table collections
  add column if not exists scheduled_publish_at timestamptz;

comment on column collections.scheduled_publish_at is
  'When set: the daily cron at /api/cron/publish-scheduled flips is_visible=true once this time has passed, then clears this field. NULL after publish or when not scheduled.';

-- Partial index — only the rows the cron actually scans
create index if not exists idx_collections_scheduled_publish
  on collections (scheduled_publish_at)
  where scheduled_publish_at is not null;

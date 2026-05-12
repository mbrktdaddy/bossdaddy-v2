-- Review sub-scores + would-rebuy signal
--
-- Adds four 1-10 sub-scores (quality, value, ease of use, daily use) and a
-- boolean "would buy again" flag to reviews. All nullable so existing rows
-- (and in-progress drafts) keep working until they're filled in.
--
-- These power the Verdict Card on the public review detail page:
--   • Sub-scores render as 4 horizontal bars
--   • would_rebuy renders as a small chip under the score arc
--
-- RLS: no new policies needed. The existing reviews RLS (migration 001 +
-- subsequent) covers these columns automatically.

alter table reviews
  add column if not exists score_quality   integer check (score_quality   between 1 and 10),
  add column if not exists score_value     integer check (score_value     between 1 and 10),
  add column if not exists score_ease      integer check (score_ease      between 1 and 10),
  add column if not exists score_daily_use integer check (score_daily_use between 1 and 10),
  add column if not exists would_rebuy     boolean;

comment on column reviews.score_quality   is 'Quality / build (1-10) — feeds the Verdict Card sub-score bars.';
comment on column reviews.score_value     is 'Value for money (1-10) — feeds the Verdict Card sub-score bars.';
comment on column reviews.score_ease      is 'Ease of use (1-10) — feeds the Verdict Card sub-score bars.';
comment on column reviews.score_daily_use is 'Daily use / real-life fit (1-10) — feeds the Verdict Card sub-score bars.';
comment on column reviews.would_rebuy     is 'Honest re-purchase signal — renders as a chip below the score arc.';

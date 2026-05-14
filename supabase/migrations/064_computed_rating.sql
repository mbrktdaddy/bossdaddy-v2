-- Migration 064: Convert reviews.rating to a generated column from the 4 sub-scores
--
-- Before: rating was a manually-entered numeric(3,1) field independent of the four
-- sub-scores (score_quality, score_value, score_ease, score_daily_use). The overall
-- arc could disagree with the sub-score bars — a "no BS" brand can't ship that
-- inconsistency.
--
-- After: rating IS the average of the four sub-scores, generated at the DB level.
-- The only way to change the overall is to adjust a sub-score. Single source of truth.
--
-- One-time data migration:
--   1. Reviews with rating and ALL sub-scores null → distribute the rating across
--      four integer sub-scores so their average matches as closely as possible
--      (quarter-point precision is the limit of 4 integers in 1..10).
--   2. Reviews with rating and SOME sub-scores null → fill the nulls with
--      ROUND(rating); existing populated sub-scores are preserved.
--   3. Reviews that already have all 4 sub-scores set → left untouched. The new
--      generated rating reflects their actual average, which may differ slightly
--      from the legacy manually-entered value. Curated sub-scores win.
--   4. Drop the editable rating column.
--   5. Recreate rating as a STORED generated column. NULL until all 4 sub-scores set.

begin;

-- Step 1 — distribute rating across four sub-scores for reviews with none set.
--
-- Algorithm per row with rating R:
--   base   = floor(R)
--   excess = round((R - base) * 4)   -- how many sub-scores get (base+1), rest get base
-- Result: four integers whose average is base + excess/4 (i.e. rating rounded to
-- nearest 0.25). Preserves the public-facing rating for reviews that have never
-- had sub-scores curated.
update reviews
set
  score_quality   = floor(rating)::int + case when round((rating - floor(rating))::numeric * 4)::int >= 1 then 1 else 0 end,
  score_value     = floor(rating)::int + case when round((rating - floor(rating))::numeric * 4)::int >= 2 then 1 else 0 end,
  score_ease      = floor(rating)::int + case when round((rating - floor(rating))::numeric * 4)::int >= 3 then 1 else 0 end,
  score_daily_use = floor(rating)::int + case when round((rating - floor(rating))::numeric * 4)::int >= 4 then 1 else 0 end
where rating is not null
  and score_quality   is null
  and score_value     is null
  and score_ease      is null
  and score_daily_use is null;

-- Step 2 — fill any remaining null sub-scores with ROUND(rating). Touches reviews
-- that were mid-curation (some sub-scores set, others not).
update reviews
set
  score_quality   = coalesce(score_quality,   round(rating)::int),
  score_value     = coalesce(score_value,     round(rating)::int),
  score_ease      = coalesce(score_ease,      round(rating)::int),
  score_daily_use = coalesce(score_daily_use, round(rating)::int)
where rating is not null
  and (score_quality is null or score_value is null or score_ease is null or score_daily_use is null);

-- Step 3 — defensive clamp into 1..10. No-op given the existing rating CHECK was
-- 1.0..10.0 and the sub-score CHECK is 1..10, but doesn't hurt to verify.
update reviews
set
  score_quality   = greatest(1, least(10, score_quality)),
  score_value     = greatest(1, least(10, score_value)),
  score_ease      = greatest(1, least(10, score_ease)),
  score_daily_use = greatest(1, least(10, score_daily_use))
where score_quality is not null;

-- Step 4 — drop the editable rating column.
alter table reviews drop constraint if exists reviews_rating_check;
alter table reviews drop column rating;

-- Step 5 — recreate as a stored generated column.
-- numeric(4,2) keeps full quarter-point precision (e.g. 8.25). VerdictCard renders
-- with toFixed(1) so the on-page display rounds to one decimal.
alter table reviews
  add column rating numeric(4,2) generated always as (
    case
      when score_quality   is not null
       and score_value     is not null
       and score_ease      is not null
       and score_daily_use is not null
      then ((score_quality + score_value + score_ease + score_daily_use)::numeric / 4.0)
      else null
    end
  ) stored;

comment on column reviews.rating is
  'Overall 1.0-10.0 rating, generated from the average of the four sub-scores. NULL until all four are populated. Source of truth = the sub-scores. Editors must adjust sub-scores, not rating.';

commit;

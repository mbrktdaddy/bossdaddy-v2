-- ─────────────────────────────────────────────────────────────────────────────
-- 089_specs_grade.sql
--
-- Adds the AI-graded Specs axis as an OPTIONAL 5th sub-score and folds it into
-- the generated overall rating (present-only average), plus storage for the
-- grade's rationale and the reusable comparison artifact (competitor matrix +
-- web citations).
--
-- Specs grade = how the product's MEASURABLE specs rank vs comparable models
-- (AI-graded with live web sources, author-reviewed). It is distinct from
-- score_quality (hands-on build/materials) — a product can have great specs and
-- flimsy build, so they don't double-count.
--
-- No RLS changes: the existing reviews policies cover the new columns. Existing
-- reviews have score_specs NULL, so their overall is unchanged (see below).
-- ─────────────────────────────────────────────────────────────────────────────

alter table reviews
  add column if not exists score_specs smallint check (score_specs between 1 and 10),
  add column if not exists specs_grade_rationale text,
  add column if not exists specs_grade_data jsonb not null default '{}'::jsonb;

comment on column reviews.score_specs is
  'Optional 5th sub-score (1-10): how the product''s measurable specs rank vs comparable models. AI-graded with web sources + author review. Distinct from score_quality (hands-on build). NULL = not graded.';
comment on column reviews.specs_grade_rationale is
  'Editor-reviewed prose explaining the specs grade. Shown in the public "how the specs stack up" disclosure.';
comment on column reviews.specs_grade_data is
  'Reusable comparison artifact: { comparedAgainst:[{name,brand,keySpecs,sourceUrl}], sources:[{title,url}], gradedAt }. Powers the public disclosure and can seed Vault comparisons.';

-- Redefine the generated overall as a PRESENT-ONLY average that folds in the
-- specs axis when it's set. Behavior is preserved:
--   • rating stays NULL until all four experiential sub-scores exist;
--   • legacy reviews (score_specs NULL) keep their exact /4 average;
--   • graded reviews average over five.
-- Dropping the column cascade-drops idx_reviews_rating_status_visible
-- (migration 052) — it is recreated at the end. `rating` is derived, so no data
-- is lost: it recomputes from the existing sub-scores on recreation.
alter table reviews drop column if exists rating;

alter table reviews
  add column rating numeric(4,2) generated always as (
    case
      when score_quality   is not null
       and score_value     is not null
       and score_ease      is not null
       and score_daily_use is not null
      then case
        when score_specs is not null
          then ((score_quality + score_value + score_ease + score_daily_use + score_specs)::numeric / 5.0)
          else ((score_quality + score_value + score_ease + score_daily_use)::numeric / 4.0)
      end
      else null
    end
  ) stored;

comment on column reviews.rating is
  'Overall 1.0-10.0 rating, generated as the present-only average of the sub-scores. NULL until all four experiential sub-scores (quality/value/ease/daily_use) are set; includes score_specs in the average only when that 5th axis is graded. Source of truth = the sub-scores.';

-- Recreate the index the column drop cascaded away (verbatim from migration 052).
create index if not exists idx_reviews_rating_status_visible
  on reviews (rating desc, status, is_visible)
  where status = 'approved' and is_visible = true;

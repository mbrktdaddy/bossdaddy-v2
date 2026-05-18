-- Migration 069: Wishlist Phase 2 — follow-up reviews
--
-- Adds a parent/child relationship to `reviews` so the editor can publish
-- longform follow-ups ("6-month update", "1-year retest") that link back to
-- the original review. Closes the lifecycle loop: wishlist → review → update.
--
-- Doctrine decisions baked in here (see [[wishlist-phase2-spec]] for the why):
--   • One level deep — follow-ups cannot have follow-ups. Enforced by trigger.
--   • Verdict change is editorial, not derived from the rating delta.
--   • Forward-going only — existing reviews stay parent-less. No backfill.
--   • Hub-and-spoke — each follow-up gets its own slug (existing UNIQUE stands).
--
-- RLS: no changes needed. Follow-ups are regular `reviews` rows and obey the
-- existing public-read / author-write / admin-moderate policies.

alter table reviews
  add column parent_review_id uuid references reviews(id) on delete set null,
  add column milestone_label  text,
  add column milestone_days   integer,
  add column previous_rating  numeric(4,2) check (previous_rating >= 1 and previous_rating <= 10),
  add column verdict_change   text check (verdict_change in ('improved','unchanged','declined','complete_reversal'));

comment on column reviews.parent_review_id is
  'If set, this row is a follow-up of the referenced top-level review. NULL for original reviews. One level deep only — enforced by trg_reviews_parent_toplevel.';
comment on column reviews.milestone_label is
  'Editor-picked label for the follow-up cadence (e.g. "6-month update", "1-year retest"). NULL on top-level reviews.';
comment on column reviews.milestone_days is
  'Days between the parent''s published_at and this follow-up''s scheduled publish. Sort key for the timeline strip. NULL on top-level reviews.';
comment on column reviews.previous_rating is
  'Snapshot of the parent''s rating at the time this follow-up was authored. Frozen so the verdict-change badge stays faithful even if the parent''s computed rating shifts later. NULL on top-level reviews.';
comment on column reviews.verdict_change is
  'Editorial categorization of how the follow-up rating compares to the parent: improved / unchanged / declined / complete_reversal. Drives the badge color and copy. NULL on top-level reviews.';

-- Cycle guard: a follow-up's parent must itself be top-level (no chains), and
-- a row can't be its own parent. Keeps the timeline a single hop and avoids
-- accidental SQL recursion.
create or replace function check_review_parent_is_toplevel()
returns trigger as $$
begin
  if new.parent_review_id is not null then
    if new.parent_review_id = new.id then
      raise exception 'A review cannot be its own parent';
    end if;
    if exists (
      select 1 from reviews
      where id = new.parent_review_id
        and parent_review_id is not null
    ) then
      raise exception 'parent_review_id must reference a top-level review (no chains of follow-ups)';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_reviews_parent_toplevel on reviews;
create trigger trg_reviews_parent_toplevel
  before insert or update of parent_review_id on reviews
  for each row execute function check_review_parent_is_toplevel();

-- "Find all follow-ups of this parent" — drives the timeline strip on review
-- detail pages. Partial index keeps it tight (most rows are top-level).
create index if not exists idx_reviews_parent
  on reviews (parent_review_id)
  where parent_review_id is not null;

-- "Top-level approved+visible reviews, newest first" — drives the dashboard
-- "Follow-ups due" card. Partial index since the card only ever queries this
-- exact shape.
create index if not exists idx_reviews_toplevel_published
  on reviews (published_at desc nulls last)
  where parent_review_id is null
    and status = 'approved'
    and is_visible = true;

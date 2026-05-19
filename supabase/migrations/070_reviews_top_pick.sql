-- Migration 070: Mark a review as Boss's #1 all-time pick.
-- Drives the "Boss's #1 Pick" slot at the top of /gear.
--
-- Distinct from reviews.featured (migration 062, which drives the
-- /reviews directory's featured card and the homepage hero fallback).
-- `featured` is the time-bound spotlight; `is_top_pick` is the all-time
-- champion that mutates rarely.
--
-- API-layer logic enforces single-top-pick-at-a-time, mirroring the
-- mutual-exclusion pattern from the featured-review work.

alter table reviews add column if not exists is_top_pick boolean not null default false;

-- Partial index — only the (typically 0 or 1) top-pick rows take space.
create index if not exists idx_reviews_is_top_pick
  on reviews (is_top_pick) where is_top_pick = true;

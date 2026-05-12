-- Migration 062: Mark reviews as homepage-featured.
-- Mirrors the merch.featured pattern from migration 057.
-- The homepage hero query prefers `featured = true`, falls back to top-rated.
-- API-layer logic enforces single-featured-at-a-time so the admin never has
-- to wonder which one is showing.

alter table reviews add column if not exists featured boolean not null default false;

-- Partial index — only the (typically 0 or 1) featured rows take space.
create index if not exists idx_reviews_featured
  on reviews (featured) where featured = true;

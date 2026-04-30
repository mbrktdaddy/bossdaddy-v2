-- Performance indexes derived from speed audit (2026-04-28).
-- Listing pages filter by status='approved' AND is_visible=true and order by
-- published_at DESC. Author + gear pages add author_id / rating filters.
-- Composite indexes match those access patterns to avoid sequential scans.

-- /reviews and /guides all-views
create index if not exists idx_reviews_status_visible_published
  on reviews (status, is_visible, published_at desc);

create index if not exists idx_guides_status_visible_published
  on guides (status, is_visible, published_at desc);

-- Category-filtered listing variants (/reviews?category=, /guides?category=)
create index if not exists idx_reviews_status_visible_category_published
  on reviews (status, is_visible, category, published_at desc);

create index if not exists idx_guides_status_visible_category_published
  on guides (status, is_visible, category, published_at desc);

-- /author/[username] — pulls all approved+visible content for an author
create index if not exists idx_reviews_author_status_visible
  on reviews (author_id, status, is_visible);

create index if not exists idx_guides_author_status_visible
  on guides (author_id, status, is_visible);

-- /gear — orders by rating desc, filters rating >= 8, status, visibility
create index if not exists idx_reviews_rating_status_visible
  on reviews (rating desc, status, is_visible)
  where status = 'approved' and is_visible = true;

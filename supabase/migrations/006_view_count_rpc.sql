-- Atomic view count increment function
-- Called from /api/reviews/[id]/view and /api/articles/[id]/view

CREATE OR REPLACE FUNCTION increment_review_views(row_id UUID)
RETURNS void AS $$
  UPDATE reviews SET view_count = view_count + 1 WHERE id = row_id;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_article_views(row_id UUID)
RETURNS void AS $$
  UPDATE articles SET view_count = view_count + 1 WHERE id = row_id;
$$ LANGUAGE sql SECURITY DEFINER;

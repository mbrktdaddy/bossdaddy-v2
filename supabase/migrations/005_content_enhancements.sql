-- Article hero image support
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- View count tracking for analytics and popular sorting
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Reading time (minutes) — computed and stored on save
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER;

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS reading_time_minutes INTEGER;

-- Full-text search vector for reviews
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(product_name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(excerpt, '')), 'B')
    ) STORED;

CREATE INDEX IF NOT EXISTS reviews_search_idx ON reviews USING GIN (search_vector);

-- Full-text search vector for articles
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(excerpt, '')), 'B')
    ) STORED;

CREATE INDEX IF NOT EXISTS articles_search_idx ON articles USING GIN (search_vector);

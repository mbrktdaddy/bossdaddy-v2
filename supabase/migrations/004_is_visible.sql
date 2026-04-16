-- Add is_visible flag to reviews and articles
-- Allows soft-hiding live content without changing status or triggering re-moderation

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;

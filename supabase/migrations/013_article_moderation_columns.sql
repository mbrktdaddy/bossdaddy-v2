-- Add moderation columns to articles table to match reviews schema
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS moderation_score  NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS moderation_flags  JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rejection_reason  TEXT;

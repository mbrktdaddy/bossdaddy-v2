-- Trust tier for commenters
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trusted_commenter BOOLEAN NOT NULL DEFAULT false;

-- Moderation tracking on comments
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS moderation_score NUMERIC(3,2),
  ADD COLUMN IF NOT EXISTS moderation_flags JSONB NOT NULL DEFAULT '[]'::jsonb;

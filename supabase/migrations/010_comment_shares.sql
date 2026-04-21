-- Track how many times each comment has been shared
CREATE TABLE IF NOT EXISTS comment_shares (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID REFERENCES comments ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comment_shares_comment_idx ON comment_shares (comment_id);

-- Anyone can insert a share (anonymous tracking, no auth needed)
ALTER TABLE comment_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a share"
  ON comment_shares FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read share counts"
  ON comment_shares FOR SELECT
  USING (true);

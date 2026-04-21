-- Extend the likes content_type constraint to include comments
ALTER TABLE likes DROP CONSTRAINT IF EXISTS likes_content_type_check;
ALTER TABLE likes ADD CONSTRAINT likes_content_type_check
  CHECK (content_type IN ('review', 'article', 'comment'));

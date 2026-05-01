-- Migration 038: Allow comments on wishlist_items (bench items)
-- Adds 'wishlist_item' to the content_type CHECK constraint on comments.

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_content_type_check;

ALTER TABLE comments
  ADD CONSTRAINT comments_content_type_check
  CHECK (content_type IN ('review', 'guide', 'wishlist_item'));

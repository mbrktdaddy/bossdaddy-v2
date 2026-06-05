-- ─────────────────────────────────────────────────────────────────────────────
-- 093 — Bench (wishlist_items) gallery images
--
-- Additive: keep `image_url` as the single cover (used by every card, strip,
-- the homepage panel, OffTheBench, and SEO — unchanged) and add a gallery of
-- ADDITIONAL photos shown only on the bench detail page. Nothing that reads
-- `image_url` is affected.
--
-- No RLS changes: `gallery_images` is a column on the existing wishlist_items
-- table, already covered by its policies (public read, admin write).
-- ─────────────────────────────────────────────────────────────────────────────

alter table wishlist_items
  add column if not exists gallery_images text[] not null default '{}';

comment on column wishlist_items.gallery_images is
  'Additional product photos shown on the bench detail page. image_url remains the cover used everywhere else.';

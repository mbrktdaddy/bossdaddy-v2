-- Migration 071: Mark a guide as the featured guide.
-- Drives the featured card at the top of /guides and serves as a
-- candidate for the polymorphic homepage hero (see migration 072).
--
-- Mirrors the merch.featured pattern (migration 057) and the
-- reviews.featured pattern (migration 062). API-layer logic enforces
-- single-featured-at-a-time so the admin never has to think about
-- mutual exclusion.

alter table guides add column if not exists featured boolean not null default false;

create index if not exists idx_guides_featured
  on guides (featured) where featured = true;

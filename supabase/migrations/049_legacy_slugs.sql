-- Migration 049: Track legacy slugs for 301 redirects
--
-- Phase 2 of the slug cleanup. After backfilling existing reviews + guides
-- with clean slugs (no -bf830b06-style hash suffix), the old slug is appended
-- to legacy_slugs[] so proxy.ts can 301 old URLs → new URLs and preserve
-- inbound links / GSC backlink signal.
--
-- GIN index supports the `slug ILIKE '%foo%'` style lookup we'll do in
-- proxy.ts: `.contains('legacy_slugs', [oldSlug])`.

alter table reviews add column if not exists legacy_slugs text[] not null default array[]::text[];
alter table guides  add column if not exists legacy_slugs text[] not null default array[]::text[];

create index if not exists idx_reviews_legacy_slugs on reviews using gin (legacy_slugs);
create index if not exists idx_guides_legacy_slugs  on guides  using gin (legacy_slugs);

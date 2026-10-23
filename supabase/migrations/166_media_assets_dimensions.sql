-- ─────────────────────────────────────────────────────────────────────────────
-- 166 — media_assets.width / height (content pipeline plan, Phase 3 images;
-- see docs/content-pipeline-plan.md §6)
--
-- Body figures render through next/image, which needs the intrinsic size to
-- reserve space (no layout shift) and to build a srcset. AI generations know
-- their size from the request; uploads already compute it in `normalizeImage`
-- but the upload route dropped it. Both now store it here, and the public
-- pages look it up by URL for figures written before this column existed, so
-- disclosure (`origin`) and dimensions are retroactive without rewriting any
-- stored HTML.
--
-- Nullable on purpose: rows indexed from other sources (Amazon import, old
-- heroes backfilled by mig 114) have no size until
-- `node scripts/backfill-media-dimensions.mjs` reads it from the file.
-- No RLS change — the policies from 014 stand.
-- ─────────────────────────────────────────────────────────────────────────────

alter table media_assets
  add column if not exists width  integer check (width  is null or width  > 0),
  add column if not exists height integer check (height is null or height > 0);

comment on column media_assets.width  is 'Intrinsic pixel width of the stored file (null = not yet measured; see scripts/backfill-media-dimensions.mjs).';
comment on column media_assets.height is 'Intrinsic pixel height of the stored file (null = not yet measured).';

-- Migration 114: media_assets source linkage + hero backfill
--
-- PROBLEM: /api/images/hero uploads generated hero images to the
-- guide-images / review-images buckets but never inserts a media_assets row.
-- The media library + MediaPicker read media_assets, so hero images have been
-- invisible to the library — you couldn't reuse a guide/review's hero elsewhere
-- (e.g. attaching it to an X post). Inline article images (via /api/images/generate)
-- ARE indexed, so a guide's inline images showed up but its hero didn't.
--
-- FIX (going forward): the hero route now inserts a media_assets row and stamps
-- it with source_type/source_id so the picker can filter "images from THIS
-- guide/review". FIX (existing rows): backfill below.
--
-- No RLS change — media_assets policies (mig 014) already gate to admin/author.

alter table media_assets
  add column if not exists source_type text
    check (source_type is null or source_type in ('guide', 'review')),
  add column if not exists source_id uuid;

-- Query shape: "show me every image belonging to this guide/review".
create index if not exists idx_media_assets_source
  on media_assets (source_type, source_id)
  where source_type is not null;


-- ─── Backfill: index existing guide/review hero images ───────────────────────
-- For each guide/review with a hero image_url that isn't already a media_assets
-- row (dedupe by url — heroes picked from the library or uploaded already have
-- rows), insert one. bucket + filename are parsed from the public storage URL so
-- the usage-aware delete (which does storage.remove(bucket, filename)) still works.
--   URL shape: .../storage/v1/object/public/<bucket>/<path...>
--   bucket   = first path segment after /public/
--   filename = everything after that (the storage key within the bucket)

insert into media_assets (url, bucket, filename, alt_text, uploaded_by, file_size, mime_type, source_type, source_id, created_at)
select
  g.image_url,
  coalesce(substring(g.image_url from '/public/([^/]+)/'), 'guide-images')      as bucket,
  regexp_replace(g.image_url, '^.*/public/[^/]+/', '')                          as filename,
  g.title                                                                        as alt_text,
  g.author_id                                                                    as uploaded_by,
  0                                                                              as file_size,
  'image/webp'                                                                   as mime_type,
  'guide'                                                                        as source_type,
  g.id                                                                           as source_id,
  now()                                                                          as created_at
from guides g
where g.image_url is not null
  and g.image_url <> ''
  and not exists (select 1 from media_assets m where m.url = g.image_url);

insert into media_assets (url, bucket, filename, alt_text, uploaded_by, file_size, mime_type, source_type, source_id, created_at)
select
  r.image_url,
  coalesce(substring(r.image_url from '/public/([^/]+)/'), 'review-images')     as bucket,
  regexp_replace(r.image_url, '^.*/public/[^/]+/', '')                          as filename,
  r.title                                                                        as alt_text,
  r.author_id                                                                    as uploaded_by,
  0                                                                              as file_size,
  'image/webp'                                                                   as mime_type,
  'review'                                                                       as source_type,
  r.id                                                                           as source_id,
  now()                                                                          as created_at
from reviews r
where r.image_url is not null
  and r.image_url <> ''
  and not exists (select 1 from media_assets m where m.url = r.image_url);

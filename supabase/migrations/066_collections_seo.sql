-- Migration 066: SEO overrides on collections
--
-- Adds meta_title and meta_description so editors can override the
-- search-engine-facing metadata for each collection. The public detail pages
-- (/picks/[slug], /comparisons/[slug], /stacks/[slug], /gifts/[occasion])
-- prefer these when set, falling back to the collection's title +
-- description otherwise.

alter table collections
  add column if not exists meta_title       text,
  add column if not exists meta_description text;

comment on column collections.meta_title is
  'Optional override for the HTML <title> tag and OG title. ~70 char practical limit. Falls back to title.';
comment on column collections.meta_description is
  'Optional override for the meta description and OG description. ~155 char practical limit. Falls back to description.';

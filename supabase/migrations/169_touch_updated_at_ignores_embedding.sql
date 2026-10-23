-- ─────────────────────────────────────────────────────────────────────────────
-- 169 — touch_updated_at: only a REAL change stamps updated_at
--
-- WHY: `touch_updated_at()` (mig 001) sets NEW.updated_at = now() on every
-- UPDATE, whatever changed. The Boss's embedding refresh (lib/boss/embedContent.ts,
-- cron every 15 min) writes `embedding` on reviews + guides with a plain UPDATE,
-- so each refresh re-stamps the row as "edited" — the same class of lie mig 131
-- removed for view counters. Everything keyed on updated_at then drifts:
--   • lib/og.ts derives the og:image cache-buster from it → a new card URL,
--     cold Satori render, and social caches that never hit
--   • app/sitemap.ts <lastmod> and JSON-LD dateModified claim an edit that
--     didn't happen
--   • the freshness sweep's `stale` rule for guides (mig 167) reads updated_at
--     as "last touched by the author" — an embedding refresh would hide a
--     year-old guide
-- Steady state the blast radius is small (the embedding is only re-nulled
-- after a title/excerpt edit, so the double-stamp lands within ~15 min of a
-- real edit), but a model change re-embeds EVERY row and would stamp the whole
-- site "modified today" at once — exactly what happened with views.
--
-- FIX: compare the row images minus the columns that can't be compared:
--   • updated_at (the thing being decided) and embedding (the refresh write);
--   • every STORED GENERATED column of the table (reviews.rating,
--     reviews/guides.search_vector). In a BEFORE ROW trigger those are not yet
--     computed in NEW — they read as null while OLD carries the stored value —
--     so a naive diff ALWAYS differs and the stamp never stops. Looked up from
--     pg_attribute at run time (a syscache hit), so a future generated column
--     can't quietly re-break this.
-- If nothing else changed, leave updated_at alone (an explicit app-set value
-- still lands, because NEW already carries it). Generic on purpose — the
-- function is shared by comments, products, voice_profiles, collections and
-- content_runs, and a no-op UPDATE should never read as an edit on any of
-- them. `jsonb - text[]` with absent keys is a no-op, so tables without
-- `embedding` or generated columns are unaffected.
--
-- Cost: to_jsonb of both row images + one catalog lookup per UPDATE. Reviews
-- carry long HTML and a 1536-dim vector; at this site's write rate that is
-- microseconds against a network round-trip.
--
-- REMINDER (mig 131 gotcha, unchanged): a repair UPDATE that must NOT bump
-- updated_at still has to `alter table X disable trigger user` around it when
-- it changes a real column.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
declare
  skip text[];
begin
  -- Housekeeping columns + this table's stored generated columns (null in NEW
  -- inside a BEFORE trigger, so they can never be compared here).
  select coalesce(array_agg(attname::text), '{}'::text[])
    into skip
    from pg_attribute
   where attrelid = tg_relid
     and attnum > 0
     and not attisdropped
     and attgenerated <> '';
  skip := skip || array['updated_at', 'embedding'];

  if (to_jsonb(new) - skip) is distinct from (to_jsonb(old) - skip) then
    new.updated_at := now();
  end if;
  return new;
end $$;

comment on function touch_updated_at() is
  'BEFORE UPDATE: stamps updated_at only when a column other than updated_at / embedding / a stored generated column changed (mig 169). Embedding refreshes and no-op updates are not edits.';

-- Verify after applying (expect unchanged = true):
--   with g as (select id, updated_at as before from guides where status = 'approved' limit 1),
--        u as (update guides set embedding = embedding where id = (select id from g) returning updated_at as after)
--   select g.id, g.before, u.after, (g.before = u.after) as unchanged from g, u;
-- And that a real edit STILL stamps (expect unchanged = false):
--   with g as (select id, updated_at as before, excerpt from guides where status = 'approved' limit 1),
--        u as (update guides set excerpt = excerpt || ' ' where id = (select id from g) returning updated_at as after)
--   select (g.before = u.after) as unchanged from g, u;
--   -- then put the excerpt back: update guides set excerpt = rtrim(excerpt) where id = '<id>';

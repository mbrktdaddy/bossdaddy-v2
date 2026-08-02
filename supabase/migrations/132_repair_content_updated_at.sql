-- Migration 132: Repair the `updated_at` values that view-tracking corrupted
-- Apply via: supabase db push  OR paste into Supabase SQL editor
-- DO NOT push automatically — applied manually by operator.
-- Idempotent — safe to re-run (it recomputes from source data, not from the
-- current value).
--
-- APPLY THIS ONLY AFTER 131. 131 stops the corruption; this cleans up what
-- already happened. Running it first would just re-pollute on the next view.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY
--
-- Until 131, every page view stamped `updated_at = now()` on the content row
-- (see that file's header). So the stored values do not mean "last edited" —
-- they mean "last time somebody read this". Measured 2026-08-02: reviews and
-- guides published in April 2026 were reporting a modified time of that
-- morning, and that value is what feeds og:image cache-busting, sitemap
-- lastModified, article:modified_time and JSON-LD dateModified.
--
-- `content_revisions` (migration 015) snapshots every real save with a
-- timestamp, and migration 034 corrected its content_type values to
-- ('review','guide'), so it is a trustworthy record of genuine edits for both
-- content types. We rebuild `updated_at` as the latest of:
--     published_at, created_at, and the newest recorded revision.
--
-- GREATEST ignores NULLs in Postgres, so missing pieces simply drop out; the
-- outer coalesce keeps the current value if somehow nothing is computable.
--
-- Accepted caveat: lib/revisions.ts prunes to the 50 most recent revisions per
-- item, so edit history older than that may be gone. Those items fall back to
-- published_at — earlier than the truth, but defensible, and vastly better
-- than "whenever it was last viewed". Dates will move backwards once; that is
-- the correction, and it is a one-time event.
-- ─────────────────────────────────────────────────────────────────────────────


-- The `touch_updated_at()` BEFORE UPDATE trigger would overwrite every value we
-- write here with now() — the repair would appear to run cleanly and change
-- nothing. Disabling user triggers for the duration is the whole trick.
--
-- This also briefly disables trg_{reviews,guides}_embedding_stale (migration
-- 125). Harmless: that trigger only nulls `embedding` when title/excerpt change,
-- and we touch neither. Requires table ownership — run as the `postgres` role
-- (the Supabase SQL editor does).

alter table reviews disable trigger user;
alter table guides  disable trigger user;

update reviews r
set updated_at = coalesce(
  greatest(
    r.published_at,
    r.created_at,
    (select max(cr.created_at)
       from content_revisions cr
      where cr.content_type = 'review'
        and cr.content_id   = r.id)
  ),
  r.updated_at
)
where r.updated_at is distinct from coalesce(
  greatest(
    r.published_at,
    r.created_at,
    (select max(cr.created_at)
       from content_revisions cr
      where cr.content_type = 'review'
        and cr.content_id   = r.id)
  ),
  r.updated_at
);

update guides g
set updated_at = coalesce(
  greatest(
    g.published_at,
    g.created_at,
    (select max(cr.created_at)
       from content_revisions cr
      where cr.content_type = 'guide'
        and cr.content_id   = g.id)
  ),
  g.updated_at
)
where g.updated_at is distinct from coalesce(
  greatest(
    g.published_at,
    g.created_at,
    (select max(cr.created_at)
       from content_revisions cr
      where cr.content_type = 'guide'
        and cr.content_id   = g.id)
  ),
  g.updated_at
);

alter table reviews enable trigger user;
alter table guides  enable trigger user;


-- ─── Report ──────────────────────────────────────────────────────────────────
-- Anything still claiming it was modified in the last day is worth a look —
-- after this runs, that should only be content genuinely edited today.

do $$
declare
  r_recent integer;
  g_recent integer;
begin
  select count(*) into r_recent from reviews where updated_at > now() - interval '1 day';
  select count(*) into g_recent from guides  where updated_at > now() - interval '1 day';
  raise notice 'repair complete — still modified within 24h: % reviews, % guides', r_recent, g_recent;
end $$;

-- Migration 129: rename category slug 'tech-edc' → 'tech-gadgets'
--
-- WHY
--   The pillar was relabeled "Tech & EDC" → "Tech & Gadgets" in #60, but only
--   the display label changed. The slug stayed 'tech-edc' and it is a public
--   URL segment on five route families (/category, /gear/category,
--   /guides/category, /reviews/category, /feed/category), so every one of
--   those URLs contradicted the label it rendered.
--
--   Normally the Naming Doctrine says leave the slug alone forever and fix the
--   label. The exception it carves out is exactly this case: the user-facing
--   URL is wrong. Verified zero content rows before renaming —
--   guides/reviews/products/media_assets all had 0 rows on 'tech-edc'.
--
--   301s for the old URLs live in lib/proxy/rewrites.ts (LEGACY_CATEGORY_SLUGS).
--   Do not remove them.
--
-- This is the first exercise of migration 128's ON UPDATE CASCADE: the single
-- UPDATE below propagates to guides, reviews, products, media_assets, and tags
-- automatically. Only the two deliberately un-FK'd LLM staging tables need a
-- manual pass.

BEGIN;

-- Cascades to all five FK'd tables (128). Affects 4 tags rows; the content
-- tables hold 0 'tech-edc' rows.
update categories
   set slug = 'tech-gadgets', updated_at = now()
 where slug = 'tech-edc';

-- Not FK'd on purpose (LLM-fed staging — see 128's scope note), so these do
-- not cascade and must be updated by hand.
update boss_research_requests set category = 'tech-gadgets' where category = 'tech-edc';
update boss_research_cache    set category = 'tech-gadgets' where category = 'tech-edc';

-- Belt-and-braces: fail loudly rather than leave a half-renamed taxonomy.
do $$
declare
  leftovers integer;
begin
  select
      (select count(*) from categories             where slug     = 'tech-edc')
    + (select count(*) from guides                 where category = 'tech-edc')
    + (select count(*) from reviews                where category = 'tech-edc')
    + (select count(*) from products               where category = 'tech-edc')
    + (select count(*) from media_assets           where category = 'tech-edc')
    + (select count(*) from tags                   where category_slug = 'tech-edc')
    + (select count(*) from boss_research_requests where category = 'tech-edc')
    + (select count(*) from boss_research_cache    where category = 'tech-edc')
  into leftovers;

  if leftovers > 0 then
    raise exception 'tech-edc rename incomplete: % row(s) still reference the old slug', leftovers;
  end if;
end $$;

COMMIT;

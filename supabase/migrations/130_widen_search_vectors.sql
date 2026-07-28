-- 130 — widen the full-text search vectors for reviews + guides
--
-- WHY: The Boss answered "no tested pick on gas grills yet" while an approved,
-- 8/10, six-months-tested Weber Genesis gas grill review sat in the vault. The
-- concierge was behaving correctly on bad retrieval.
--
-- Root cause: both search vectors indexed only the shallowest fields.
--     reviews : title(A) + product_name(A) + excerpt(B)
--     guides  : title(A) + excerpt(B)
-- The 9,310-character review BODY — every mention of propane, burners, sear
-- zones, BTUs — was indexed nowhere. A review was findable only by words in its
-- headline. Guides were worse: two fields, and guides are the "bread and butter"
-- surface.
--
-- WHAT CHANGES: add tldr, category, and content, weighted so the headline still
-- dominates ranking and the body only adds recall:
--     A = title / product_name   (unchanged — strongest signal)
--     B = excerpt, tldr          (the hand-written summaries)
--     C = category               (e.g. "grilling-cooking" -> grill, cook)
--     D = content                (the body; recall only, lowest rank weight)
--
-- NOTE ON SCOPE: this fixes LEXICAL recall (propane grill, burner, sear zone).
-- It does NOT by itself fix the literal query "gas grills" — verified: the review
-- never uses the word "gas", only "propane". That one is fixed on the SEMANTIC
-- side by widening the embedded text in lib/boss/embedContent.ts, where the model
-- bridges gas<->propane. The two halves are complementary and ship together.
--
-- SAFETY: search_vector is a GENERATED column, so Postgres recomputes every row
-- on ALTER. No backfill, no application change, no downtime concern at this table
-- size. The tsvector index is rebuilt with it. Purely additive — every term that
-- matched before still matches, at the same weight.
--
-- Reversible: re-run the original expressions (kept in the rollback note below).

-- ── reviews ─────────────────────────────────────────────────────────────────
alter table reviews drop column if exists search_vector;

alter table reviews
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(product_name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(tldr, '')), 'B') ||
    setweight(to_tsvector('english', replace(coalesce(category, ''), '-', ' ')), 'C') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'D')
  ) stored;

create index if not exists reviews_search_vector_idx on reviews using gin (search_vector);

-- ── guides ──────────────────────────────────────────────────────────────────
alter table guides drop column if exists search_vector;

alter table guides
  add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(tldr, '')), 'B') ||
    setweight(to_tsvector('english', replace(coalesce(category, ''), '-', ' ')), 'C') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'D')
  ) stored;

create index if not exists guides_search_vector_idx on guides using gin (search_vector);

-- ── embedding staleness triggers (migration 125) ────────────────────────────
-- These null a row's embedding when its EMBEDDED SOURCE TEXT changes, so the
-- cron re-embeds it. lib/boss/embedContent.ts now feeds tldr + category + a
-- bounded slice of content into that text, so the triggers must watch those
-- columns too — otherwise editing a review body leaves a stale vector forever
-- and the row silently drifts out of semantic reach. Keep this list and
-- reviewText()/guideText() in sync.
create or replace function public.boss_mark_review_embedding_stale()
returns trigger language plpgsql as $function$
begin
  if (new.title        is distinct from old.title
      or new.product_name is distinct from old.product_name
      or new.excerpt   is distinct from old.excerpt
      or new.tldr      is distinct from old.tldr
      or new.category  is distinct from old.category
      or new.content   is distinct from old.content) then
    new.embedding := null;
  end if;
  return new;
end $function$;

create or replace function public.boss_mark_guide_embedding_stale()
returns trigger language plpgsql as $function$
begin
  if (new.title is distinct from old.title
      or new.excerpt  is distinct from old.excerpt
      or new.tldr     is distinct from old.tldr
      or new.category is distinct from old.category
      or new.content  is distinct from old.content) then
    new.embedding := null;
  end if;
  return new;
end $function$;

-- Force a one-time re-embed of the whole catalog against the widened source
-- text. The cron (/api/cron/embed-content, */15) picks up every null embedding;
-- `npm run embed:content` does it immediately.
update reviews set embedding = null where status = 'approved' and is_visible = true;
update guides  set embedding = null where status = 'approved' and is_visible = true;

-- ROLLBACK (paste to revert):
--   alter table reviews drop column search_vector;
--   alter table reviews add column search_vector tsvector generated always as (
--     setweight(to_tsvector('english', coalesce(title,'')),'A') ||
--     setweight(to_tsvector('english', coalesce(product_name,'')),'A') ||
--     setweight(to_tsvector('english', coalesce(excerpt,'')),'B')) stored;
--   create index if not exists reviews_search_vector_idx on reviews using gin (search_vector);
--   alter table guides drop column search_vector;
--   alter table guides add column search_vector tsvector generated always as (
--     setweight(to_tsvector('english', coalesce(title,'')),'A') ||
--     setweight(to_tsvector('english', coalesce(excerpt,'')),'B')) stored;
--   create index if not exists guides_search_vector_idx on guides using gin (search_vector);

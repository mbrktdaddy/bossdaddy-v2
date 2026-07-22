-- ─────────────────────────────────────────────────────────────────────────────
-- 125_boss_semantic_search.sql
-- Hybrid (semantic + full-text) retrieval for "The Boss" concierge.
--
-- Replaces the lexical search_gear / search_guides queries (which over-matched on
-- common terms with no relevance ranking — a swing-set query rendered baby-formula
-- cards) with RRF-fused hybrid search: Postgres full-text for exact-keyword
-- precision + pgvector cosine similarity for meaning/recall (fixes swingset↔swing
-- set, synonyms, intent). Reciprocal-rank fusion + a cosine-similarity floor keep
-- only genuinely-relevant rows, so junk cards can't reach the renderer.
--
-- Embedding model is PINNED to cohere/embed-v4.0 (1536-dim, verified via
-- `npm run embed:smoke`). Vectors are model-specific: the vector(1536) column
-- dimension here and lib/ai/embedding.ts EMBEDDING_MODEL must change together, and
-- a model change means re-embedding every row. This pin is technical, not the
-- legal pin moderation carries — see lib/flags.ts.
--
-- reviews + guides are PUBLIC content (Pattern A); the embedding column is covered
-- by their existing RLS. No new table, no policy change.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists vector;

-- ── Embedding columns (nullable). A trigger nulls them whenever the embedded
-- source text changes, so the refresh job (cron / backfill) re-embeds — this
-- decouples freshness from the many publish paths (single / bulk / cron / submit),
-- so no code path can forget to re-embed.
alter table reviews add column if not exists embedding vector(1536);
alter table guides  add column if not exists embedding vector(1536);

-- HNSW cosine index — the modern pgvector index (better recall/latency than
-- ivfflat, no training step). Null embeddings are simply not indexed.
create index if not exists idx_reviews_embedding
  on reviews using hnsw (embedding vector_cosine_ops);
create index if not exists idx_guides_embedding
  on guides using hnsw (embedding vector_cosine_ops);

-- ── Freshness triggers: null the embedding when the embedded source text changes.
-- The app builds the embed text from title + product_name + excerpt (reviews) and
-- title + excerpt (guides); nulling on those columns is sufficient. The refresh
-- write itself (UPDATE ... SET embedding = <vec>) leaves title/excerpt unchanged,
-- so `is distinct from` is false and the fresh vector is NOT re-nulled.
create or replace function boss_mark_review_embedding_stale()
returns trigger language plpgsql as $$
begin
  if (new.title        is distinct from old.title
      or new.product_name is distinct from old.product_name
      or new.excerpt   is distinct from old.excerpt) then
    new.embedding := null;
  end if;
  return new;
end $$;

create or replace function boss_mark_guide_embedding_stale()
returns trigger language plpgsql as $$
begin
  if (new.title is distinct from old.title
      or new.excerpt is distinct from old.excerpt) then
    new.embedding := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_reviews_embedding_stale on reviews;
create trigger trg_reviews_embedding_stale
  before update on reviews
  for each row execute function boss_mark_review_embedding_stale();

drop trigger if exists trg_guides_embedding_stale on guides;
create trigger trg_guides_embedding_stale
  before update on guides
  for each row execute function boss_mark_guide_embedding_stale();

-- ── Hybrid search RPCs (RRF fusion of full-text + vector) ────────────────────
-- SECURITY INVOKER (default): runs under the caller's RLS, so the anon concierge
-- client sees only approved + visible rows — the status/visibility filters below
-- are belt-and-suspenders + let the planner prune. The full-text side (websearch,
-- AND-semantics) supplies exact-keyword precision; the vector side supplies
-- semantic recall ABOVE a cosine-similarity floor (min_similarity) so weak,
-- off-topic matches never enter the fusion. RRF combines the two rank lists;
-- fused score decides the final order, capped at match_count.

create or replace function boss_hybrid_reviews(
  query_text       text,
  query_embedding  vector(1536),
  match_count      int   default 6,
  min_similarity   float default 0.25,
  rrf_k            int   default 50,
  price_min_cents  int   default null,
  price_max_cents  int   default null
)
returns setof reviews
language sql stable
as $$
  with fts as (
    select r.id,
           row_number() over (
             order by ts_rank_cd(r.search_vector, websearch_to_tsquery('english', query_text)) desc
           ) as rnk
    from reviews r
    where r.status = 'approved' and r.is_visible = true
      and query_text <> ''
      and r.search_vector @@ websearch_to_tsquery('english', query_text)
    limit 30
  ),
  vec as (
    select r.id,
           row_number() over (order by r.embedding <=> query_embedding) as rnk
    from reviews r
    where r.status = 'approved' and r.is_visible = true
      and r.embedding is not null
      and (1 - (r.embedding <=> query_embedding)) >= min_similarity
    limit 30
  ),
  fused as (
    select coalesce(fts.id, vec.id) as id,
           coalesce(1.0 / (rrf_k + fts.rnk), 0.0)
             + coalesce(1.0 / (rrf_k + vec.rnk), 0.0) as score
    from fts
    full outer join vec on fts.id = vec.id
  )
  select r.*
  from fused
  join reviews r on r.id = fused.id
  where (price_min_cents is null and price_max_cents is null)
     or exists (
       select 1 from products p
       where p.slug = r.product_slug
         and (price_min_cents is null or p.price_cents >= price_min_cents)
         and (price_max_cents is null or p.price_cents <= price_max_cents)
     )
  order by fused.score desc
  limit match_count
$$;

create or replace function boss_hybrid_guides(
  query_text       text,
  query_embedding  vector(1536),
  match_count      int   default 6,
  min_similarity   float default 0.25,
  rrf_k            int   default 50
)
returns setof guides
language sql stable
as $$
  with fts as (
    select g.id,
           row_number() over (
             order by ts_rank_cd(g.search_vector, websearch_to_tsquery('english', query_text)) desc
           ) as rnk
    from guides g
    where g.status = 'approved' and g.is_visible = true
      and query_text <> ''
      and g.search_vector @@ websearch_to_tsquery('english', query_text)
    limit 30
  ),
  vec as (
    select g.id,
           row_number() over (order by g.embedding <=> query_embedding) as rnk
    from guides g
    where g.status = 'approved' and g.is_visible = true
      and g.embedding is not null
      and (1 - (g.embedding <=> query_embedding)) >= min_similarity
    limit 30
  ),
  fused as (
    select coalesce(fts.id, vec.id) as id,
           coalesce(1.0 / (rrf_k + fts.rnk), 0.0)
             + coalesce(1.0 / (rrf_k + vec.rnk), 0.0) as score
    from fts
    full outer join vec on fts.id = vec.id
  )
  select g.*
  from fused
  join guides g on g.id = fused.id
  order by fused.score desc
  limit match_count
$$;

grant execute on function boss_hybrid_reviews(text, vector, int, float, int, int, int) to anon, authenticated;
grant execute on function boss_hybrid_guides(text, vector, int, float, int)          to anon, authenticated;

-- After applying:
--   1. npm run db:types
--   2. Backfill existing rows once by hitting the cron endpoint with the secret:
--        GET /api/cron/embed-content?secret=$CRON_SECRET
--      (first run embeds the whole approved catalog).
--   3. The Vercel cron /api/cron/embed-content (*/15) then keeps new/edited rows
--      fresh automatically — the staleness triggers null a row's embedding on edit.

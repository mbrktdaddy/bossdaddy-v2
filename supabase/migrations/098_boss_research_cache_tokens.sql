-- ─────────────────────────────────────────────────────────────────────────────
-- 098 — The Boss research cache: fuzzy near-match support.
--
-- The mig 097 cache keyed on an exact normalized query, so "best samsung earbuds"
-- and "top samsung galaxy earbuds" missed each other (the extra word "galaxy"
-- changes the key). We add the significant-token ARRAY so the handler can find
-- candidates sharing tokens (GIN `&&` overlap) and accept a near-match — but only
-- when the queries differ by ≤1 non-constraint word (a price/count/use modifier
-- forces a fresh run, so a budget query never serves an unbounded cached answer).
--
-- Rows created before this migration keep tokens '{}' (unmatchable by overlap);
-- they self-heal — the next miss re-researches and rewrites them with tokens.
-- ─────────────────────────────────────────────────────────────────────────────

alter table boss_research_cache
  add column if not exists tokens text[] not null default '{}';

-- GIN index powers the `tokens && ARRAY[...]` overlap lookup.
create index if not exists idx_boss_research_cache_tokens
  on boss_research_cache using gin (tokens);

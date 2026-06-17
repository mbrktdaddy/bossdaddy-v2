-- ─────────────────────────────────────────────────────────────────────────────
-- 097 — The Boss research fast-path cache.
--
-- research_gear (mig 096) fires Anthropic web_search — the priciest, slowest call
-- in the stack (15-40s). This table caches a completed research run keyed by a
-- normalized query, so the SECOND time anyone asks the same gap question we serve
-- the seeded shortlist instantly: no web_search, no quota spent. Only genuinely
-- new gaps (or stale entries past the freshness window) hit the slow path.
--
-- Server-only: read + written exclusively by the tool handler via the admin
-- client. RLS is admin-only as a safety gate (the admin client bypasses it).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists boss_research_cache (
  id           uuid        primary key default gen_random_uuid(),
  -- Normalized + sorted significant query tokens (e.g. "earbuds samsung"). The
  -- cache key: "best samsung earbuds" and "what are the best samsung earbuds"
  -- both normalize to the same key. UNIQUE → upsert on refresh.
  query_key    text        not null unique,
  category     text,
  -- { candidates: [...], citations: [...] } — the full payload to rebuild the
  -- shortlist + ResearchedCards without re-running anything. /go links inside
  -- still resolve live against the seeded products.
  payload      jsonb       not null,
  hits         integer     not null default 0,
  created_at   timestamptz not null default now(),
  refreshed_at timestamptz not null default now()
);

-- Freshness sweep / admin inspection by recency. (query_key already has a unique
-- index, so no separate B-tree on it.)
create index if not exists idx_boss_research_cache_fresh
  on boss_research_cache (refreshed_at desc);

alter table boss_research_cache enable row level security;

create policy "boss_research_cache_admin_all"
  on boss_research_cache for all
  to authenticated
  using (is_admin())
  with check (is_admin());

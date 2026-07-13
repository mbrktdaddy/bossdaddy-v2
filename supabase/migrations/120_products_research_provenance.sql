-- 120_products_research_provenance.sql
-- Carry web-search citations from an adopted gear_candidate onto the product
-- spine so the public picks/roundup pages can render a "Researched, not tested"
-- tier WITH its sources.
--
-- WHY on products (not read from gear_candidates at render time):
--   gear_candidates is admin-only RLS (quarantined from public surfaces by
--   design — mig 099). Anonymous visitors CANNOT read sources there. So the
--   citations must live on the already-public products row (public read since
--   mig 042). This is the deliberate adopt-bridge tradeoff: untested gear only
--   surfaces after an admin adopts it, and its provenance travels with it.
--
-- products is an existing PUBLIC-content table; this is an additive column only,
-- no RLS change. `source='adopted_from_research'` (mig 099) already flags the
-- provenance; this adds the citations that pair with it.

alter table products
  add column if not exists research_sources jsonb not null default '[]'::jsonb;

comment on column products.research_sources is
  'Web-search citations [{title,url}] copied from gear_candidates.sources at adopt time. Non-empty only for source=''adopted_from_research'' products. Powers the "Researched, not tested" roundup tier.';

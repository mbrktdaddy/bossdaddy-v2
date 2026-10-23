-- On the Radar — first three entries (drafted 2026-10-23)
--
-- Operator-run SQL, NOT a migration. Paste into the Supabase SQL editor (prod)
-- after reading the takes below and editing them to taste — they are drafts in
-- the brotherly register, written from the research on each gear_candidates
-- row, not from hands-on use. Nothing here claims ownership or testing.
--
-- What it does (one transaction):
--   1. Adopts three researched candidates into the products spine the same way
--      POST /api/gear-candidates/[id]/adopt does (source = adopted_from_research,
--      description = the research note, research_sources = the citations), but
--      lands them directly on Radar with a take. The mig-157 trigger stamps
--      spotted_at = now() — they go live on /gear and /gear/radar at once.
--   2. Flags the candidate rows as adopted (both Spirit E-210 duplicates point at
--      the one product) so they stop surfacing as "new".
--
-- To stagger the releases (~3 a week is the plan) set spotted_at explicitly on
-- the second and third insert, e.g.  now() + interval '3 days'. A future
-- spotted_at is a scheduled release: public queries filter spotted_at <= now().
--
-- After running:
--   • Each product needs an image before the card looks finished. Admin →
--     Products → the item → upload or "Add this image" from the store page
--     (store images are uploaded, never hot-linked — the form rejects the rest).
--   • Check /gear (Radar lane) and /gear/radar on the phone; cast a test vote.
--   • Re-run with different ids for the next batch. Candidates left in the pool:
--     node scripts/list-gear-candidates.mjs
--
-- Idempotent: an existing product slug is skipped, an already-adopted candidate
-- is left alone.

begin;

-- 1 · Ugly Stik GX2 Spinning Combo — outdoors, budget ($30–55)
insert into products
  (slug, name, brand, category, affiliate_url, store, status, source, description, research_sources, radar_take)
select
  'ugly-stik-gx2-spinning-combo',
  'Ugly Stik GX2 Spinning Combo',
  'Ugly Stik',
  'outdoors-adventure',
  c.affiliate_url,
  c.store,
  'radar',
  'adopted_from_research',
  left(c.why, 400),
  c.sources,
  $take$Every dad needs one rod in the garage that nobody cries over. The GX2 is the one the fishing crowd keeps naming for beginners: a graphite-fiberglass blank that shrugs off a truck bed, a 6-foot medium two-piece that handles bass, catfish and bluegill, and a price that doesn't need a family meeting. The kid-sized years come fast. I want a setup ready on the wall before the first "Dad, can we go fishing?" Do I test it before then? Cast your vote.$take$
from gear_candidates c
where c.id = '8472b4f6-acb8-4532-8728-67e7ecc8a745'
  and not exists (select 1 from products p where p.slug = 'ugly-stik-gx2-spinning-combo');

update gear_candidates
   set adopted_at = now(),
       adopted_product_id = (select id from products where slug = 'ugly-stik-gx2-spinning-combo')
 where id = '8472b4f6-acb8-4532-8728-67e7ecc8a745'
   and adopted_at is null;

-- 2 · Weber Original Kettle Premium 22" — grilling, budget ($200–230)
insert into products
  (slug, name, brand, category, affiliate_url, store, status, source, description, research_sources, radar_take)
select
  'weber-original-kettle-premium-22',
  'Weber Original Kettle Premium Charcoal Grill 22"',
  'Weber',
  'grilling-cooking',
  c.affiliate_url,
  c.store,
  'radar',
  'adopted_from_research',
  left(c.why, 400),
  c.sources,
  $take$I run gas and pellet. There's no charcoal on my patio, and the Kettle is the one that keeps making me feel it. Same basic grill since 1952, Wirecutter's charcoal pick for years, and the Premium version adds the one-touch ash catcher that makes cleanup a non-event. Two hundred bucks for real smoke flavor and a lid that turns it into a smoker in a pinch. The question is whether I'd actually reach past the Genesis for it on a Tuesday. Tell me if you want that answered.$take$
from gear_candidates c
where c.id = '115cf3a3-e239-4411-be33-341bd4e94013'
  and not exists (select 1 from products p where p.slug = 'weber-original-kettle-premium-22');

update gear_candidates
   set adopted_at = now(),
       adopted_product_id = (select id from products where slug = 'weber-original-kettle-premium-22')
 where id = '115cf3a3-e239-4411-be33-341bd4e94013'
   and adopted_at is null;

-- 3 · Weber Spirit E-210 (2-burner, LP) — grilling, budget ($400–450)
--     Uses the candidate row with the direct Amazon link (B0DPH7QGTP); the
--     older search-link duplicate is flagged adopted against the same product.
insert into products
  (slug, name, brand, category, affiliate_url, store, status, source, description, research_sources, radar_take)
select
  'weber-spirit-e-210-gas-grill',
  'Weber Spirit E-210 2-Burner Gas Grill (Liquid Propane)',
  'Weber',
  'grilling-cooking',
  c.affiliate_url,
  c.store,
  'radar',
  'adopted_from_research',
  left(c.why, 400),
  c.sources,
  $take$Not every dad has a backyard that fits a four-burner. The Spirit E-210 is the two-burner Weber that Wirecutter and Serious Eats both put at the top of the budget pile: cast-aluminum firebox, the same ten-year warranty as my Genesis E-330, and a footprint that fits a townhouse patio or a balcony where the lease allows a grill. I already own the bigger brother, so this one is for the buddy who asked me what to buy first. Vote if you want it on the Bench.$take$
from gear_candidates c
where c.id = 'b8ca3111-44c0-4188-8295-8b840dd74c10'
  and not exists (select 1 from products p where p.slug = 'weber-spirit-e-210-gas-grill');

update gear_candidates
   set adopted_at = now(),
       adopted_product_id = (select id from products where slug = 'weber-spirit-e-210-gas-grill')
 where id in ('b8ca3111-44c0-4188-8295-8b840dd74c10',   -- direct link, used above
              '6dcc4484-37e7-4f47-9c19-b8a24f5edbc3')   -- search-link duplicate
   and adopted_at is null;

-- Sanity: three rows, all live on Radar with a take and a spotted_at.
select slug, status, category, spotted_at, char_length(radar_take) as take_chars
  from products
 where slug in ('ugly-stik-gx2-spinning-combo', 'weber-original-kettle-premium-22', 'weber-spirit-e-210-gas-grill')
 order by spotted_at;

commit;

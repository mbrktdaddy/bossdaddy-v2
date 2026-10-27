-- Legacy review slugs → live reviews (Search Console 'excluded by noindex' export, 2026-10-27).
-- 24 dead URLs Google still holds, each an old version of a review that is live under a new slug.
-- proxy.ts 301s any slug in legacy_slugs[] to the current one. Data update only — no schema change.
-- Run in the Supabase SQL editor as the operator. Idempotent (dedupes on re-run).
begin;
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['fanhao-garden-hose-nozzle-review-heavy-duty-metal-worth-the-price','fanhao-garden-hose-nozzle-review-is-this-heavy-duty-metal-nozzle-worth-the-premium-price-8x7s']::text[]))
  where slug = 'fanhao-garden-hose-nozzle-review-built-to-last';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['thorne-zinc-picolinate-30-mg-review-premium-zinc-worth-the-price-oa30','thorne-zinc-picolinate-review-immune-support-that-actually-delivers']::text[]))
  where slug = 'thorne-zinc-picolinate-review-simple-clean-and-it-works';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['gorilla-playsets-wilderness-gym-swing-set-review-built-to-last']::text[]))
  where slug = 'gorilla-playsets-wilderness-gym-swing-set-review-boss-backyard';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['enfamil-optimum-enspire-review-best-ready-to-feed-formula']::text[]))
  where slug = 'enfamil-optimum-enspire-rtf-review-dad-tested-for-over-a-year';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['enfamil-optimum-enspire-baby-formula-review-dads-honest-take','enfamil-optimum-enspire-baby-formula-review-dad-s-honest-tak-4cad5f2e']::text[]))
  where slug = 'enfamil-optimum-enspire-powder-baby-formula-review';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['lbt-power-tool-organizer-with-charging-station-review-cordless-tool']::text[]))
  where slug = 'lbt-power-tool-organizer-with-charging-station-review';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['funlio-2-in-1-swing-set-baby-jumper-review-indoor-fun-done-right']::text[]))
  where slug = 'funlio-2-in-1-swing-set-baby-jumper-review-fun-for-five-minutes';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['momentous-vitamin-d3-review-simple-supplement-solid-results','momentous-vitamin-d3-5000-iu-review-the-sunshine-supplement-for-busy-dads-zjwy']::text[]))
  where slug = 'momentous-vitamin-d3-5-000-iu-review-real-results-verified';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['hozereel-5-8-x-100-ft-retractable-garden-hose-reel-review']::text[]))
  where slug = 'hozereel-heavy-duty-retractable-garden-hose-reel-review-2';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['pure-encapsulations-magnesium-glycinate-review-clean-sleep-recovery','pure-encapsulations-magnesium-glycinate-review-clean-sleep-r-4f90013c']::text[]))
  where slug = 'pure-encapsulations-magnesium-glycinate-review-clean-trusted-effective';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['nordic-naturals-ultimate-omega-review-worth-the-hype-eb01faa4','nordic-naturals-ultimate-omega-review-worth-the-hype']::text[]))
  where slug = 'nordic-naturals-ultimate-omega-review-clean-omega-3s-that-deliver';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['step2-rain-showers-splash-pond-water-table-review-toddler-approved']::text[]))
  where slug = 'step2-rain-showers-splash-pond-water-table-review';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['keppi-fitness-adjustable-weight-bench-review-budget-beast-or-flimsy-fail','keppi-fitness-adjustable-weight-bench-review-budget-beast-or-flimsy-fail-7vdh']::text[]))
  where slug = 'keppi-fitness-bench3000-max-review-solid-home-gym-upgrade';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['ergobaby-alta-hip-seat-baby-carrier-review-dad-tested-daily-688fca84','ergobaby-alta-hip-seat-carrier-review-a-dads-back-saving-baby-carrier-nnj7']::text[]))
  where slug = 'ergobaby-alta-hip-seat-baby-carrier-review-worth-it';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['superb-home-meat-smoking-guide-magnet-review-bbq-cheat-sheet-for-your']::text[]))
  where slug = 'superb-meat-smoking-guide-magnet-review-bbq-cheat-sheet';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['goodyear-100-ft-extension-cord-reel-real-shop-test']::text[]))
  where slug = 'goodyear-100-ft-retractable-extension-cord-reel-review';
update reviews set legacy_slugs = array(select distinct unnest(coalesce(legacy_slugs,'{}') || array['vmaisi-magnetic-cabinet-locks-review-dad-tested-baby-proofing']::text[]))
  where slug = 'vmaisi-magnetic-baby-proofing-cabinet-locks-review-6-month-test';
commit;

-- Verify: expect 17 rows, each with at least one legacy slug.
select slug, legacy_slugs from reviews where slug in ('fanhao-garden-hose-nozzle-review-built-to-last','thorne-zinc-picolinate-review-simple-clean-and-it-works','gorilla-playsets-wilderness-gym-swing-set-review-boss-backyard','enfamil-optimum-enspire-rtf-review-dad-tested-for-over-a-year','enfamil-optimum-enspire-powder-baby-formula-review','lbt-power-tool-organizer-with-charging-station-review','funlio-2-in-1-swing-set-baby-jumper-review-fun-for-five-minutes','momentous-vitamin-d3-5-000-iu-review-real-results-verified','hozereel-heavy-duty-retractable-garden-hose-reel-review-2','pure-encapsulations-magnesium-glycinate-review-clean-trusted-effective','nordic-naturals-ultimate-omega-review-clean-omega-3s-that-deliver','step2-rain-showers-splash-pond-water-table-review','keppi-fitness-bench3000-max-review-solid-home-gym-upgrade','ergobaby-alta-hip-seat-baby-carrier-review-worth-it','superb-meat-smoking-guide-magnet-review-bbq-cheat-sheet','goodyear-100-ft-retractable-extension-cord-reel-review','vmaisi-magnetic-baby-proofing-cabinet-locks-review-6-month-test');

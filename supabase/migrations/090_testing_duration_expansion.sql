-- Expand review testing-duration time frames + add custom date/note option.
--
-- Adds longer-term buckets (6+ months through 5+ years) plus a 'custom' value
-- that lets an author record a specific testing start date and/or a free-text
-- note. Existing values ('<1wk', '1-4wks', '1-3mo', '3+mo') remain valid — this
-- is purely additive, so no backfill is required.

-- ── widen the testing_duration CHECK constraint ──────────────────────────────
-- Migration 046 added this as an inline column check. The auto-generated name is
-- reviews_testing_duration_check, but drop it name-agnostically so this migration
-- can't silently leave the old narrow constraint in place (which would reject the
-- new values while the ADD below quietly succeeds).
do $$
declare
  c text;
begin
  for c in
    select conname
    from   pg_constraint
    where  conrelid = 'reviews'::regclass
    and    contype  = 'c'
    and    pg_get_constraintdef(oid) ilike '%testing_duration%'
  loop
    execute format('alter table reviews drop constraint %I', c);
  end loop;
end $$;

alter table reviews
  add constraint reviews_testing_duration_check
    check (testing_duration in (
      '<1wk', '1-4wks', '1-3mo', '3+mo',
      '6mo', '1yr', '2yr', '3yr', '5yr',
      'custom'
    ));

-- ── custom testing context ───────────────────────────────────────────────────
-- testing_since: the date the author started using the item (renders as
--   "Tested since Mon YYYY"). testing_note: free-text duration phrase (renders
--   verbatim, e.g. "2 summers of camping"). Both only meaningful when
--   testing_duration = 'custom', but stored independently so either can be set.
alter table reviews
  add column if not exists testing_since date,
  add column if not exists testing_note  text;

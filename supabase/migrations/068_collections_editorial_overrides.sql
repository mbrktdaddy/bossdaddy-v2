-- Migration 068: Editorial overrides for collections
--
-- Adds three optional columns that let editors override the auto-pulled
-- "How I Tested" callout and the FAQ section on a per-collection basis,
-- plus a "best for" tagline for comparison items (complements the existing
-- wins_category for the Bottom Line + per-product deep dives).
--
-- All three are nullable. When null, public pages fall back to the
-- category-level defaults pulled from lib/categories.ts (the existing
-- behavior). This lets editors lean on the defaults for routine collections
-- and write custom overrides when a specific guide deserves bespoke voice.
--
-- Why this shape:
--   • methodology_html is HTML so editors can use the existing TiptapEditor
--     (mirrors collections.intro_html which already passes through
--     resolveProductTokens + sanitizeHtml).
--   • faqs is jsonb so we can add/remove rows without schema migrations.
--     Shape: [{question: string, answer: string}, ...]
--   • best_for is plain text — short tagline ("for the grill master"),
--     not a full paragraph. Comparison-flavor-specific but stored on
--     collection_items broadly (future flavors can adopt without migration).

begin;

alter table collections
  add column if not exists methodology_html text,
  add column if not exists faqs jsonb;

alter table collection_items
  add column if not exists best_for text;

comment on column collections.methodology_html is
  'Optional per-collection override for the "How I Tested" callout. When null, public pages fall back to the dominant item-category pov from lib/categories.ts. HTML — passes through sanitizeHtml at save.';

comment on column collections.faqs is
  'Optional per-collection override for the FAQ section. When null, public pages fall back to the dominant item-category faqs from lib/categories.ts. Shape: [{question: string, answer: string}, ...].';

comment on column collection_items.best_for is
  'Optional short tagline for who this item is "best for" within the collection (e.g. "the grill master"). Distinct from collection_items.wins_category (comparison badge) and collection_items.role_label (stack role).';

commit;

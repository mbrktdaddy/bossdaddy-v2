-- Migration 065: Rename pick_lists → collections + extend for comparisons and stacks
--
-- Why: `pick_lists` was named for one of its uses (best-of picks). The table now
-- needs to support 4 use cases — picks, gift guides, comparisons, stacks — with
-- mostly shared structure and small per-flavor metadata. Renaming to `collections`
-- gives the right umbrella name for future-proof code. Reader-facing terminology
-- stays per-section (Picks/Gifts/Comparisons/Stacks); this rename is internal only.
--
-- The brand umbrella surfaced in UI is "The Vault" but that lives in string
-- constants, not in table schemas (per CLAUDE.md: internal names stable forever).
--
-- Adds:
--   • collections.winner_summary       text  (comparisons: bottom-line one-liner)
--   • collections.bundle_total_cents   int   (stacks: cached cumulative price)
--   • collection_items.wins_category   text  (comparisons: "Best Overall", "Best Budget")
--   • collection_items.role_label      text  (stacks: "The Anchor", "Daily Driver")
--
-- Expands collection_type check to include 'comparison' and 'stack'.

begin;

-- ── Rename tables + FK column ───────────────────────────────────────────────
alter table pick_lists      rename to collections;
alter table pick_list_items rename to collection_items;
alter table collection_items rename column pick_list_id to collection_id;

-- ── Rename discriminator column ─────────────────────────────────────────────
alter table collections rename column pick_type to collection_type;

-- Expand the check constraint
alter table collections drop constraint if exists pick_lists_pick_type_check;
alter table collections add constraint collections_collection_type_check
  check (collection_type in ('general', 'gift_guide', 'best_of', 'comparison', 'stack'));

-- ── New flavor-specific columns ─────────────────────────────────────────────
alter table collections add column if not exists winner_summary text;
alter table collections add column if not exists bundle_total_cents integer
  check (bundle_total_cents is null or bundle_total_cents >= 0);

alter table collection_items add column if not exists wins_category text;
alter table collection_items add column if not exists role_label    text;

-- ── Rename indexes ──────────────────────────────────────────────────────────
alter index if exists idx_pick_lists_slug      rename to idx_collections_slug;
alter index if exists idx_pick_lists_visible   rename to idx_collections_visible;
alter index if exists idx_pick_lists_type      rename to idx_collections_type;
alter index if exists idx_pick_lists_occasion  rename to idx_collections_occasion;
alter index if exists idx_pick_list_items_list rename to idx_collection_items_list;

-- ── Rename RLS policies (drop + recreate for portability) ───────────────────
drop policy if exists "pick_lists_public_read"      on collections;
drop policy if exists "pick_lists_admin_write"      on collections;
drop policy if exists "pick_list_items_public_read" on collection_items;
drop policy if exists "pick_list_items_admin_write" on collection_items;

create policy "collections_public_read" on collections
  for select to anon, authenticated
  using (is_visible = true);

create policy "collections_admin_write" on collections
  for all to authenticated
  using (is_admin())
  with check (is_admin());

create policy "collection_items_public_read" on collection_items
  for select to anon, authenticated
  using (exists (select 1 from collections c where c.id = collection_id and c.is_visible = true));

create policy "collection_items_admin_write" on collection_items
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- ── Rename updated_at trigger ───────────────────────────────────────────────
drop trigger if exists pick_lists_updated_at on collections;
create trigger collections_updated_at
  before update on collections
  for each row execute function touch_updated_at();

-- ── Documentation ───────────────────────────────────────────────────────────
comment on table collections is
  'Curated multi-product collections. Discriminated by collection_type — best_of (ranked), gift_guide, comparison (head-to-head with scores), stack (kit-for-purpose with role labels). Brand umbrella surfaced in UI as "The Vault"; this internal name stays stable.';
comment on column collections.collection_type is
  'Drives the render flavor + admin-form fields. Reader URLs split by type: /picks, /gifts, /comparisons, /stacks.';
comment on column collections.winner_summary is
  'Comparison flavor: editor-written one-liner verdict (e.g. "Buy the Yeti for everyday, RTIC if you need it bigger").';
comment on column collections.bundle_total_cents is
  'Stack flavor: cached cumulative price across all items. Optional — recompute on read if null.';
comment on column collection_items.wins_category is
  'Comparison flavor: badge text for which dimension this product wins (e.g. "Best Overall", "Best Budget").';
comment on column collection_items.role_label is
  'Stack flavor: functional role of this product in the kit (e.g. "The Anchor", "The Daily Driver", "The Backup").';

commit;

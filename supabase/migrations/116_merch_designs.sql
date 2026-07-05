-- ─────────────────────────────────────────────────────────────────────────────
-- 116_merch_designs — Merch Studio design candidates (Phase 1)
--
-- A `merch_design` is the pre-production artifact of the Merch Studio workflow:
-- Claude proposes on-brand sayings → operator approves/edits → (Phase 2) a
-- brand-locked template renders a print-ready file → (Phase 3) it's pushed to
-- Printful → (Phase 4) `merch:sync` lands it in `merch`/`merch_variants` and it
-- goes live. This table is the operator's editorial workbench up to that point.
--
-- PATTERN C — admin-only. This is admin-authored content (not private user data
-- and not public until it becomes a `merch` row), so `is_admin()` is the correct
-- gate. Nothing here is served to logged-out visitors — the public shop reads
-- `merch`, never `merch_designs`.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists merch_designs (
  id            uuid        primary key default gen_random_uuid(),

  -- 'saying'      → text/meme design; content = { text, subline, angle }
  -- 'logo_lockup' → logo + wordmark composition; content = { logo, wordmark, arrangement }
  design_type   text        not null default 'saying'
                            check (design_type in ('saying', 'logo_lockup')),

  title         text        not null,

  -- The saying/idiom (or lockup config) itself. Shape depends on design_type.
  content       jsonb       not null default '{}'::jsonb,

  -- The theme/prompt that produced this candidate (null for hand-added lockups).
  theme         text,

  -- IP guardrail flag from generation: 'none' | 'low' | 'review'. Anything not
  -- 'none' means a human should confirm the phrase isn't a trademark/copyright
  -- of someone else before it ships on merch. Editorial gate, enforced in UI.
  ip_flag       text        not null default 'none'
                            check (ip_flag in ('none', 'low', 'review')),
  ip_note       text,

  -- draft    → generated, not yet approved by the operator
  -- approved → operator signed off; eligible for rendering (Phase 2)
  -- published → pushed to Printful + live via merch:sync (Phase 3/4)
  status        text        not null default 'draft'
                            check (status in ('draft', 'approved', 'published')),

  -- Which brand template + config renders this (populated in Phase 2).
  template_key    text,
  template_config jsonb       not null default '{}'::jsonb,

  -- Generated artifacts (populated in Phase 2).
  print_file_url  text,       -- high-DPI print-ready PNG (bucket: merch-designs)
  preview_url     text,       -- web-res preview

  -- Which blank product types this design targets, e.g. {tee,hat,mug}.
  product_types   text[]      not null default '{}',

  -- Set once the design is pushed/synced (Phase 3/4). Links back to the storefront.
  printful_sync_product_id bigint,
  merch_id                 uuid references merch (id) on delete set null,

  notes         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Typical query: list the workbench by status, newest first.
create index if not exists idx_merch_designs_status
  on merch_designs (status, created_at desc);

alter table merch_designs enable row level security;

-- Admin-only for all operations. The public shop never reads this table.
create policy "merch_designs_admin_all"
  on merch_designs for all
  to authenticated
  using (is_admin())
  with check (is_admin());

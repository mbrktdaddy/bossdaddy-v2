-- ─────────────────────────────────────────────────────────────────────────────
-- Migration template — DO NOT APPLY DIRECTLY
--
-- This file's underscore prefix excludes it from the migration runner.
-- Copy it as `NNN_descriptive_name.sql` (next sequential number) and customize.
--
-- DOCTRINE
--   1. Internal names (table, column, status enum value) are STABLE FOREVER.
--      If "Wishlist" becomes "Bench" in the UI, do NOT rename the table —
--      change `lib/labels.ts` instead.
--
--   2. Every new table MUST have RLS enabled. No exceptions.
--
--   3. Default RLS roles by table type:
--        Public content (visible to logged-out visitors)  → `to anon, authenticated`
--        User-owned data (per-user dashboards, drafts)    → `to authenticated`
--        Admin-only data                                   → `to authenticated` + admin gate
--
--      Forgetting `to anon, authenticated` on public tables silently breaks
--      logged-out visitors but works fine for admins. See migrations 042
--      (products) and 043 (profiles) for examples of this exact regression.
--
--   4. Use the `is_admin()` helper for admin gates — DO NOT inline
--      `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`.
--      The inline form drifts; pick_lists (044) is the one outlier.
--
--   5. Indexes:
--        UNIQUE constraints already create an index. Don't add a redundant
--        B-tree on the same column. Do add composite indexes for the actual
--        query shapes (status + visibility + sort column).
--
--   6. Updated-at columns: include `updated_at timestamptz not null default now()`.
--      Touch via app code or a trigger — pick one and stick to it across tables.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── PATTERN A — Public content table ────────────────────────────────────────
-- Use for: tables whose rows are intended to be visible to logged-out visitors
-- (reviews, guides, products, pick_lists, gift_guides, tags).

create table if not exists example_public (
  id           uuid        primary key default gen_random_uuid(),
  slug         text        unique not null,
  title        text        not null,
  is_visible   boolean     not null default false,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Composite index for the typical "list visible content, newest first" query.
create index if not exists idx_example_public_visible
  on example_public (is_visible, published_at desc);

alter table example_public enable row level security;

-- Public read: anonymous AND authenticated visitors. Filter with `using` if
-- only some rows should be public (e.g. visible/published).
create policy "example_public_read"
  on example_public for select
  to anon, authenticated
  using (is_visible = true);

-- Admin-only writes via the canonical helper.
create policy "example_public_admin_write"
  on example_public for all
  to authenticated
  using (is_admin())
  with check (is_admin());


-- ─── PATTERN B — User-owned data ─────────────────────────────────────────────
-- Use for: per-user data (wishlists, comments-as-author, draft reviews/guides).

create table if not exists example_user_owned (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users on delete cascade,
  body       text        not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_example_user_owned_user
  on example_user_owned (user_id, created_at desc);

alter table example_user_owned enable row level security;

-- Owner can read their own rows; admins can read all.
create policy "example_user_owned_read"
  on example_user_owned for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- Owner can insert/update/delete their own rows; admins can do all.
create policy "example_user_owned_write"
  on example_user_owned for all
  to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());


-- ─── PATTERN C — Admin-only data ─────────────────────────────────────────────
-- Use for: moderation tables, audit logs, admin tooling.

create table if not exists example_admin_only (
  id         uuid        primary key default gen_random_uuid(),
  payload    jsonb       not null,
  created_at timestamptz not null default now()
);

alter table example_admin_only enable row level security;

create policy "example_admin_only_all"
  on example_admin_only for all
  to authenticated
  using (is_admin())
  with check (is_admin());


-- ─── REMINDER ────────────────────────────────────────────────────────────────
-- Before applying:
--   • Replace `example_*` with your real table name(s)
--   • Confirm the read role matches the data sensitivity
--   • Run locally / on a branch DB first if possible
--   • Add the corresponding TypeScript regen: `npm run db:types`

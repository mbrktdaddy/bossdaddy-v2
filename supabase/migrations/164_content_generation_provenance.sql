-- ─────────────────────────────────────────────────────────────────────────────
-- 164 — Content generation provenance (content pipeline plan, Phase 0)
--
-- WHY: nothing records which model / prompt version / cost produced a draft, so
-- a voice change can't be traced to the live articles written under the old
-- prompt, a lost browser tab loses a $0.15 generation, and "cost per piece" has
-- no source. See docs/content-pipeline-plan.md §3.
--
-- 1. `generations` — one row per AI stage call (Pattern B: owner-only, no
--    is_admin(); the admin reads it via the service-role client if ever needed).
-- 2. Provenance columns on reviews + guides: which generation seeded the piece,
--    under which prompt version, and how much of it is still the model's prose.
-- 3. `guides.inquiry_mode` — the wizard's tri-state (null = pillar default) was
--    never persisted, so the first refine inferred it from the category alone.
-- 4. `content_revisions.label` — lets the history panel mark the snapshot taken
--    right before an AI refine was applied (wired in Phase 2).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists generations (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users on delete cascade,
  content_type     text        not null check (content_type in ('review', 'guide')),
  -- Null until the draft is saved; the wizard patches it on save.
  content_id       uuid,
  -- Pipeline stage: 'draft' today; 'outline' | 'section' | 'blocks' | 'critic'
  -- | 'images' | 'refine' once the staged pipeline ships.
  stage            text        not null,
  model            text        not null,
  prompt_version   text        not null,
  effort           text,
  temperature      numeric(3,2),
  input_tokens     integer     not null default 0,
  output_tokens    integer     not null default 0,
  reasoning_tokens integer     not null default 0,
  cached_input_tokens integer  not null default 0,
  latency_ms       integer     not null default 0,
  -- Gateway-reported when available, else estimated from lib/ai/pricing.ts.
  cost_usd         numeric(8,5),
  finish_reason    text,
  status           text        not null check (status in ('done', 'failed', 'truncated')),
  -- What was asked (wizard fields + user prompt; NOT the system prompt — that is
  -- identified by prompt_version) and what came back. The output is the raw
  -- material for the published-vs-generated diff (Phase 5).
  input            jsonb       not null default '{}'::jsonb,
  output           jsonb,
  -- null = unknown yet; true once the author saved it; false if discarded.
  accepted         boolean,
  created_at       timestamptz not null default now()
);

create index if not exists idx_generations_user
  on generations (user_id, created_at desc);

create index if not exists idx_generations_content
  on generations (content_id)
  where content_id is not null;

alter table generations enable row level security;

-- Owner reads ONLY their own rows. No admin override (Pattern B).
create policy "generations_read"
  on generations for select
  to authenticated
  using (user_id = auth.uid());

-- Owner writes ONLY their own rows. No admin override.
create policy "generations_write"
  on generations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Provenance on the content rows ───────────────────────────────────────────

alter table reviews
  add column if not exists generation_id     uuid references generations (id) on delete set null,
  add column if not exists prompt_version    text,
  add column if not exists generation_method text
    check (generation_method in ('ai-drafted', 'ai-assisted', 'human'));

alter table guides
  add column if not exists generation_id     uuid references generations (id) on delete set null,
  add column if not exists prompt_version    text,
  add column if not exists generation_method text
    check (generation_method in ('ai-drafted', 'ai-assisted', 'human')),
  -- null = use the pillar default (table-duty / watch-duty → on); an explicit
  -- boolean from the wizard wins in either direction. Mirrors the API contract.
  add column if not exists inquiry_mode      boolean;

comment on column reviews.generation_method is
  'ai-drafted = saved straight from the AI draft; ai-assisted = the author edited the body afterwards; human = written without a generation. Feeds the AI-assistance label the editorial-standards page promises.';
comment on column guides.generation_method is
  'ai-drafted = saved straight from the AI draft; ai-assisted = the author edited the body afterwards; human = written without a generation. Feeds the AI-assistance label the editorial-standards page promises.';

-- ── Revision labels ──────────────────────────────────────────────────────────

alter table content_revisions
  add column if not exists label text;

comment on column content_revisions.label is
  'Optional marker for why this snapshot exists: pre-ai-refine | submit | manual. Null = routine save.';

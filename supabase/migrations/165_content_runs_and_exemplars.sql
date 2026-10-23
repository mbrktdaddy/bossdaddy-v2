-- ─────────────────────────────────────────────────────────────────────────────
-- 165 — Staged content pipeline runs + voice exemplars (content pipeline plan,
-- Phase 1; see docs/content-pipeline-plan.md §4)
--
-- 1. `content_runs` — one row per piece being produced by the staged pipeline
--    (outline → sections → blocks → critic → images). Holds the accumulated
--    state so the wizard resumes from the last completed stage after a tab
--    death; every model call behind it is still a `generations` row (mig 164),
--    now linked by `generations.run_id`.
-- 2. `voice_exemplars` — up to a few approved pieces the author picked as
--    examples of his voice; their excerpts ride in the cached system block
--    after the phrase palette (rules + examples beat rules alone).
-- Both are Pattern B: owner-only, no is_admin().
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists content_runs (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null references auth.users on delete cascade,
  content_type   text        not null check (content_type in ('review', 'guide')),
  status         text        not null default 'outline'
                             check (status in ('outline', 'drafting', 'blocks', 'critic', 'images', 'done', 'failed')),
  -- The wizard's inputs (validated shape in lib/content/pipeline/briefs.ts).
  brief          jsonb       not null,
  outline        jsonb,
  -- Array aligned with outline.parts: null until that part is written.
  sections       jsonb       not null default '[]'::jsonb,
  blocks         jsonb,
  critic         jsonb,
  images         jsonb,
  -- Set when the author saves the draft; the generations rows get it too.
  content_id     uuid,
  cost_usd       numeric(8,5) not null default 0,
  error          text,
  prompt_version text        not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_content_runs_user
  on content_runs (user_id, updated_at desc);

alter table content_runs enable row level security;

create policy "content_runs_read"
  on content_runs for select
  to authenticated
  using (user_id = auth.uid());

create policy "content_runs_write"
  on content_runs for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table generations
  add column if not exists run_id uuid references content_runs (id) on delete set null;

create index if not exists idx_generations_run
  on generations (run_id)
  where run_id is not null;

-- ── Voice exemplars ──────────────────────────────────────────────────────────

create table if not exists voice_exemplars (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users on delete cascade,
  content_type text        not null check (content_type in ('review', 'guide')),
  content_id   uuid        not null,
  title        text        not null,
  -- ≤ ~600 words of the piece as structured text, captured when picked.
  excerpt      text        not null,
  position     smallint    not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, content_type, content_id)
);

alter table voice_exemplars enable row level security;

create policy "voice_exemplars_read"
  on voice_exemplars for select
  to authenticated
  using (user_id = auth.uid());

create policy "voice_exemplars_write"
  on voice_exemplars for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

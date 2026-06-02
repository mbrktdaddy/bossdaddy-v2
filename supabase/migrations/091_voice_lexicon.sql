-- ─────────────────────────────────────────────────────────────────────────────
-- 091 — Voice lexicon (Phase 1 of the voice-learning system)
--
-- Captures HOW the author writes — his recurring one-liners, slang, openers, and
-- jokes — so Claude can weave them into drafts. This is the missing half of the
-- voice profile (migrations 019 / 073), which only captures WHO he is (facts).
--
-- Two tables, both Pattern B (user-owned):
--   voice_phrases — the signature-phrase lexicon. Only `approved` rows reach the
--                   prompt. Explicit one-click captures are born `approved`;
--                   auto-mined signal (Phase 3) lands as `proposed` for review.
--   voice_edits   — passive log of AI-refine before/after pairs. Nothing reads
--                   this yet; we start logging on day one so the Phase 3
--                   distillation job has history to mine.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── voice_phrases ───────────────────────────────────────────────────────────

create table if not exists voice_phrases (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null references auth.users on delete cascade,
  text             text        not null,
  -- one_liner | slang | opener | joke | phrase
  kind             text        not null default 'phrase'
                     check (kind in ('one_liner', 'slang', 'opener', 'joke', 'phrase')),
  -- free-text note on the tone/feel ("dry", "warm ribbing", etc.) — optional
  tone             text,
  -- BOSS_DADDY_SYSTEM edge-off topics this phrase must be suppressed on
  -- (e.g. {'grief','safety','struggle'}). Empty array = safe everywhere.
  contexts_avoid   text[]      not null default '{}',
  -- proposed | approved | archived. Only `approved` reaches the prompt.
  status           text        not null default 'proposed'
                     check (status in ('proposed', 'approved', 'archived')),
  -- how many times the auto-miner has seen this phrase (Phase 3 signal)
  times_seen       integer     not null default 1,
  -- where an explicit capture came from, for provenance (nullable)
  source_review_id uuid        references reviews(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- The prompt builder reads "this user's approved phrases" on every Claude call —
-- index that exact shape.
create index if not exists idx_voice_phrases_user_status
  on voice_phrases (user_id, status);

alter table voice_phrases enable row level security;

-- Owner reads their own lexicon; admins can read all.
create policy "voice_phrases_read"
  on voice_phrases for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- Owner manages their own lexicon; admins can manage all.
create policy "voice_phrases_write"
  on voice_phrases for all
  to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());


-- ─── voice_edits ─────────────────────────────────────────────────────────────
-- Passive learning log. Owner-only — nobody but the author (and admins) should
-- ever read someone's raw edit history.

create table if not exists voice_edits (
  id                 uuid        primary key default gen_random_uuid(),
  user_id            uuid        not null references auth.users on delete cascade,
  -- 'review' | 'guide' | 'selection' — what was being edited
  content_type       text        not null,
  before             text        not null,
  after              text        not null,
  -- the instruction the author gave the AI refine, when there was one
  refine_instruction text,
  created_at         timestamptz not null default now()
);

create index if not exists idx_voice_edits_user_created
  on voice_edits (user_id, created_at desc);

alter table voice_edits enable row level security;

create policy "voice_edits_read"
  on voice_edits for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "voice_edits_write"
  on voice_edits for all
  to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

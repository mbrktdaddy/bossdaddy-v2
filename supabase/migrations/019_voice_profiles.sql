-- Per-author voice profile — "about me" facts that Claude uses when
-- generating or refining any content (reviews, articles) for this user.
--
-- The goal is continuity + honesty across all site content: Claude computes
-- current ages from DOBs at call time (so a 2-year-old doesn't stay 2
-- forever), uses the structured occupation/region/faith fields verbatim,
-- and respects the evolving `facts` array as additional ground truth.
--
-- Injected as a second system-prompt block on /api/claude/{draft,review-refine,
-- article-draft,article-refine} so the cached BOSS_DADDY_SYSTEM stays hot.
--
-- Every author has AT MOST one row (user_id UNIQUE). Rows are created on
-- first save from the /dashboard/profile/voice page.
-- ────────────────────────────────────────────────────────────────────────

create table if not exists voice_profiles (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        unique not null references profiles(id) on delete cascade,
  self_dob        date,
  wife_dob        date,
  daughter_dob    date,
  occupation      text,
  faith_values    text,
  region          text,
  -- Evolving list: [{ id: string, label: string, value: string }]
  -- id is a client-generated uuid so the form can add/remove entries freely
  -- without worrying about array index stability across reorderings.
  facts           jsonb       not null default '[]'::jsonb,
  updated_at      timestamptz not null default now()
);

alter table voice_profiles enable row level security;

-- Authors can only see and manage their own voice profile.
create policy "voice_profiles_self" on voice_profiles for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace trigger voice_profiles_updated_at
  before update on voice_profiles
  for each row execute function touch_updated_at();

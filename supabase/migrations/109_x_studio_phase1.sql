-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 109 — X Studio Phase 1: data model
--
-- Builds the closed-loop content-intelligence data model on top of the existing
-- social tooling (social_posts, hashtag_presets). See docs/x-studio-plan.md.
--
-- DOCTRINE (Pattern B — private user-owned data):
--   Every new table is OWNER-SCOPED: read/write gated on `user_id = auth.uid()`,
--   NO `is_admin()` in any policy. X Studio is admin-only as a FEATURE, but that
--   gate lives in the app layer (route + API). RLS = data ownership; the route
--   guard = feature access. Keeping the tables owner-scoped future-proofs the
--   "limited access later" path — each future author gets a private workspace.
--   Admins reach this data (support/cron) via the service-role client, which
--   bypasses RLS and is auditable. See migs 106/107 for why this matters.
--
-- social_posts itself is already Pattern B (mig 107 stripped is_admin from it);
-- the ALTER below only adds columns + an index and touches no policies.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── social_thread_groups — NEW (a thread as one first-class object) ──────────
-- Parent of the member posts in social_posts. Threads are NOT a group-id smear:
-- this row owns the thread's status/source/posting metadata; members point back
-- via social_posts.thread_group_id.

create table if not exists social_thread_groups (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users on delete cascade,
  title        text        not null,
  status       text        not null default 'draft' check (status in ('draft', 'ready', 'posted')),
  source_type  text        check (source_type in ('review', 'guide', 'original', 'opportunity')),
  source_id    uuid,
  source_title text,
  posted_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_social_thread_groups_user
  on social_thread_groups (user_id, created_at desc);

alter table social_thread_groups enable row level security;

create policy "social_thread_groups_read"
  on social_thread_groups for select
  to authenticated
  using (user_id = auth.uid());

create policy "social_thread_groups_write"
  on social_thread_groups for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ─── social_posts — ALTER (thread membership + external/posting metadata) ─────
-- No RLS change. thread_group_id NULL = standalone post; non-NULL = thread member.

alter table social_posts
  add column if not exists thread_group_id uuid references social_thread_groups (id) on delete cascade,
  add column if not exists thread_position int,
  add column if not exists external_id     text,
  add column if not exists external_url    text,
  add column if not exists posted_via      text not null default 'manual'
    check (posted_via in ('manual', 'x_api'));

-- Thread assembly: fetch a group's members in order.
create index if not exists idx_social_posts_thread
  on social_posts (thread_group_id, thread_position);


-- ─── social_articles — NEW (long-form HTML, e.g. X Articles) ──────────────────
-- Platform-as-text philosophy: storage is generic long-form HTML; the X-specific
-- bit is the serializer (Phase 2), not this table. dropped_tags records the tags
-- the X serializer stripped, so the workspace can warn the author.

create table if not exists social_articles (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users on delete cascade,
  title           text        not null,
  body_html       text,
  cover_image_url text,
  source_type     text        check (source_type in ('review', 'guide', 'original', 'opportunity')),
  source_id       uuid,
  source_title    text,
  status          text        not null default 'draft' check (status in ('draft', 'ready', 'posted')),
  dropped_tags    jsonb,
  external_id     text,
  external_url    text,
  posted_via      text        not null default 'manual' check (posted_via in ('manual', 'x_api')),
  posted_at       timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_social_articles_user
  on social_articles (user_id, created_at desc);

alter table social_articles enable row level security;

create policy "social_articles_read"
  on social_articles for select
  to authenticated
  using (user_id = auth.uid());

create policy "social_articles_write"
  on social_articles for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ─── social_signals — NEW (raw radar finds, append-only) ──────────────────────
-- SENSE layer output: one row per raw signal from a radar source. Never updated
-- in place — the scoring engine (Phase 5) reads these to emit opportunities.

create table if not exists social_signals (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  source      text        not null check (source in ('web_search', 'reddit', 'trends', 'autocomplete')),
  topic       text,
  url         text,
  raw_score   numeric,
  payload     jsonb,
  captured_at timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index if not exists idx_social_signals_user
  on social_signals (user_id, captured_at desc);

alter table social_signals enable row level security;

create policy "social_signals_read"
  on social_signals for select
  to authenticated
  using (user_id = auth.uid());

create policy "social_signals_write"
  on social_signals for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ─── social_opportunities — NEW (scored, actionable: the Opportunity Queue) ───
-- DECIDE layer output: signals scored against pillars/catalog/recency into a
-- ranked queue. On "draft", the generated artifact is linked back via one of the
-- generated_* FKs so the loop can later attribute metrics to the opportunity.

create table if not exists social_opportunities (
  id                      uuid        primary key default gen_random_uuid(),
  user_id                 uuid        not null references auth.users on delete cascade,
  title                   text        not null,
  suggested_format        text        check (suggested_format in ('post', 'thread', 'article')),
  suggested_source_type   text        check (suggested_source_type in ('review', 'guide', 'original', 'opportunity')),
  suggested_source_id     uuid,
  score                   numeric,
  rationale               text,
  status                  text        not null default 'new' check (status in ('new', 'drafted', 'dismissed', 'done')),
  generated_post_id         uuid      references social_posts (id) on delete set null,
  generated_article_id      uuid      references social_articles (id) on delete set null,
  generated_thread_group_id uuid      references social_thread_groups (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists idx_social_opportunities_user
  on social_opportunities (user_id, status, score desc);

alter table social_opportunities enable row level security;

create policy "social_opportunities_read"
  on social_opportunities for select
  to authenticated
  using (user_id = auth.uid());

create policy "social_opportunities_write"
  on social_opportunities for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ─── social_metrics — NEW (per-tweet/article time-series, append-only) ────────
-- LEARN layer input: one row per metrics snapshot for exactly one post OR one
-- article. Thread totals = aggregate of member-post rows; "latest" via
-- DISTINCT ON (post_id) ORDER BY post_id, captured_at DESC.

create table if not exists social_metrics (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users on delete cascade,
  post_id     uuid        references social_posts (id) on delete cascade,
  article_id  uuid        references social_articles (id) on delete cascade,
  impressions int         not null default 0,
  likes       int         not null default 0,
  reposts     int         not null default 0,
  replies     int         not null default 0,
  link_clicks int         not null default 0,
  captured_at timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  -- Exactly one target: a metrics row belongs to a post XOR an article.
  constraint social_metrics_one_target check ((post_id is not null) <> (article_id is not null))
);

create index if not exists idx_social_metrics_user
  on social_metrics (user_id, captured_at desc);

alter table social_metrics enable row level security;

create policy "social_metrics_read"
  on social_metrics for select
  to authenticated
  using (user_id = auth.uid());

create policy "social_metrics_write"
  on social_metrics for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ─── Post-migration ──────────────────────────────────────────────────────────
--   npm run db:types

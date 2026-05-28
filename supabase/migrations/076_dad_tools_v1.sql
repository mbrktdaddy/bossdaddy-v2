-- Dad Tools v1: kid profiles, intent events, moments Log, and email opt-ins.
-- See docs/dad-tools-plan.md for the full plan (§5 schema, §2 locked decisions).
--
-- Tables:
--   kid_profiles            — per-dad kid records (anonymous-friendly until claimed)
--   tool_intent_events      — event-sourced signals from tool usage (append-only)
--   kid_moments             — the per-kid "Log" of captured moments (HIGHEST sensitivity)
--   tool_email_subscriptions — yearly check-in + Sunday-night nudge opt-ins
--
-- Anonymous handling
--   Rows may have `anonymous_id` set and `user_id` NULL until the dad signs up.
--   Anonymous reads/writes go through Server Actions using the admin client + the
--   browser's `anonymous_id` cookie. RLS protects authenticated rows; anonymous
--   access bypasses RLS via service role (intentional — the cookie is the auth
--   for anonymous users).

-- ── kid_profiles ─────────────────────────────────────────────────────────────

create table if not exists kid_profiles (
  id             uuid        primary key default gen_random_uuid(),
  anonymous_id   uuid,
  user_id        uuid        references profiles(id) on delete cascade,
  name           text,
  birthdate      date        not null,
  photo_url      text,
  schema_version int         not null default 1,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint kid_profiles_owner_check check (
    anonymous_id is not null or user_id is not null
  )
);

create index if not exists idx_kid_profiles_anonymous
  on kid_profiles (anonymous_id)
  where anonymous_id is not null;

create index if not exists idx_kid_profiles_user
  on kid_profiles (user_id, created_at desc)
  where user_id is not null;

create or replace function set_kid_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_kid_profiles_updated_at on kid_profiles;
create trigger trg_kid_profiles_updated_at
  before update on kid_profiles
  for each row execute function set_kid_profiles_updated_at();

alter table kid_profiles enable row level security;

create policy "kid_profiles owner read"
  on kid_profiles for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "kid_profiles owner insert"
  on kid_profiles for insert
  to authenticated
  with check (user_id = auth.uid() or is_admin());

create policy "kid_profiles owner update"
  on kid_profiles for update
  to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());

create policy "kid_profiles owner delete"
  on kid_profiles for delete
  to authenticated
  using (user_id = auth.uid() or is_admin());


-- ── tool_intent_events ───────────────────────────────────────────────────────
-- Event-sourced signals from tool usage. Append-only; rows are never updated.
-- Future-compatible with appendix features (Provider OS, Rituals suite).

create table if not exists tool_intent_events (
  id              uuid        primary key default gen_random_uuid(),
  anonymous_id    uuid,
  user_id         uuid        references profiles(id) on delete cascade,
  kid_profile_id  uuid        references kid_profiles(id) on delete cascade,
  tool            text        not null check (tool in ('weekends', 'moment')),
  payload         jsonb       not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_tool_intent_events_tool
  on tool_intent_events (tool, created_at desc);

create index if not exists idx_tool_intent_events_user
  on tool_intent_events (user_id, created_at desc)
  where user_id is not null;

alter table tool_intent_events enable row level security;

-- Read: owner can read their own events; admins read aggregate.
create policy "tool_intent_events owner read"
  on tool_intent_events for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- No INSERT policy — anonymous + authenticated inserts go through Server Actions
-- using the admin client. Service role bypasses RLS.


-- ── kid_moments ──────────────────────────────────────────────────────────────
-- The per-kid "Log" of captured moments. HIGHEST SENSITIVITY on the site.
-- Strict access: only the dad reads/writes his own. Deliberately NO admin
-- read policy — Log entries are private and never used for content/training
-- beyond consented aggregate stats (which read by service role only).

create table if not exists kid_moments (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references profiles(id) on delete cascade,
  kid_profile_id  uuid        not null references kid_profiles(id) on delete cascade,
  moment_kind     text        not null default 'general' check (
                                moment_kind in (
                                  'general', 'weekend', 'monthly_interest',
                                  'quote', 'milestone'
                                )
                              ),
  occurred_on     date,
  response        text        not null,
  photo_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_kid_moments_kid_occurred
  on kid_moments (kid_profile_id, occurred_on desc nulls last, created_at desc);

create or replace function set_kid_moments_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_kid_moments_updated_at on kid_moments;
create trigger trg_kid_moments_updated_at
  before update on kid_moments
  for each row execute function set_kid_moments_updated_at();

alter table kid_moments enable row level security;

create policy "kid_moments owner read"
  on kid_moments for select
  to authenticated
  using (user_id = auth.uid());

create policy "kid_moments owner insert"
  on kid_moments for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "kid_moments owner update"
  on kid_moments for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "kid_moments owner delete"
  on kid_moments for delete
  to authenticated
  using (user_id = auth.uid());


-- ── tool_email_subscriptions ─────────────────────────────────────────────────
-- Opt-in records for the yearly Weekends Until check-in and the Sunday-night
-- moments nudge. Both supported for anonymous (pre-signup) and authenticated
-- users. Unsubscribe via the per-row token (no login required).

create table if not exists tool_email_subscriptions (
  id                  uuid        primary key default gen_random_uuid(),
  email               text        not null,
  anonymous_id        uuid,
  user_id             uuid        references profiles(id) on delete cascade,
  kind                text        not null check (kind in (
                                    'yearly_weekends_checkin',
                                    'sunday_moments'
                                  )),
  kid_profile_id      uuid        references kid_profiles(id) on delete cascade,
  anchor_date         date,
  unsubscribe_token   uuid        not null default gen_random_uuid(),
  created_at          timestamptz not null default now()
);

create unique index if not exists idx_tool_email_subs_unsubscribe_token
  on tool_email_subscriptions (unsubscribe_token);

-- Cron lookup: daily yearly-anniversary picker
create index if not exists idx_tool_email_subs_yearly_anchor
  on tool_email_subscriptions (kind, anchor_date)
  where kind = 'yearly_weekends_checkin';

-- Cron lookup: weekly Sunday-night batch
create index if not exists idx_tool_email_subs_sunday
  on tool_email_subscriptions (kind, created_at)
  where kind = 'sunday_moments';

create index if not exists idx_tool_email_subs_user
  on tool_email_subscriptions (user_id)
  where user_id is not null;

alter table tool_email_subscriptions enable row level security;

create policy "tool_email_subs owner read"
  on tool_email_subscriptions for select
  to authenticated
  using (user_id = auth.uid() or is_admin());

create policy "tool_email_subs owner delete"
  on tool_email_subscriptions for delete
  to authenticated
  using (user_id = auth.uid() or is_admin());

-- No INSERT/UPDATE policy — writes happen via Server Actions (anonymous opt-ins
-- need write access pre-signup). Service role bypasses RLS.

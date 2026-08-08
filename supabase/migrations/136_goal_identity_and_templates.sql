-- Migration 136: identity above the process — identity columns + `goal_templates`
-- Apply via: supabase db push  OR paste into the Supabase SQL editor.
-- DO NOT push automatically — applied manually by the operator.
-- Every block is idempotent — safe to re-run if a partial application failed.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- IDENTITY → PROCESS → OUTCOME
--
-- The spine already owns process (goal_schedules → goal_occurrences) and outcome
-- (the curve + goal_entries). Identity is the layer above both, and it's what
-- makes a completion mean something durable: every logged day is a vote for the
-- man you're becoming, not a point in a game you can lose.
--
-- WHY THESE COLUMNS LIVE ON `goals` AND NOT IN A STATS TABLE
--   Migration 135 put derived numbers in `goal_stats` precisely because `goals`
--   carries a BEFORE UPDATE trigger that stamps `updated_at` — a recomputed
--   streak has no business looking like an edit. An identity statement is the
--   opposite case: editing who you're becoming genuinely IS an edit, and it
--   SHOULD move `updated_at`. Same distinction, opposite answer.
--
--   A multi-goal `identities` table (one identity, several goals voting for it)
--   stays DEFERRED. Flat columns are cheaper to migrate into a table later than
--   a table is to speculate on now.
--
-- WHAT A VOTE IS — DECIDED, and it is NOT stored anywhere
--   A vote is a `completed` or `catchup` ENTRY inside the current plan window
--   (goals.started_on → target_date). Two things follow, both deliberate:
--
--     • NO TARGET GATE. Six cigarettes against a target of five is still a vote.
--       A man who logs an honest number on a bad day has done the hardest thing
--       this product asks of him, and withholding the vote would make honest
--       logging the penalised behaviour. Whether he beat the number is the
--       CURVE's question, and compareToTarget() already answers it kindly.
--       Two numbers, two questions — collapsing them turns identity into a
--       second scoreboard that can stall.
--
--     • ENTRIES, NOT OCCURRENCES. Off-day logging exists, so an unprompted
--       workout counts. `goal_stats.logged_done` counts occurrences and is
--       therefore the WRONG source for votes.
--
--   Misses, skips and relapses are never anti-votes. The count only ever holds
--   still. Nothing here materializes it — same rule as goal_stats and
--   lib/goals/progress.ts.
--
-- ⚠️ THE ONE HARD RULE: IDENTITY LANGUAGE NEVER GOES IN PUSH OR EMAIL.
--   A notification has no conversational context. "Another vote for the man who
--   doesn't need cigarettes" landing twenty minutes after a relapse is exactly
--   the edge-ON-when-it-should-be-OFF failure brand-guide §1.6 warns about — and
--   cessation and medication are the FIRST vertical here. Notifications stay
--   process-language ("Today's number: 6"). The Boss carries identity, because
--   he knows the user just said it was a rough day. The one-tap confirmation
--   PAGE is also fine — it's post-action, in a browser, with context. The inbox
--   is not. Nothing is lost: the notification's job is the tap, and the identity
--   moment lands on the far side of it.
--
--   This is enforced, not merely documented: `npm run check:goals-identity`
--   (wired into prebuild) fails the build if these columns appear in the sweep,
--   the push layer, or any email template.
--
-- WHY `goal_templates` IS A TABLE AND NOT A CONSTANT
--   The five `kind` presets used to live in a const in app/(tools)/goals/new,
--   whose own comment called them "the template layer in its simplest form".
--   Two prefill paths would have meant a taper's defaults living in two places,
--   so the kinds are folded in here as rows flagged `is_kind_default` and the
--   const is deleted. One prefill path, in the same table an operator can edit
--   in prod without a deploy — and seeded from this migration, so authoring
--   still lives in version control. Same shape as `categories` (128).
--
-- A TEMPLATE IS A PRE-FILLED CREATE-FORM PAYLOAD.
--   Every column below maps to a field of the Zod schema in
--   /api/goals/create — including `recur_when` / `recur_days`, because NOBODY
--   AUTHORS AN RRULE: the user picks "every day" or "Mon/Wed/Fri" and the route
--   assembles the RFC 5545 string. The CHECKs at the bottom of the table mirror
--   that route's validation, so a bad seeded row fails HERE rather than becoming
--   a form that bounces the user with a friendly, wrong message. The reader
--   (lib/goals/templates.ts) also re-validates and drops rows it can't parse.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. `goals` — three columns
-- ════════════════════════════════════════════════════════════════════════════

alter table goals add column if not exists identity_statement text;

-- The same identity in a few words, for surfaces a sentence can't fit: "Voting
-- for: Smoke-Free" under a row of the Today list. NOT auto-generated — every
-- template ships a pre-written one, because the alternatives are an AI call on a
-- form submit or a truncation that renders "I am the kind of dad who…".
alter table goals add column if not exists identity_short text;

-- Where the goal came from. Plain text, NO foreign key ON PURPOSE: retiring or
-- renaming a template must never break a goal someone is three weeks into. It
-- buys "read the plan behind this →" on the goal page, and it's the only way to
-- ever ask which plans people actually stick to.
alter table goals add column if not exists template_slug text;

comment on column goals.identity_statement is
  'Present-tense identity line ("I am a dad who…"), optional, <=160 chars. NEVER render in push or email — the Boss carries identity, notifications carry process. Enforced by scripts/check-goals-identity.mjs.';
comment on column goals.identity_short is
  'The same identity in <=24 chars, for list rows ("Voting for: Smoke-Free"). Same push/email prohibition as identity_statement.';
comment on column goals.template_slug is
  'goal_templates.slug this goal was created from. Deliberately not an FK — a retired template must not break an in-flight goal.';

-- A phrase, not a journal. The cap is also what keeps it renderable as one line
-- under the curve. Trimmed-empty is normalized to NULL by the app (emptyToNull),
-- so a whitespace-only statement can't masquerade as set.
alter table goals drop constraint if exists goals_identity_statement_shape;
alter table goals add  constraint goals_identity_statement_shape
  check (
    identity_statement is null
    or length(trim(identity_statement)) between 1 and 160
  );

-- 24 is what fits beside a goal title on a phone without wrapping.
alter table goals drop constraint if exists goals_identity_short_shape;
alter table goals add  constraint goals_identity_short_shape
  check (
    identity_short is null
    or length(trim(identity_short)) between 1 and 24
  );


-- ════════════════════════════════════════════════════════════════════════════
-- 2. `goal_templates` — public content (Pattern A)
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists goal_templates (
  slug                text        primary key,

  -- Display copy. Free to reword any time — no migration, no code change.
  label               text        not null,
  blurb               text        not null,

  -- The pre-written identity suggestion. THE POINT OF THE PICKER: onboarding is
  -- the lowest-motivation moment there is, and handing someone a blank "who are
  -- you becoming?" box at that moment is how the field goes unused forever.
  -- Pre-filled, accepted with one tap, free text as the secondary path.
  identity_suggestion       text,
  identity_short_suggestion text,

  -- ⚠️ EDGE OFF. `kind` does NOT encode sensitivity: `reduce` covers both
  -- quitting cigarettes and cutting screen time, and `adherence` covers both
  -- vitamins and psychiatric medication. Without this flag the "softer on
  -- cessation and medication" rule is unimplementable — there is nothing in the
  -- data to branch on. Copied onto goals.config.sensitive at create time, so the
  -- Boss and the UI read one boolean: protective framing, no red heatmap cells,
  -- and never a word about a vote that didn't happen.
  --
  -- The weigh-in template is seeded FALSE — a judgment call, not a claim that
  -- weight is easy. One UPDATE flips it if that reads wrong in practice.
  is_sensitive        boolean     not null default false,

  -- The guide this plan is drawn from, if one is published. ON UPDATE CASCADE
  -- because guide slugs DO get renamed here (that's what guides.legacy_slugs
  -- exists for) and a stale link is worse than none. ON DELETE SET NULL so
  -- unpublishing a guide degrades to a template with no reading, not a broken
  -- template. Nullable, and NULL for every seeded row today.
  guide_slug          text        references guides(slug)
                                  on update cascade on delete set null,

  -- ── the pre-filled create-form payload ──────────────────────────────────
  kind                text        not null
                                  check (kind in ('reduce', 'adherence', 'program', 'metric', 'custom')),
  title_suggestion    text        not null default '',
  metric_key          text,
  metric_unit         text,
  direction           text        check (direction in ('down', 'up', 'hold')),

  curve               text        not null default 'none'
                                  check (curve in ('none', 'linear', 'step')),
  baseline_value      numeric(12,3),
  target_value        numeric(12,3),
  weeks               integer     check (weeks is null or weeks between 1 and 520),
  step_every_days     integer     check (step_every_days is null or step_every_days between 1 and 365),

  -- The schedule picker's answers, not an RRULE. buildRrule() in
  -- lib/goals/schedule-input.ts turns these into the stored rule.
  recur_when          text        not null default 'daily'
                                  check (recur_when in ('daily', 'weekdays', 'days', 'monthly')),
  recur_days          text[]      not null default '{}'::text[]
                                  check (recur_days <@ array['MO','TU','WE','TH','FR','SA','SU']::text[]),
  local_time          time        not null default '08:00',

  -- ── shelf placement ────────────────────────────────────────────────────
  -- `is_kind_default` marks the five generic shapes behind "Something else →".
  -- Exactly one per kind (unique index below).
  is_kind_default     boolean     not null default false,
  sort_order          integer     not null default 0,
  status              text        not null default 'active'
                                  check (status in ('active', 'hidden')),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint goal_templates_label_shape
    check (length(trim(label)) > 0 and length(trim(blurb)) > 0),

  -- Same caps as the goals columns, so a suggestion can always be stored
  -- verbatim as the statement.
  constraint goal_templates_identity_shape
    check (
      (identity_suggestion is null
        or length(trim(identity_suggestion)) between 1 and 160)
      and
      (identity_short_suggestion is null
        or length(trim(identity_short_suggestion)) between 1 and 24)
    ),

  -- ── mirrors of the create route's validation ───────────────────────────
  -- These are the difference between "bad seed rejected at apply time" and
  -- "template that silently bounces every user who taps it".
  constraint goal_templates_step_requires_interval
    check (curve <> 'step' or step_every_days is not null),

  -- A curved template must know its LENGTH, because a plan's length is a
  -- property of the plan. Its ENDPOINTS may be NULL on purpose: twenty
  -- cigarettes a day is a fair opening guess, a man's starting weight is not,
  -- and prefilling one would be the tool telling him what he weighs. Where
  -- they're NULL the form marks those inputs `required` instead, so the ask
  -- happens on screen rather than as a bounce after submit. `goals` still CHECKs
  -- both endpoints (134) — this relaxation is about the prefill, never the goal.
  constraint goal_templates_curve_requires_length
    check (curve = 'none' or weeks is not null),

  constraint goal_templates_days_requires_picks
    check (recur_when <> 'days' or cardinality(recur_days) > 0)
);

comment on table goal_templates is
  'Pre-filled create-form payloads for /goals/new, each carrying a pre-written identity suggestion. Rows flagged is_kind_default are the five generic kind shapes. Seeded by migration 136; an operator may edit rows in place. Read by lib/goals/templates.ts, which re-validates every row.';

-- Exactly one default per kind — "Something else →" must never show a kind
-- twice, and templateForKind() must never have to pick between two rows.
create unique index if not exists idx_goal_templates_kind_default
  on goal_templates (kind)
  where is_kind_default;

-- The picker's read: active plans in shelf order.
create index if not exists idx_goal_templates_shelf
  on goal_templates (status, is_kind_default, sort_order);

-- Reverse lookup for a future "Start this plan" CTA on a guide page.
create index if not exists idx_goal_templates_guide
  on goal_templates (guide_slug)
  where guide_slug is not null;

-- Reuse the trigger function migration 134 already defines for this domain.
drop trigger if exists trg_goal_templates_updated_at on goal_templates;
create trigger trg_goal_templates_updated_at
  before update on goal_templates
  for each row execute function set_goals_updated_at();


-- ── RLS: Pattern A, public content ─────────────────────────────────────────
-- Templates are CONTENT, not user data: nothing here describes a person. Read is
-- `to anon, authenticated` so a logged-out visitor can see what the tool offers
-- before signing up — forgetting that role is how migrations 042 and 043 shipped
-- pages that worked for the admin and were empty for everyone else. Hidden rows
-- stay readable to admins only. Writes are admin-only via the canonical helper.

alter table goal_templates enable row level security;

drop policy if exists "goal_templates_read" on goal_templates;
create policy "goal_templates_read"
  on goal_templates for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists "goal_templates_admin_read_all" on goal_templates;
create policy "goal_templates_admin_read_all"
  on goal_templates for select
  to authenticated
  using (is_admin());

drop policy if exists "goal_templates_admin_write" on goal_templates;
create policy "goal_templates_admin_write"
  on goal_templates for all
  to authenticated
  using (is_admin())
  with check (is_admin());


-- ════════════════════════════════════════════════════════════════════════════
-- 3. SEED
--
-- `on conflict do update` restores the seeded values verbatim, so re-applying
-- this migration is a no-op rather than a duplicate-key failure. If an operator
-- ever tunes a row in prod and wants it kept, narrow the update list — don't
-- remove the upsert. A seed that can't re-run is a seed that drifts.
--
-- VOICE NOTE: identity lines are present tense and about who he's becoming —
-- never "I will stop being". They lean on fatherhood rather than on the habit,
-- because "I am the dad who looks up when his kid walks in" survives a bad day
-- and "I am a non-smoker" doesn't. Nothing here gives medical or dosing advice;
-- the taper numbers are a starting point the user edits, exactly as they were
-- when they were hardcoded defaults in the form.
-- ════════════════════════════════════════════════════════════════════════════

insert into goal_templates (
  slug, label, blurb, identity_suggestion, identity_short_suggestion,
  is_sensitive, kind, title_suggestion,
  metric_key, metric_unit, direction, curve, baseline_value, target_value,
  weeks, step_every_days, recur_when, recur_days, local_time,
  is_kind_default, sort_order
) values

  -- ── concrete plans (the shelf) ────────────────────────────────────────────
  ('quit-smoking-taper',
   'Quit smoking, one step down at a time',
   'Twenty a day to zero over eight weeks. Each level gets a full week, so you''re never white-knuckling a cliff.',
   'I am becoming a dad who can keep up with his kid.', 'Smoke-Free',
   true, 'reduce', 'Quit smoking',
   'cigarettes', 'per day', 'down', 'step', 20, 0, 8, 7,
   'daily', '{}', '20:00', false, 10),

  ('drink-less',
   'Drink less, on a schedule you set',
   'Three a night down to none over ten weeks. You log the honest number — nobody''s grading it.',
   'I am becoming the dad my kids can count on at any hour.', 'Clear-Headed',
   true, 'reduce', 'Drink less',
   'drinks', 'per day', 'down', 'step', 3, 0, 10, 7,
   'daily', '{}', '21:00', false, 20),

  ('less-phone-more-kid',
   'Less phone, more kid',
   'Four hours of screen time down to one over six weeks. The number your phone already tells you, pointed somewhere useful.',
   'I am the dad who looks up when his kid walks in.', 'Present Dad',
   false, 'reduce', 'Less phone',
   'screen time', 'hours per day', 'down', 'step', 4, 1, 6, 7,
   'daily', '{}', '21:30', false, 30),

  ('meds-every-day',
   'Take your meds, every day',
   'One nudge, one tap. No numbers, no scoring — just did it or didn''t.',
   'I am a man who takes care of the body his family depends on.', 'Takes Care of It',
   true, 'adherence', 'Take my meds',
   null, null, null, 'none', null, null, null, null,
   'daily', '{}', '08:00', false, 40),

  ('lift-three-times',
   'Lift three times a week',
   'Mon, Wed, Fri for twelve weeks. Miss one and the week still counts — the point is the run, not a perfect record.',
   'I am becoming the kind of dad who''s still strong at sixty.', 'Still Strong',
   false, 'program', 'Lift three times a week',
   null, null, null, 'none', null, null, null, null,
   'days', '{MO,WE,FR}', '06:30', false, 50),

  ('walk-every-day',
   'Get outside every day',
   'One walk, every day, however long you''ve got. The easiest one on this list to actually keep.',
   'I am a man who gets outside every day.', 'Out Every Day',
   false, 'adherence', 'Walk every day',
   null, null, null, 'none', null, null, null, null,
   'daily', '{}', '07:00', false, 60),

  ('weigh-in-sundays',
   'Get to a weight, weighing in once a week',
   'A Sunday-morning weigh-in and a line to your target over sixteen weeks. Daily weight is noise; weekly is a signal.',
   'I am becoming the dad who plays the whole game instead of watching it.', 'In the Game',
   false, 'metric', 'Get to my weight',
   'weight', 'lb', 'down', 'linear', null, null, 16, null,
   'days', '{SU}', '07:00', false, 70),

  -- ── the five generic shapes, behind "Something else →" ────────────────────
  -- These carry the same defaults the KINDS const in app/(tools)/goals/new used
  -- to hold, which is what makes deleting it lossless. The reduce default is
  -- seeded sensitive because its own prefill is cigarettes.
  ('kind-reduce',
   'Cutting back',
   'Smoking, drinking, screen time — a number that comes down on a schedule.',
   'I am becoming a man who doesn''t need it.', 'Free of It',
   true, 'reduce', 'Cut back',
   'cigarettes', 'per day', 'down', 'step', 20, 0, 8, 7,
   'daily', '{}', '20:00', true, 100),

  ('kind-adherence',
   'Daily habit',
   'Vitamins, medication, stretching. Did it or didn''t.',
   'I am a man who does the small thing every day.', 'Consistent',
   false, 'adherence', 'Take my vitamins',
   null, null, null, 'none', null, null, null, null,
   'daily', '{}', '08:00', true, 110),

  ('kind-program',
   'Program',
   'Workouts on set days. Couch-to-5K, lifting three times a week.',
   'I am becoming a stronger dad than I was last year.', 'Still Strong',
   false, 'program', 'Lift three times a week',
   null, null, null, 'none', null, null, null, null,
   'days', '{MO,WE,FR}', '06:30', true, 120),

  ('kind-metric',
   'Tracking',
   'Weight, resting heart rate, anything you weigh or measure.',
   'I am a man who faces the actual number.', 'Honest About It',
   false, 'metric', 'Get to my weight',
   'weight', 'lb', 'down', 'linear', null, null, 16, null,
   'days', '{SU}', '07:00', true, 130),

  ('kind-custom',
   'Reminder',
   'Anything else you want a nudge about.',
   'I am a man who does what he said he''d do.', 'Keeps His Word',
   false, 'custom', '',
   null, null, null, 'none', null, null, null, null,
   'daily', '{}', '18:00', true, 140)

on conflict (slug) do update set
  label                     = excluded.label,
  blurb                     = excluded.blurb,
  identity_suggestion       = excluded.identity_suggestion,
  identity_short_suggestion = excluded.identity_short_suggestion,
  is_sensitive              = excluded.is_sensitive,
  kind                      = excluded.kind,
  title_suggestion          = excluded.title_suggestion,
  metric_key                = excluded.metric_key,
  metric_unit               = excluded.metric_unit,
  direction                 = excluded.direction,
  curve                     = excluded.curve,
  baseline_value            = excluded.baseline_value,
  target_value              = excluded.target_value,
  weeks                     = excluded.weeks,
  step_every_days           = excluded.step_every_days,
  recur_when                = excluded.recur_when,
  recur_days                = excluded.recur_days,
  local_time                = excluded.local_time,
  is_kind_default           = excluded.is_kind_default,
  sort_order                = excluded.sort_order,
  updated_at                = now();

COMMIT;


-- ─── AFTER APPLYING ─────────────────────────────────────────────────────────
--   • npm run db:types          (goals gains three columns; goal_templates is new)
--   • npm run check:goals-identity   — must pass; it also runs in prebuild
--   • no backfill: existing goals keep identity_statement NULL and render
--     exactly as they did. Nothing reads template_slug for a goal that predates
--     the picker.
--   • verify the shelf is readable to a LOGGED-OUT visitor before trusting
--     /goals/new — a Pattern A table that only an admin can read looks fine in
--     testing and is empty in production (migs 042, 043).
--   • `sensitive` reaches a goal through goals.config, which is Zod-validated at
--     the API edge and NOT constrained by Postgres (134's decision). If a future
--     writer drops the key, the goal silently loses its edge-off framing — the
--     create route is the only place that sets it, and it should stay that way.

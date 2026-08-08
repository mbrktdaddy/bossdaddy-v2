-- Migration 139: a revocable subscription token for the goal calendar feed
-- Apply via: supabase db push  OR paste into the Supabase SQL editor.
-- DO NOT push automatically — applied manually by the operator.
-- Idempotent — safe to re-run.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHY THIS CAN'T USE THE TOKENS WE ALREADY HAVE
--
-- `lib/goals/links.ts` mints HMAC tokens for one-tap reminder links: 14-day TTL,
-- stateless, key derived from GOAL_LINK_SECRET. Perfect for a link in an email
-- that gets tapped once this week. Wrong for a calendar subscription, twice over:
--
--   • A calendar feed is polled for YEARS. A 14-day expiry means the subscription
--     dies silently — the calendar stops updating and nothing tells him.
--   • It must be REVOCABLE INDIVIDUALLY. A stateless HMAC can only be invalidated
--     by rotating the derived key, which would break every outstanding one-tap
--     link at the same time. Rotation has to be per-user, not global.
--
-- So the token is stored. Rotating is one UPDATE, takes effect on the next poll,
-- and touches nothing else.
--
-- ⚠️ THE URL IS THE CREDENTIAL, AND THE TITLES ARE REAL.
-- Anyone holding the feed URL can read this user's goal titles and schedules
-- without signing in — that is inherent to calendar subscriptions (Google and
-- Apple fetch from their own servers, with no cookies to send). The operator chose
-- REAL goal titles in the feed rather than neutral ones, which makes the token the
-- only thing standing between a leaked URL and "Quit smoking, 8:00pm daily".
--
-- Consequences encoded here on purpose:
--   • ONE token per user (user_id is the primary key). Fewer live credentials, and
--     "reset my link" has an unambiguous meaning.
--   • `rotated_at` and `last_used_at` exist so a leak is diagnosable — if a URL
--     was reset and something is still polling, that's visible.
--   • No expiry column. An expiring calendar feed fails silently, which is worse
--     than a long-lived one he can reset on demand.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

create table if not exists goal_calendar_tokens (
  -- One feed per user. PK and FK at once, so it cascades away with the account.
  user_id      uuid        primary key references auth.users on delete cascade,

  -- 32 random bytes, base64url, generated server-side. UNIQUE because the feed
  -- route looks the user up BY this column — a collision would serve the wrong
  -- man's calendar, so let Postgres make that impossible rather than trusting the
  -- generator.
  token        text        not null unique,

  created_at   timestamptz not null default now(),
  rotated_at   timestamptz,
  -- Best-effort, written by the feed route. Answers "is anything actually
  -- subscribed", and after a reset, "is something still trying the old link".
  last_used_at timestamptz,

  -- A short token is a guessable token. 32 bytes base64url is 43 chars; the floor
  -- is deliberately below that so a future format change doesn't need a migration,
  -- while still refusing anything trivially brute-forceable.
  constraint goal_calendar_tokens_length check (length(token) >= 32)
);

comment on table goal_calendar_tokens is
  'Per-user subscription token for the .ics goal feed. The URL is a bearer credential — calendar clients fetch it with no session. Rotating the token is the revocation mechanism; there is deliberately no expiry, because an expiring feed dies silently. See migration 139.';

alter table goal_calendar_tokens enable row level security;

-- Pattern B, private user data. No is_admin(): this token grants read access to a
-- man's medication and cessation schedule, so an admin holding it would be an
-- admin who can silently subscribe to it. Support reaches this table through the
-- service-role client, which is auditable.
drop policy if exists "goal_calendar_tokens_owner_read" on goal_calendar_tokens;
create policy "goal_calendar_tokens_owner_read"
  on goal_calendar_tokens for select
  to authenticated
  using (user_id = auth.uid());

-- Owner writes his own row: creating the feed and resetting it are both his to do,
-- and the VALUE is always generated server-side (a client-chosen token would be a
-- client-chosen password).
drop policy if exists "goal_calendar_tokens_owner_write" on goal_calendar_tokens;
create policy "goal_calendar_tokens_owner_write"
  on goal_calendar_tokens for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

COMMIT;


-- ─── AFTER APPLYING ─────────────────────────────────────────────────────────
--   • npm run db:types
--   • The feed route reads this table with the SERVICE-ROLE client, by necessity:
--     the caller is Google's or Apple's server and has no session. That makes the
--     token lookup the ONLY authorization on that route — there is no RLS fallback
--     behind it. Treat that route's token check as security-critical code.
--   • Nothing exists until a user generates a link, so this migration is inert on
--     apply: no backfill, and no user has a feed until he asks for one.
--   • `/api/goals/calendar/*` sits under the robots `Disallow: /api/` group, which
--     is what we want here — but that also means it must NEVER be referenced from a
--     meta tag, the sitemap, or JSON-LD. See project_social_preview_seo in memory:
--     Twitterbot ignores a more-specific Allow, and an indexed calendar URL would
--     be a published credential.

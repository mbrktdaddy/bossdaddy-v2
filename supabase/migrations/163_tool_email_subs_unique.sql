-- ─────────────────────────────────────────────────────────────────────────────
-- 163 — One subscription per address per list (per kid).
--
-- tool_email_subscriptions (076) had no uniqueness beyond the unsubscribe
-- token, so re-submitting the opt-in form — a double-tap, two tabs, a return
-- visit — inserted a second row, and the Sunday / yearly crons then emailed
-- that address once per row. subscribeToToolEmail now treats a unique
-- violation (23505) as "already on the list" instead of an error.
--
-- The key is (lower(email), kind, kid): the same dad can subscribe one address
-- to the Sunday nudge for each of his kids (the email names the kid), and the
-- kid-less opt-in (kid_profile_id is null) counts as its own slot. coalesce()
-- to the nil uuid, rather than NULLS NOT DISTINCT, so the index also replays
-- on older Postgres. lower(email) because the app lowercases on insert but
-- nothing at the DB level did.
--
-- Table is private user data (RLS from 076/107, writes via service role) — no
-- policy changes here, and nothing new for scripts/shadow-setup.sql to stub.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. Dedupe ────────────────────────────────────────────────────────────────
-- Index creation fails while duplicates exist, so collapse them first: keep the
-- earliest row per key (it carries the original anchor_date / opt-in time) and
-- drop the rest. An unsubscribe link from a dropped row's email will then match
-- nothing; the address stays on the kept row until its own link is used. That's
-- acceptable for a handful of accidental double-submits.
with ranked as (
  select id,
         row_number() over (
           partition by lower(email),
                        kind,
                        coalesce(kid_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
           order by created_at, id
         ) as rn
    from tool_email_subscriptions
)
delete from tool_email_subscriptions t
 using ranked r
 where t.id = r.id
   and r.rn > 1;

-- ─── 2. Guard ─────────────────────────────────────────────────────────────────
create unique index if not exists idx_tool_email_subs_unique
  on tool_email_subscriptions (
    lower(email),
    kind,
    coalesce(kid_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

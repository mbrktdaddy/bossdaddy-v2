-- Migration 153 — Email suppression list (Resend bounce + complaint webhook)
--
-- WHY THIS EXISTS
--   The app had zero bounce and complaint handling. Every hard bounce was
--   re-attempted on the next cron pass, and every "mark as spam" click was
--   invisible. SPF/DKIM/DMARC were already correct and aligned — the missing
--   feedback loop was the actual deliverability risk, because mailbox providers
--   score you on whether you stop mailing addresses that reject you.
--
-- PATTERN C (admin-only). This is operational deliverability data, not
-- user-owned data:
--   • the webhook writes it through the service-role client (bypasses RLS)
--   • admins read it for support ("why didn't this dad get his email?")
--   • NO anon read — the table is a list of real email addresses and would be a
--     harvestable PII leak. This is deliberately NOT the public-content pattern.

create table if not exists email_suppressions (
  id              uuid        primary key default gen_random_uuid(),

  -- Normalized (lower + trim) by record_email_suppression() below, never by the
  -- caller. The UNIQUE constraint is what makes the webhook idempotent: Svix
  -- delivers at-least-once, so the same bounce can arrive two or three times.
  email           text        unique not null,

  -- 'bounce'    → address is dead; blocks ALL mail including transactional
  -- 'complaint' → recipient hit "mark as spam"; blocks marketing only
  -- 'manual'    → operator override; blocks all
  reason          text        not null check (reason in ('bounce', 'complaint', 'manual')),

  -- Resend passes SES-style bounce classification through verbatim.
  -- bounce_type: 'Permanent' | 'Transient' | 'Undetermined'
  -- bounce_subtype: 'General' | 'NoEmail' | 'MailboxFull' | 'Suppressed' | ...
  -- Only Permanent suppresses — see lib/email-suppression.ts. A Transient
  -- bounce (mailbox full) is recorded for visibility but must NOT block a real
  -- user, which is why the classification is stored rather than collapsed.
  bounce_type     text,
  bounce_subtype  text,
  detail          text,

  -- Provenance of the most recent event, so support can answer "which message
  -- did this come from?" without trawling the Resend dashboard.
  last_email_id   text,
  last_subject    text,

  event_count     integer     not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- `email` is UNIQUE and therefore already indexed — no redundant B-tree here
-- (see _TEMPLATE.sql doctrine #5). This index serves the admin listing query
-- ("most recent suppressions, worst reason first").
create index if not exists idx_email_suppressions_recent
  on email_suppressions (updated_at desc);

alter table email_suppressions enable row level security;

-- Admin-only, and only via a logged-in admin session. The webhook does not rely
-- on this policy at all; it uses the service-role client.
create policy "email_suppressions_admin_all"
  on email_suppressions for all
  to authenticated
  using (is_admin())
  with check (is_admin());


-- ─── Idempotent upsert with reason precedence ────────────────────────────────
-- Why an RPC instead of a plain .upsert(): the reason column must never be
-- DOWNGRADED. If an address hard-bounces (blocks everything) and later files a
-- complaint (blocks marketing only), a naive upsert would overwrite 'bounce'
-- with 'complaint' and quietly re-open transactional mail to a dead address.
-- Doing the precedence check in a read-then-write from TypeScript would be racy
-- under concurrent webhook retries; doing it inside ON CONFLICT is atomic.
create or replace function record_email_suppression(
  p_email          text,
  p_reason         text,
  p_bounce_type    text default null,
  p_bounce_subtype text default null,
  p_detail         text default null,
  p_email_id       text default null,
  p_subject        text default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  -- Resend sends `to` as an array; a malformed or empty entry is not an error
  -- worth failing the whole webhook delivery over.
  if v_email = '' then
    return;
  end if;

  insert into email_suppressions as s (
    email, reason, bounce_type, bounce_subtype, detail, last_email_id, last_subject
  ) values (
    v_email, p_reason, p_bounce_type, p_bounce_subtype, p_detail, p_email_id, p_subject
  )
  on conflict (email) do update set
    -- Precedence: manual > bounce > complaint. Never weaken an existing block.
    reason = case
      when s.reason = 'manual' then 'manual'
      when s.reason = 'bounce' and excluded.reason = 'complaint' then 'bounce'
      else excluded.reason
    end,
    bounce_type    = coalesce(excluded.bounce_type, s.bounce_type),
    bounce_subtype = coalesce(excluded.bounce_subtype, s.bounce_subtype),
    detail         = coalesce(excluded.detail, s.detail),
    last_email_id  = coalesce(excluded.last_email_id, s.last_email_id),
    last_subject   = coalesce(excluded.last_subject, s.last_subject),
    event_count    = s.event_count + 1,
    updated_at     = now();
end;
$$;

-- CRITICAL — Postgres grants EXECUTE on new functions to PUBLIC by default, and
-- Supabase has already granted the `anon` and `authenticated` roles usage on the
-- public schema. Without these revokes, any anonymous visitor could call this
-- SECURITY DEFINER function and suppress arbitrary addresses — including
-- boss@bossdaddylife.com, silently killing all outbound mail to the operator.
-- A `grant` to one role does not exclude the others; you must revoke explicitly.
revoke all on function record_email_suppression(text, text, text, text, text, text, text)
  from public, anon, authenticated;

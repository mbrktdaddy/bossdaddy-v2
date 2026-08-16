-- ─────────────────────────────────────────────────────────────────────────────
-- Stop the public anon key from reading internal moderation state on `profiles`,
-- and stop members from writing it. Audit findings #2 (read) and #7 (write).
--
-- ── THE READ SIDE (#2) ───────────────────────────────────────────────────────
-- `profiles_public_read` is `to anon, authenticated using (true)` (043), which
-- was accurate when written — the table held only public identity data. Since
-- then 050 added seven moderation columns, 085 a notification pref, 124
-- `trust_locked`, and 140 two connection prefs. RLS is ROW-level: the policy
-- says nothing about columns, and no column-level GRANT was ever added, so
-- every one of those became readable by anyone holding the publishable anon key.
-- That includes `moderation_note` — a 2000-char free-text field an admin writes
-- about a member (`app/api/admin/users/moderate/route.ts:31,62-63`).
--
-- WHY GRANTS AND NOT A POLICY: RLS cannot scope columns, and column privileges
-- cannot scope rows. This migration fixes the part that is genuinely
-- column-shaped — "no web role may ever read moderation state." What it does
-- NOT fix is that an *authenticated* user can still read another user's
-- `account_status` / `deletion_requested_at` / notification prefs, because
-- those must stay readable for the user's OWN row and privileges can't tell the
-- difference. Closing that needs a separate `profile_moderation` table; it is a
-- deliberate, smaller residual, not an oversight. See audit #2 "Step 2".
--
-- ⚠️ THE TRAP THIS AVOIDS: the audit's original one-line fix revoked SELECT and
-- re-granted only public identity columns. That breaks `lib/proxy/moderation.ts:21-27`,
-- which reads `account_status, suspended_until` with the USER'S OWN SESSION
-- client on every authenticated request and treats a null result as "no
-- problem" (`if (!profile) return null`) — so the ban gate would have failed
-- OPEN for every banned and suspended user. `authenticated` is granted those
-- two columns below on purpose. Do not remove them without moving that read to
-- the service-role client first.
--
-- Verified before writing: nothing does `select('*')` on profiles, and the only
-- anon-client reads are `username`, `display_name`, `tagline`, `bio`,
-- `avatar_url`, `id`, `role` (author pages + AuthorBio) — all granted below.
--
-- ── THE WRITE SIDE (#7) ──────────────────────────────────────────────────────
-- `profiles_self_update` (007) is `using (id = auth.uid()) with check (id = auth.uid())`
-- — column-blind. A member could PATCH their own row and set
-- `trusted_commenter = true`, skipping comment moderation in one request. The
-- same hole covers self-unbanning via `account_status`.
--
-- `prevent_role_escalation()` already guards `role` this way, so this extends
-- that function rather than adding a second trigger. The trigger keeps its
-- existing name (`profiles_role_guard`) because `supabase/tests/rls_doctrine_test.sql`
-- disables it by name to seed an admin.
--
-- Role scoping inside the trigger:
--   * `role` stays guarded for EVERY role including service_role — unchanged
--     from 007, and matches the standing "never service_role-write
--     profiles.role" rule.
--   * The new columns are guarded only for `anon` / `authenticated`, i.e.
--     browser-originated requests. The service-role client legitimately writes
--     them (`api/account/delete-request:46`, `api/account/cancel-deletion:29`)
--     and is auditable; admin routes write them via a session client whose user
--     satisfies `is_admin()` (`api/admin/users/moderate:94`, `api/admin/users/trust:41`).
--
-- Requires the companion code change in `app/api/comments/route.ts`:
-- `checkTrustPromotion` auto-promotes a commenter by writing
-- `trusted_commenter` with the SESSION client — the very mechanism #7 abuses.
-- It moves to the service-role client, as does the trust read, which this
-- migration also revokes from `authenticated`.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Column privileges ─────────────────────────────────────────────────────
-- Only SELECT is revoked. INSERT/UPDATE/DELETE privileges are untouched — write
-- protection is the trigger's job, below.
revoke select on profiles from anon, authenticated;

-- Logged-out visitors: public identity only. Author bylines, AuthorBio, comment
-- attribution. Nothing else.
grant select (
  id, username, display_name, avatar_url, bio, tagline, role, created_at
) on profiles to anon;

-- Signed-in users: the above, plus the fields a user needs about THEMSELVES
-- (settings page, account deletion state) and the two the proxy ban gate reads
-- on every request. Deliberately excludes all six moderation columns.
grant select (
  id, username, display_name, avatar_url, bio, tagline, role, created_at,
  account_status, suspended_until, deletion_requested_at,
  email_new_message, connection_requests_from, discoverable_by_email
) on profiles to authenticated;

-- NOT granted to any web role: moderation_reason, moderation_note,
-- moderation_action_at, moderation_action_by, trusted_commenter, trust_locked.
-- Reachable only through the service-role client, which bypasses privileges.
--
-- Column grants are FAIL-CLOSED for future columns: a new column added to
-- profiles is granted to nobody until someone says so. That is the actual fix
-- for this class — migration 050's columns leaked precisely because the grant
-- was table-wide and new columns inherited it silently.

-- ── 2. Write guard ───────────────────────────────────────────────────────────
create or replace function prevent_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Unchanged from 007: role is guarded for every role, service_role included.
  if old.role is distinct from new.role and not is_admin() then
    raise exception 'Only admins can change user roles';
  end if;

  -- New: moderation state is guarded for requests made BY an end user.
  --
  -- The condition is `auth.uid() is not null`, deliberately NOT a check on
  -- `current_user`. This function is SECURITY DEFINER, which rewrites
  -- `current_user` to the function's owner (postgres) inside the body — so a
  -- role-name test silently never matches and the guard becomes a no-op. The
  -- pgTAP suite caught exactly that during development.
  --
  -- `auth.uid() is not null` is true only when a real end-user JWT is present:
  --   * browser request as a member  → guarded (this is the #7 hole)
  --   * browser request as an admin  → allowed by is_admin() below
  --   * service-role client          → no `sub` claim, uid null → exempt
  --                                    (api/account/delete-request:46,
  --                                     api/account/cancel-deletion:29)
  --   * psql / migrations            → no JWT, uid null → exempt
  if auth.uid() is not null and not is_admin() then

    if old.trusted_commenter is distinct from new.trusted_commenter
       or old.trust_locked   is distinct from new.trust_locked then
      raise exception 'Only admins can change comment-trust flags';
    end if;

    -- NOTE: `account_status` and `suspended_until` are deliberately NOT listed
    -- here. Migration 061's `prevent_account_status_self_change` trigger
    -- already owns them, including the whitelist that lets a user drive their
    -- own deletion flow (active ↔ pending_deletion). Repeating those columns
    -- here would put one rule in two triggers that can silently diverge —
    -- which is the failure mode this whole audit keeps finding. One column,
    -- one owner:
    --     061 profiles_account_status_guard → account_status, suspended_until
    --     150 profiles_role_guard           → role + the columns below
    if old.deletion_requested_at is distinct from new.deletion_requested_at
       or old.moderation_reason   is distinct from new.moderation_reason
       or old.moderation_note     is distinct from new.moderation_note
       or old.moderation_action_at is distinct from new.moderation_action_at
       or old.moderation_action_by is distinct from new.moderation_action_by then
      raise exception 'Only admins can change account moderation state';
    end if;

  end if;

  return new;
end;
$$;

-- Trigger definition is unchanged (007) — recreated only to be explicit that it
-- still points at the extended function. Name is load-bearing: the pgTAP suite
-- disables it by name.
drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard
  before update on profiles
  for each row execute function prevent_role_escalation();

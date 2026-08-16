-- ════════════════════════════════════════════════════════════════════════════
-- RLS DOCTRINE — pgTAP regression suite (audit C2)
-- ════════════════════════════════════════════════════════════════════════════
-- Encodes the project's "admin is moderation-only" RLS doctrine as executable
-- tests (see CLAUDE.md → RLS doctrine, migrations 106–108, and the
-- project_admin_moderation_only_rls memory). The invariant that keeps leaking
-- and is expensive to catch by eye:
--
--   * PRIVATE user-owned data (family, DMs, AI chat, voice, notifications) must
--     carry NO is_admin() override — the admin account must NOT be able to read
--     another user's rows. Legit admin/cron access goes through the service-role
--     client (bypasses RLS, auditable), never through an in-policy override.
--   * PUBLIC content (reviews, products) IS readable by anon, and the admin
--     override there is correct (admin sees drafts for moderation).
--   * Owner-only WRITE scoping: user_id = auth.uid() enforced by WITH CHECK.
--   * PUBLIC content must be gated on BOTH `status = 'approved'` AND
--     `is_visible = true`. Soft-hiding is a real moderation action (migration
--     004) and it has to hold against a direct anon-key query, not just in the
--     app's own filters. The reviews/guides policies missed `is_visible` from
--     001/003 until migration 149 — audit finding #9.
--
-- Mechanics: seed as the postgres superuser (bypasses RLS), then SET ROLE to
-- authenticated/anon and set request.jwt.claims so auth.uid()/is_admin()
-- resolve exactly as they do for a real request. Everything runs in one
-- transaction that ROLLBACKs — no residue in the local DB.

begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

-- The Supabase platform grants coarse DML on public tables to anon/authenticated
-- and relies on RLS for row-level filtering. A bare `supabase start` doesn't
-- reproduce that grant, so establish it here (test-scoped, rolled back) — RLS,
-- which sits BEHIND this grant, is what these assertions actually exercise.
-- ── Migration 150's column privileges, read from the catalog ────────────────
-- These two run FIRST, before the blanket grant below rewrites the privilege
-- state. They assert what the migrations actually produced, so adding a column
-- to `profiles` without deciding its exposure fails here.
select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'authenticated' and privilege_type = 'SELECT'
      and column_name in ('moderation_note', 'moderation_reason', 'moderation_action_at',
                          'moderation_action_by', 'trusted_commenter', 'trust_locked')),
  0,
  'mig 150: authenticated holds NO SELECT privilege on any moderation column'
);
select is(
  (select count(*)::int from information_schema.column_privileges
    where table_schema = 'public' and table_name = 'profiles'
      and grantee = 'anon' and privilege_type = 'SELECT'),
  8,
  'mig 150: anon holds SELECT on exactly the 8 public identity columns'
);

grant select, insert, update, delete on all tables in schema public to anon, authenticated;

-- ⚠️ That blanket grant re-establishes TABLE-level SELECT on every table —
-- including `profiles`, whose only defence after migration 150 is COLUMN-level
-- privileges. Left as-is it silently masks any column-privilege regression.
--
-- It has to be undone, and a table-level REVOKE also destroys column-level
-- grants (verified: Postgres treats `REVOKE SELECT ON t` as revoking every
-- SELECT privilege on t, column grants included), so 150's grants must be
-- restated below. That makes the *behavioural* assertions further down a test
-- of this restatement rather than of the migration — which is why the two
-- assertions ABOVE read the real privilege state first, before anything here
-- has touched it. Keep the restatement in sync with migration 150.
revoke select on profiles from anon, authenticated;
grant select (
  id, username, display_name, avatar_url, bio, tagline, role, created_at
) on profiles to anon;
grant select (
  id, username, display_name, avatar_url, bio, tagline, role, created_at,
  account_status, suspended_until, deletion_requested_at,
  email_new_message, connection_requests_from, discoverable_by_email
) on profiles to authenticated;

-- ── Seed (as postgres / superuser — RLS does not apply) ─────────────────────
-- Inserting into auth.users fires handle_new_user(), which creates the matching
-- profiles row. Promoting one to admin trips profiles_role_guard, so disable
-- that trigger for the seed only (rolled back with everything else).
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@test.dev'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@test.dev'),
  ('dddddddd-0000-0000-0000-000000000003', 'admin@test.dev');

alter table profiles disable trigger profiles_role_guard;
update profiles set role = 'admin' where id = 'dddddddd-0000-0000-0000-000000000003';
-- Re-enable immediately. The guard also blocks self-writes to moderation state
-- (migration 150 / audit #7) and the assertions below depend on it firing —
-- leaving it disabled past the seed silently turns those into no-ops.
alter table profiles enable trigger profiles_role_guard;

-- Private data, all owned by user A
insert into kid_profiles (user_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Kid A');
insert into voice_phrases (user_id, text) values ('aaaaaaaa-0000-0000-0000-000000000001', 'A phrase');
insert into notifications (user_id, type, title) values ('aaaaaaaa-0000-0000-0000-000000000001', 'system', 'Hi A');
insert into boss_conversations (id, user_id) values
  ('cccccccc-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into boss_messages (conversation_id, user_id, role, content) values
  ('cccccccc-0000-0000-0000-000000000010', 'aaaaaaaa-0000-0000-0000-000000000001', 'user', 'secret');

-- Public content
insert into products (slug, name, status) values ('test-prod', 'Test Product', 'reviewed');
insert into reviews (author_id, slug, title, content, product_name, category, status, is_visible) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'appr', 'Approved',     'body', 'P', 'tools-diy', 'approved', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'draf', 'Draft',        'body', 'P', 'tools-diy', 'draft',    true),
  -- Approved but soft-hidden: live content withdrawn without re-moderation.
  ('aaaaaaaa-0000-0000-0000-000000000001', 'hidn', 'Hidden',       'body', 'P', 'tools-diy', 'approved', false);

-- Guides get the same treatment. `gapp` proves migration 149 did not
-- over-restrict (visible content still reaches anon); `ghid` proves it works.
insert into guides (author_id, slug, title, content, category, status, is_visible) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'gapp', 'Guide Approved', 'body', 'tools-diy', 'approved', true),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ghid', 'Guide Hidden',   'body', 'tools-diy', 'approved', false);

-- ── As user A (owner) ───────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::int from kid_profiles),  1, 'owner A reads own kid_profiles');
select is((select count(*)::int from voice_phrases), 1, 'owner A reads own voice_phrases');
select is((select count(*)::int from boss_messages), 1, 'owner A reads own boss_messages');
select is((select count(*)::int from notifications), 1, 'owner A reads own notifications');

-- Hiding must not lock the author out of their own withdrawn work — that is
-- what makes it a reversible moderation action rather than a delete.
select is((select count(*)::int from reviews where slug = 'hidn'), 1, 'author CAN still read their own hidden review');

-- ── profiles column privileges + moderation write guard (migration 150) ─────
-- Audit #2: moderation state is not readable by any web role, not even the
-- subject's own session. Audit #7: nor writable by them.
select throws_ok(
  $$ select trusted_commenter from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'authenticated CANNOT select trusted_commenter, even on their own row (column privilege)'
);
select throws_ok(
  $$ select moderation_note from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '42501',
  null,
  'authenticated CANNOT select moderation_note (column privilege)'
);
-- #7: the one-request comment-moderation bypass.
select throws_ok(
  $$ update profiles set trusted_commenter = true where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'P0001',
  'Only admins can change comment-trust flags',
  'member CANNOT self-grant trusted_commenter (write guard blocks the moderation bypass)'
);
-- The other branch of 150's guard: admin-authored moderation state.
-- NOTE: the value must actually DIFFER — the guard compares OLD to NEW, so
-- writing back a value the row already holds is correctly a no-op.
select throws_ok(
  $$ update profiles set moderation_note = 'self-authored' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'P0001',
  'Only admins can change account moderation state',
  'member CANNOT write their own moderation_note'
);
-- Self-unban. Enforced by migration 061's separate `profiles_account_status_guard`,
-- not by 150 — asserted here because what matters is the behaviour, not which
-- trigger delivers it. If 061 is ever refactored, this fails loudly.
select throws_ok(
  $$ update profiles set account_status = 'suspended' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'P0001',
  'Only admins can change account_status from active to suspended',
  'member CANNOT change their own account_status (guard from migration 061)'
);
-- The control: ordinary self-service edits must still work.
select lives_ok(
  $$ update profiles set bio = 'new bio', email_new_message = false where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'member CAN still update their own bio and notification prefs'
);

-- ── As admin (moderation-only) ──────────────────────────────────────────────
set local request.jwt.claims to '{"sub":"dddddddd-0000-0000-0000-000000000003","role":"authenticated"}';

select ok(public.is_admin(), 'admin profile resolves is_admin() = true');

-- The core regression: admin has NO override on private user data.
select is((select count(*)::int from kid_profiles),  0, 'admin CANNOT read another user''s kid_profiles');
select is((select count(*)::int from voice_phrases), 0, 'admin CANNOT read another user''s voice_phrases');
select is((select count(*)::int from boss_messages), 0, 'admin CANNOT read another user''s boss_messages (AI chat)');
select is((select count(*)::int from notifications), 0, 'admin CANNOT read another user''s notifications');

-- The other half of the doctrine: admin override on PUBLIC content is correct —
-- admin sees all reviews (approved + draft) for moderation.
select is((select count(*)::int from reviews where slug in ('appr','draf')), 2, 'admin reads ALL reviews incl. drafts (public-content override is correct)');

-- Same override covers hidden rows: an admin must be able to see what they
-- withdrew in order to put it back.
select is((select count(*)::int from reviews where slug = 'hidn'), 1, 'admin CAN read a hidden review (moderation override)');

-- ── As user B (a different regular user) ────────────────────────────────────
set local request.jwt.claims to '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';

select is((select count(*)::int from kid_profiles), 0, 'user B CANNOT read user A''s kid_profiles (owner isolation)');

-- Owner-only WRITE: B cannot create a row owned by A (WITH CHECK), but A can.
select throws_ok(
  $$ insert into kid_profiles (user_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'forged') $$,
  '42501',
  null,
  'user B CANNOT insert a kid_profile owned by user A (WITH CHECK blocks it)'
);

set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ insert into kid_profiles (user_id, name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Kid A2') $$,
  'owner A CAN insert their own kid_profile'
);

-- ── As anon (logged-out visitor) ────────────────────────────────────────────
reset role;
set local role anon;
set local request.jwt.claims to '';

select is((select count(*)::int from products where slug = 'test-prod'), 1, 'anon reads public products');
select is((select count(*)::int from reviews where slug in ('appr','draf')), 1, 'anon reads ONLY approved reviews (draft stays hidden)');
select is((select count(*)::int from kid_profiles), 0, 'anon CANNOT read private kid_profiles');

-- Audit finding #9 / migration 149. Approved is not sufficient — the row must
-- also be visible. Before 149 these two returned 1: the app filtered
-- `is_visible` at every call site, but the anon key did not have to.
select is((select count(*)::int from reviews where slug = 'hidn'), 0, 'anon CANNOT read an approved-but-hidden review (is_visible enforced by RLS)');
select is((select count(*)::int from guides  where slug = 'ghid'), 0, 'anon CANNOT read an approved-but-hidden guide (is_visible enforced by RLS)');
-- The control: 149 must not have over-restricted the guides policy.
select is((select count(*)::int from guides  where slug = 'gapp'), 1, 'anon still reads an approved + visible guide');

-- ── Done ────────────────────────────────────────────────────────────────────
reset role;
select * from finish();
rollback;

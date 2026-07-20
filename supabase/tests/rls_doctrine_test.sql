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
--
-- Mechanics: seed as the postgres superuser (bypasses RLS), then SET ROLE to
-- authenticated/anon and set request.jwt.claims so auth.uid()/is_admin()
-- resolve exactly as they do for a real request. Everything runs in one
-- transaction that ROLLBACKs — no residue in the local DB.

begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- The Supabase platform grants coarse DML on public tables to anon/authenticated
-- and relies on RLS for row-level filtering. A bare `supabase start` doesn't
-- reproduce that grant, so establish it here (test-scoped, rolled back) — RLS,
-- which sits BEHIND this grant, is what these assertions actually exercise.
grant select, insert, update, delete on all tables in schema public to anon, authenticated;

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
insert into reviews (author_id, slug, title, content, product_name, category, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'appr', 'Approved', 'body', 'P', 'tools-diy', 'approved'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'draf', 'Draft',    'body', 'P', 'tools-diy', 'draft');

-- ── As user A (owner) ───────────────────────────────────────────────────────
set local role authenticated;
set local request.jwt.claims to '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}';

select is((select count(*)::int from kid_profiles),  1, 'owner A reads own kid_profiles');
select is((select count(*)::int from voice_phrases), 1, 'owner A reads own voice_phrases');
select is((select count(*)::int from boss_messages), 1, 'owner A reads own boss_messages');
select is((select count(*)::int from notifications), 1, 'owner A reads own notifications');

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

-- ── Done ────────────────────────────────────────────────────────────────────
reset role;
select * from finish();
rollback;

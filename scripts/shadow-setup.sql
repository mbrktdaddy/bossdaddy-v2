-- Minimal Supabase environment stubs for shadow-DB migration replay in CI.
--
-- Used by .github/workflows/check-migrations.yml to set up a fresh Postgres
-- instance with just enough of the Supabase surface for our migrations to
-- parse and execute. NEVER applied to production.
--
-- If a new migration starts referencing a Supabase symbol not stubbed here,
-- add the minimal stub below — do not pull in the full Supabase auth/storage
-- schemas. The goal is a fast structural sanity check, not a full Supabase
-- replica.

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- ── Supabase pre-defined roles ───────────────────────────────────────────────
-- RLS policies use `to anon, authenticated`. Vanilla Postgres has neither.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon')           then create role anon nologin;           end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated')  then create role authenticated nologin;  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role')   then create role service_role nologin;   end if;
end $$;

-- ── auth schema ──────────────────────────────────────────────────────────────
create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  raw_user_meta_data  jsonb default '{}'::jsonb,
  created_at          timestamptz default now()
);

-- auth.uid() reads from the JWT in real Supabase. In the shadow DB we have no
-- session, so it returns NULL — RLS policies that gate on auth.uid() will
-- evaluate to false, which is fine for structural validation.
create or replace function auth.uid()
returns uuid language sql stable as $$ select null::uuid $$;

-- auth.role() — used by storage.* policies (035, 037).
create or replace function auth.role()
returns text language sql stable as $$ select null::text $$;

-- ── storage schema ──────────────────────────────────────────────────────────
-- Migrations 035 and 037 INSERT into storage.buckets and create policies on
-- storage.objects. Stub both tables so the policy DDL parses.
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets(id),
  name             text,
  owner            uuid,
  metadata         jsonb,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  last_accessed_at timestamptz default now()
);

alter table storage.objects enable row level security;

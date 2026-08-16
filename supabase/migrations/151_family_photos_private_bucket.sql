-- ─────────────────────────────────────────────────────────────────────────────
-- Move family-member photos out of the public `avatars` bucket into a private
-- one served through an owner-gated proxy. Audit finding #23 (read together
-- with #3 — they are one story).
--
-- THE PROBLEM
--   `avatars` is `public = true` with `FOR SELECT USING (bucket_id = 'avatars')`
--   (061), i.e. an unconditional anonymous read of everything in it. Profile
--   avatars belong there — they appear on public author pages. Photographs of a
--   member's children do not. They were stored at
--   `avatars/kids/{kid_profile_id}/avatar.webp`: no auth, a stable URL, and
--   readable by anyone who has or guesses it, forever.
--
--   Compounded by #3: the account-deletion cron never touched storage, and the
--   row holding the only reference to the path cascaded away — so a deleted
--   member's child's photo stayed live and anonymously readable while the user
--   received an email saying all associated data had been removed. The cron
--   sweep landed with `lib/account-purge.ts`; this migration removes the
--   exposure itself.
--
-- THE PATTERN
--   Copied verbatim from `dm-media` (094), which got this right: `public=false`
--   so there is no CDN or anonymous path, and DELIBERATELY NO storage.objects
--   policies at all. Uploads go through the service-role client; reads go
--   through a route that re-checks ownership and mints a short-lived signed
--   URL. With no SELECT policy, no client can list or read the bucket directly
--   even with a valid session.
--
-- ON THE NAME
--   `family-photos`, not `kid-photos`, even though the paths are keyed by
--   `kid_profile_id`. The Naming Doctrine freezes EXISTING internal names —
--   `kid_profiles` stays `kid_profiles` forever, and `lib/labels.ts` already
--   renders it as "Family" — but a brand-new artefact gets the right name on
--   day one rather than inheriting a legacy one. The only thing it is
--   inconsistent with is a table name that is itself the legacy term, and a
--   bucket id is not a foreign key.
--
-- EXISTING PHOTOS ARE DELETED, NOT MIGRATED
--   Operator decision: single active user, few files, happy to re-upload. So
--   there is no copy step and no half-migrated state to reason about.
--
--   ⚠️ THIS MIGRATION CANNOT DELETE THE OLD FILES. An earlier draft ran
--   `delete from storage.objects where bucket_id = 'avatars' and name like
--   'kids/%'` and Supabase rejected it:
--
--       ERROR: Direct deletion from storage tables is not allowed.
--              Use the Storage API instead.
--       HINT:  This prevents accidental data loss from orphaned objects.
--              (storage.protect_delete)
--
--   A sensible guardrail — deleting the index row would leave the blob behind,
--   which is the opposite of what a privacy fix wants. Caught by replaying this
--   migration against a local stack before it went anywhere near production.
--
--   ⚠️ MANUAL STEP REQUIRED, and it is the part that actually closes the
--   exposure: delete the `kids/` folder from the `avatars` bucket in the
--   Supabase dashboard (Storage → avatars → kids → delete). Until that is done
--   the old photographs remain publicly readable, regardless of everything
--   below. The `photo_url` drop here only stops the app pointing at them.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Private bucket ────────────────────────────────────────────────────────
-- We only ever store WebP: the upload route re-encodes through sharp, which
-- strips EXIF/GPS — the metadata question matters more here than anywhere else
-- on the site, because these are photographs of children.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-photos', 'family-photos', false, 2097152, array['image/webp'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Deliberately NO storage.objects policies for this bucket. Uploads use the
-- admin client (bypasses RLS); reads use signed URLs minted by an owner-gated
-- route (also bypasses RLS). Adding an "authenticated read" policy here would
-- let any signed-in member read every family's photos — the bucket is not
-- row-scoped, so a policy cannot express ownership. Do not add one.

-- ── 2. Store the path, not a URL ─────────────────────────────────────────────
-- `photo_url` held a fully-qualified public CDN URL, which only worked because
-- the bucket was public. There is no durable URL for a private object — signed
-- ones expire — so the row records the storage path and the app derives a proxy
-- route from it.
alter table kid_profiles
  add column if not exists photo_path text;

comment on column kid_profiles.photo_path is
  'Path within the private `family-photos` bucket, e.g. `{kid_profile_id}/avatar.webp`. Never a URL: private objects have no durable one. Render via GET /api/kids/{id}/photo, which checks ownership and 302s to a short-lived signed URL.';

-- ── 3. Retire the old column ─────────────────────────────────────────────────
-- `photo_url` held a public CDN URL for a file that is being deleted, so every
-- value in it is about to be a dead link. Dropped rather than nulled: two photo
-- columns on one table is the two-sources-of-truth problem that produced half
-- the findings in this audit, and "we'll clean it up later" is how the other
-- half got there. Nothing reads it — the Kid type, KID_COLUMNS, and both CRUD
-- paths in lib/dad-tools/kid-actions.ts were updated in the same change.
--
-- Note `moments.photo_url` is a DIFFERENT column on a different table and is
-- untouched.
alter table kid_profiles
  drop column if exists photo_url;

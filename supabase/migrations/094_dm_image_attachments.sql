-- Migration 094: DM image attachments
--
-- Adds optional image-attachment columns to `messages` plus a PRIVATE
-- `dm-media` storage bucket. Gate is identical to sending text — any active
-- member (is_account_active, migration 083). One image per message, with an
-- optional text caption stored in `body`.
--
-- Privacy model: the bucket is public=false, so there is no anonymous/CDN
-- access and NO storage.objects policy granting direct authenticated reads.
-- The only way to view an attachment is through the participant-gated proxy
-- route /api/dm/attachment/[messageId], which re-checks participation via the
-- existing messages_read RLS policy and then mints a short-lived signed URL.
-- Uploads go through the service-role admin client in /api/dm/upload after a
-- participant + block + active-account check (mirrors sendMessage).

-- ── messages: attachment columns ─────────────────────────────────────────────
alter table messages
  add column if not exists attachment_path   text,
  add column if not exists attachment_width  int,
  add column if not exists attachment_height int;

-- A message must carry text, an image, or both — never empty. Every existing
-- row has a non-empty body, so this is safe to add retroactively.
alter table messages drop constraint if exists messages_body_or_attachment;
alter table messages add constraint messages_body_or_attachment
  check (length(btrim(body)) > 0 or attachment_path is not null);

-- ── private dm-media bucket ──────────────────────────────────────────────────
-- public=false → no CDN/anonymous reads. file_size_limit is a backstop; the
-- real raw-upload ceiling lives in the route (8 MB pre-normalize). We only ever
-- store WebP (server re-encode strips EXIF/GPS), so restrict the mime list.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dm-media', 'dm-media', false, 8388608, array['image/webp'])
on conflict (id) do update
  set public             = false,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Deliberately NO storage.objects policies for dm-media: uploads use the
-- admin client (bypasses RLS) and reads use signed URLs (bypass RLS). With no
-- authenticated SELECT policy, no client can list or read the bucket directly.

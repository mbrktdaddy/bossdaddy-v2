-- Migration 061: Profile avatars bucket + account-status defense-in-depth trigger.
--
-- Two related concerns bundled into one migration:
--   1. Avatars storage bucket so users upload images (instead of pasting arbitrary URLs).
--   2. DB trigger blocking non-admin changes to account_status / suspended_until —
--      defense-in-depth so a future API endpoint (or direct PostgREST access) can't
--      let a member un-suspend or un-ban themselves.
--
-- Self-service deletion transitions are explicitly whitelisted in the trigger so
-- /api/account/delete-request and /api/account/cancel-deletion keep working.

-- ─── 1. avatars storage bucket ───────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public             = EXCLUDED.public;

-- Drop first so this migration is safe to re-run.
DROP POLICY IF EXISTS "avatars public read"           ON storage.objects;
DROP POLICY IF EXISTS "avatars owner upload"          ON storage.objects;
DROP POLICY IF EXISTS "avatars owner update"          ON storage.objects;
DROP POLICY IF EXISTS "avatars owner delete"          ON storage.objects;

-- Public read — avatars appear on public author pages.
CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Owner-only writes. Path convention: `{user_id}/avatar.{ext}`.
-- (storage.foldername(name))[1] returns the first folder of the path; checking
-- it equals auth.uid() prevents any user from writing to another user's folder.
CREATE POLICY "avatars owner upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "avatars owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ─── 2. Defense-in-depth: prevent non-admin moderation-field changes ────────
-- The API's Zod schema already excludes account_status and suspended_until, but
-- this trigger ensures even a future code regression (or direct PostgREST access)
-- can't let a suspended/banned user restore themselves.
--
-- WHITELIST: self-initiated transitions for the account-deletion flow:
--   active → pending_deletion (user requests deletion)
--   pending_deletion → active (user cancels deletion within cooldown)
CREATE OR REPLACE FUNCTION prevent_account_status_self_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF is_admin() THEN
    RETURN NEW;  -- Admins bypass all checks
  END IF;

  -- Block any change to suspended_until by non-admins
  IF NEW.suspended_until IS DISTINCT FROM OLD.suspended_until THEN
    RAISE EXCEPTION 'Only admins can change suspended_until';
  END IF;

  -- Account-status changes: only whitelist self-deletion flow
  IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    IF NOT (
      (OLD.account_status = 'active'            AND NEW.account_status = 'pending_deletion')
      OR (OLD.account_status = 'pending_deletion' AND NEW.account_status = 'active')
    ) THEN
      RAISE EXCEPTION 'Only admins can change account_status from % to %',
        OLD.account_status, NEW.account_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_account_status_guard ON profiles;
CREATE TRIGGER profiles_account_status_guard
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_account_status_self_change();

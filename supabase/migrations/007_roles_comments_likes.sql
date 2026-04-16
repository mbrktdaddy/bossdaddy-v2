-- Migration 007 — Role system, comments, likes
-- Run AFTER 006_view_count_rpc.sql

-- ── 1. Add 'member' role and change default ────────────────────────────────
-- Drop inline check constraint (auto-named by Postgres)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'author', 'member')),
  ALTER COLUMN role SET DEFAULT 'member';

-- Any profile that isn't admin or author becomes member
UPDATE profiles SET role = 'member' WHERE role NOT IN ('admin', 'author');

-- ── 2. is_author_or_admin() helper ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_author_or_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'author')
  );
$$;

-- ── 3. Prevent non-admins from changing their own role ────────────────────
CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role AND NOT is_admin() THEN
    RAISE EXCEPTION 'Only admins can change user roles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_guard ON profiles;
CREATE TRIGGER profiles_role_guard
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_escalation();

-- ── 4. Fix profiles policies ───────────────────────────────────────────────
-- Old "profiles_self" FOR ALL lets users update their own role — replace it
DROP POLICY IF EXISTS "profiles_self" ON profiles;
CREATE POLICY "profiles_self_read"   ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "profiles_self_update" ON profiles FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Admin write access (profiles_admin_read already exists from 002)
DROP POLICY IF EXISTS "profiles_admin_write" ON profiles;
CREATE POLICY "profiles_admin_write" ON profiles FOR UPDATE USING (is_admin());

-- ── 5. Restrict reviews INSERT to author/admin ────────────────────────────
DROP POLICY IF EXISTS "reviews_author_own" ON reviews;

CREATE POLICY "reviews_author_select" ON reviews FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "reviews_author_insert" ON reviews FOR INSERT
  WITH CHECK (author_id = auth.uid() AND is_author_or_admin());
CREATE POLICY "reviews_author_update" ON reviews FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "reviews_author_delete" ON reviews FOR DELETE USING (author_id = auth.uid());

-- ── 6. Restrict articles INSERT to author/admin ───────────────────────────
DROP POLICY IF EXISTS "articles_author_own" ON articles;

CREATE POLICY "articles_author_select" ON articles FOR SELECT USING (author_id = auth.uid());
CREATE POLICY "articles_author_insert" ON articles FOR INSERT
  WITH CHECK (author_id = auth.uid() AND is_author_or_admin());
CREATE POLICY "articles_author_update" ON articles FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "articles_author_delete" ON articles FOR DELETE USING (author_id = auth.uid());

-- ── 7. Comments ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id    UUID REFERENCES profiles ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('review', 'article')),
  content_id   UUID NOT NULL,
  body         TEXT NOT NULL CHECK (length(body) >= 5 AND length(body) <= 2000),
  status       TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_content_idx ON comments (content_type, content_id, status);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Approved comments are public; authors can see their own regardless of status
CREATE POLICY "comments_read" ON comments FOR SELECT
  USING (status = 'approved' OR author_id = auth.uid());
-- Any authenticated user can post (lands in pending)
CREATE POLICY "comments_insert" ON comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND author_id = auth.uid());
-- Users can delete their own non-approved comments
CREATE POLICY "comments_delete_own" ON comments FOR DELETE
  USING (author_id = auth.uid() AND status != 'approved');
-- Admin full access
CREATE POLICY "comments_admin" ON comments FOR ALL USING (is_admin());

CREATE OR REPLACE TRIGGER comments_updated_at
  BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── 8. Likes ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS likes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES profiles ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('review', 'article')),
  content_id   UUID NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, content_type, content_id)
);

CREATE INDEX IF NOT EXISTS likes_content_idx ON likes (content_type, content_id);

ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "likes_public_read" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert"      ON likes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "likes_delete_own"  ON likes FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "likes_admin"       ON likes FOR ALL USING (is_admin());

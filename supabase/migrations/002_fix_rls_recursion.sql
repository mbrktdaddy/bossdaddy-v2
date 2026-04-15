-- Fix infinite recursion in RLS policies.
-- Root cause: policies on `profiles` and `reviews` queried `profiles` directly,
-- which re-triggered the profiles RLS policy → infinite loop.
-- Fix: security definer function `is_admin()` bypasses RLS when checking role.

-- ── 1. Create security definer helper ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ── 2. Fix profiles policies ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_admin_read" ON profiles;

CREATE POLICY "profiles_admin_read" ON profiles FOR SELECT
  USING (is_admin());

-- ── 3. Fix reviews policies ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "reviews_admin_all" ON reviews;

CREATE POLICY "reviews_admin_all" ON reviews FOR ALL
  USING (is_admin());

-- ── 4. Fix affiliate_links policies ──────────────────────────────────────────
DROP POLICY IF EXISTS "affiliate_links_admin" ON affiliate_links;

CREATE POLICY "affiliate_links_admin" ON affiliate_links FOR ALL
  USING (is_admin());

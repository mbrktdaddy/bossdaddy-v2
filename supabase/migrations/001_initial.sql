-- Boss Daddy v2 — Initial Schema + RLS
-- Run via: supabase db push  OR  paste into Supabase SQL Editor

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Extends auth.users. Created automatically via trigger on sign-up.
CREATE TABLE IF NOT EXISTS profiles (
  id      UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role    TEXT NOT NULL DEFAULT 'author' CHECK (role IN ('author', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self" ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "profiles_admin_read" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Auto-create profile on new user sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── reviews ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID REFERENCES profiles ON DELETE CASCADE NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,                -- sanitized HTML
  product_name TEXT NOT NULL,
  rating      SMALLINT CHECK (rating BETWEEN 1 AND 5),
  has_affiliate_links    BOOLEAN DEFAULT FALSE,
  disclosure_acknowledged BOOLEAN DEFAULT FALSE,
  status      TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  moderation_score NUMERIC(3,2),            -- Claude score 0.00–1.00
  moderation_flags JSONB DEFAULT '[]'::jsonb,
  sanity_id   TEXT,                         -- Sanity document _id after sync
  published_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Authors see and manage their own reviews (all statuses)
CREATE POLICY "reviews_author_own" ON reviews FOR ALL
  USING (author_id = auth.uid());

-- Admins see and manage all reviews
CREATE POLICY "reviews_admin_all" ON reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Public reads only approved reviews (no auth needed)
CREATE POLICY "reviews_public_approved" ON reviews FOR SELECT
  USING (status = 'approved');

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ── affiliate_links ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS affiliate_links (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES reviews ON DELETE CASCADE NOT NULL,
  url       TEXT NOT NULL,
  network   TEXT,                            -- 'amazon' | 'clickbank' | 'shareasale' etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE affiliate_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "affiliate_links_author" ON affiliate_links FOR ALL
  USING (EXISTS (SELECT 1 FROM reviews r WHERE r.id = review_id AND r.author_id = auth.uid()));

CREATE POLICY "affiliate_links_admin" ON affiliate_links FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

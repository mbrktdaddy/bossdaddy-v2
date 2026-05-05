CREATE TABLE press_outreach (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      UUID        REFERENCES products(id) ON DELETE SET NULL,
  product_name    TEXT        NOT NULL,
  brand_name      TEXT        NOT NULL,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_method  TEXT        NOT NULL DEFAULT 'email'
                              CHECK (contact_method IN ('email', 'web_form', 'amazon', 'phone')),
  contact_url     TEXT,
  subject         TEXT,
  body            TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'sent'
                              CHECK (status IN ('draft', 'sent', 'responded', 'no_response', 'follow_up')),
  notes           TEXT,
  sent_at         TIMESTAMPTZ,
  responded_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE press_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to press_outreach"
  ON press_outreach FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Content blocks for reviews: TL;DR, key takeaways, best-for, not-for, FAQs
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS tldr          TEXT,
  ADD COLUMN IF NOT EXISTS key_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS best_for      JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS not_for       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faqs          JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Same blocks for guides (tldr + takeaways + faqs; best-for/not-for less applicable)
ALTER TABLE guides
  ADD COLUMN IF NOT EXISTS tldr          TEXT,
  ADD COLUMN IF NOT EXISTS key_takeaways JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS faqs          JSONB NOT NULL DEFAULT '[]'::jsonb;

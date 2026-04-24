-- Canonical primary product for a review.
--
-- Before this migration, the only way to surface an Amazon CTA in a review
-- was to paste a [[BUY:slug]] token into the content body, which the save-time
-- resolver would expand into an inline <a> tag. That worked for mid-paragraph
-- mentions but produced no distinct product card — the resolved anchor ended
-- up visually indistinguishable from internal navigation links and landed
-- wherever the editor happened to drop the token (often at the bottom).
--
-- With product_slug on the review row, the public review page can render a
-- dedicated ProductCtaCard (thumbnail + name + rating + styled CTA button) in
-- canonical positions (post-pros/cons, end-of-body). Inline [[BUY:slug]]
-- tokens remain valid for natural mid-article mentions, but the primary
-- conversion surface is now this structured field.
--
-- Nullable intentionally — editorial articles and non-product reviews have
-- no canonical product. FK is not enforced so historical rows with products
-- that later get deleted from the registry still render gracefully.
-- ────────────────────────────────────────────────────────────────────────

alter table reviews
  add column if not exists product_slug text;

create index if not exists idx_reviews_product_slug on reviews (product_slug);

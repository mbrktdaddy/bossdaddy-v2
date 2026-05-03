-- Allow public (unauthenticated) reads on the products table.
--
-- Products are referenced by every review's CTA card, which renders on
-- public review pages visited by logged-out users (mobile and desktop).
-- The original 016_products.sql restricted SELECT to `authenticated`,
-- which silently broke the CTA card for every unauthenticated visitor —
-- the server-side `getProductBySlug` lookup returned null, so the card
-- was omitted from the rendered HTML.
--
-- Products contain no sensitive data — name, slug, image, store, public
-- affiliate URL — all of which are intended to be displayed publicly.
-- Writes remain restricted to admins via the existing `products_admin_write`
-- policy, which this migration leaves untouched.

drop policy if exists "products_authenticated_read" on products;

create policy "products_public_read"
  on products for select
  to anon, authenticated
  using (true);

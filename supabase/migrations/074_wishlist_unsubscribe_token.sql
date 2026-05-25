-- Add a per-row unsubscribe token to wishlist_subscriptions so subscribers can
-- opt out via a one-click link in notification emails without logging in.
-- The token is generated at row-creation time and never changes.

alter table wishlist_subscriptions
  add column if not exists unsubscribe_token uuid not null default gen_random_uuid();

-- Unique index for the token lookup on the unsubscribe route.
create unique index if not exists idx_wishlist_subs_unsubscribe_token
  on wishlist_subscriptions (unsubscribe_token);

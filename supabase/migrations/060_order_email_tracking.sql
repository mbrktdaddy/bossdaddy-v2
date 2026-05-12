-- Migration 060: Order confirmation email tracking.
-- Adds visibility + retry surface for transactional emails sent from the Stripe webhook.
--
-- Background: the webhook calls Resend inline and any failure (rate limit, unverified
-- sender, transient Resend outage) was previously invisible — the order was created
-- but the customer never received their confirmation. These columns let:
--   • the admin orders page show which orders have a delivery problem,
--   • a nightly cron retry unsent emails for up to 5 attempts.

alter table orders
  add column if not exists confirmation_email_sent_at  timestamptz,
  add column if not exists confirmation_email_error    text,
  add column if not exists confirmation_email_attempts int not null default 0;

-- Partial index covers the exact cron query shape: "orders that still need an email,
-- newest first." Partial keeps the index tiny — once an order is sent, its row leaves
-- the index entirely.
create index if not exists idx_orders_email_retry
  on orders (created_at desc)
  where confirmation_email_sent_at is null;

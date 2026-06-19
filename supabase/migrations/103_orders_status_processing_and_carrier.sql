-- ─────────────────────────────────────────────────────────────────────────────
-- 103 — Orders: add 'processing'/'failed'/'on_hold' statuses + carrier column
--
-- Fixes two schema/code mismatches that silently broke Printful fulfillment for
-- EVERY order:
--
--   1. After creating the Printful order, the Stripe webhook updates the order
--      to status 'processing' (and persists printful_order_id in the same
--      statement). But 'processing' was never in the CHECK constraint, so the
--      UPDATE threw a constraint violation — swallowed by the handler's catch —
--      leaving the order stuck at 'paid' with a NULL printful_order_id. The
--      package_shipped webhook then couldn't match the order, so it never
--      reached 'shipped' and no tracking email went out.
--      We add 'processing' plus 'failed'/'on_hold' for the Printful
--      order-lifecycle states the webhook will surface going forward.
--
--   2. The package_shipped webhook writes a `carrier` column that did not
--      exist on the orders table. PostgREST rejects unknown columns, so the
--      handler 500'd on every shipment (and Printful retried in a loop).
--
-- No new table → no RLS changes needed; this only alters the existing orders
-- table's status CHECK and adds one nullable column.
-- ─────────────────────────────────────────────────────────────────────────────

alter table orders drop constraint if exists orders_status_check;
alter table orders add constraint orders_status_check check (status in (
  'pending', 'paid', 'processing', 'fulfilled', 'shipped',
  'delivered', 'cancelled', 'refunded', 'failed', 'on_hold'
));

alter table orders add column if not exists carrier text;

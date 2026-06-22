-- Tighten orders / order_items — remove standing admin session access.
--
-- Deferred from migration 107. Orders hold shipping address, email, and
-- payment metadata. They were left with `is_admin()` because the merchant
-- legitimately needs them for fulfillment/refunds/support — but an audit of
-- app code confirms EVERY order read AND write already goes through the
-- service-role admin client (createAdminClient), which bypasses RLS:
--   * app/(dashboard)/dashboard/admin/orders/page.tsx   (admin order list)
--   * app/(public)/order/[id]/page.tsx                  (order confirmation)
--   * app/api/cron/retry-order-emails/route.ts
--   * app/api/webhooks/stripe/route.ts                  (insert + updates)
--   * app/api/webhooks/printful/route.ts                (status updates)
--
-- So nothing relies on the policy-level `is_admin()` override. We:
--   1. Scope the owner-read policies to the owner only (defense-in-depth for
--      any future client-side read; the app uses service role today).
--   2. DROP the admin-write policies entirely — orders are mutated only by
--      webhooks/crons via service role, never an authenticated session. With
--      no write policy, authenticated users (admin included) cannot write
--      orders through their session; service role still can (bypasses RLS).
--
-- Result: orders/order_items are now consistent with the moderation-only
-- admin doctrine — no silent admin access to customer PII via the app session.

-- ── orders ──────────────────────────────────────────────────────────────────
drop policy if exists "orders_self_read" on orders;
create policy "orders_self_read"
  on orders for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "orders_admin_write" on orders;

-- ── order_items ───────────────────────────────────────────────────────────────
drop policy if exists "order_items_read" on order_items;
create policy "order_items_read"
  on order_items for select
  to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = order_id
        and o.user_id = auth.uid()
    )
  );

drop policy if exists "order_items_admin_write" on order_items;

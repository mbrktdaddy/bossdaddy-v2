-- ─────────────────────────────────────────────────────────────────────────────
-- 102 — Product spine, part 3: drop the old wishlist_items table.
--
-- APPLY LAST — only after 100 + 101 are applied AND the app is verified reading
-- the products spine (every former wishlist_items reader repointed). This is the
-- irreversible step. `wishlist_votes` and `wishlist_subscriptions` are KEPT — they
-- now reference products(id) (repointed in 101).
--
-- get_wishlist_item_status(uuid) is unchanged: it reads only wishlist_votes /
-- wishlist_subscriptions by item id (= products.id now), not wishlist_items.
-- ─────────────────────────────────────────────────────────────────────────────

drop trigger if exists trg_wishlist_items_updated_at on wishlist_items;
drop table if exists wishlist_items;

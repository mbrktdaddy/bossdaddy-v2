# The Boss — Gear Provenance & Spine Architecture (Ground-Up Fix)

> **Status:** PLANNED — not started. Write-up for a future session.
> **Created:** 2026-06-18
> **Author of decision:** operator + Claude (architecture discussion)
> **Scope:** structural. Touches the products/bench data model, the Boss research
> feature, `/go`, and every public surface that reads the bench.
> **Precondition that makes this cheap:** no users yet, very few rows. We do the
> *true* fix now — one clean cut — not an incremental ship-then-refactor sequence.

---

## 1. The problem (symptom → root cause)

**Symptom the operator caught:** Asking The Boss for gear we haven't tested (e.g.
"best Samsung Galaxy earbuds") runs a web search, and the returned products get
auto-written into the **canonical product catalog** *and* the **public homepage
"On the Bench" reel** — untested, uncurated, never deliberately surfaced.

**Root cause — three fused mistakes, all structural:**

1. **Two tables model one entity.** `products` (mig 046) and `wishlist_items`
   (mig 030, older) both carry `slug`, `title/name`, `affiliate_url`, `store`,
   **and a `status`**. One piece of gear therefore has *two* status fields that
   drift. The vocabularies don't even match:
   - `products.status`: `wishlist | testing | reviewed | passed | archived` (+ `researched`, mig 096)
   - `wishlist_items.status`: `considering | queued | testing | reviewed | skipped`
2. **Provenance is smuggled into status.** `'researched'` is really a
   *provenance/freshness* fact ("AI found it, untested"), encoded as a lifecycle
   status on one table while the bench row borrows a *different, public* status
   (`considering`).
3. **Public surfaces blacklist instead of whitelist, and derived data is
   auto-promoted into canonical+public state with no gate.** `seedCatalog()`
   (`lib/boss/tools/research_gear.ts:166–220`) writes a `products` row *and* a
   `wishlist_items` row (`status:'considering'`) on every research hit. The
   homepage reel then shows `status IN ('testing','queued','considering')`.

This accreted — `wishlist_items` predated `products`, and the AI feature bolted
seeding on top of two already-redundant tables. It was never designed.

---

## 2. Decision (the target architecture)

Adopt the **convergent industry pattern** for derived-vs-canonical data
(editorial firewall / PIM draft-publish / CRM lead-to-account / RAG caching):

> **A hard boundary between a disposable candidate zone and a canonical,
> earned-entry spine — with public surfaces reading only the spine, and a single
> deliberate "adopt" action as the only bridge across the boundary.**

**Chosen fork: candidates live OUTSIDE the catalog (Fork B).** Reasons:
- Keeps the catalog a curated artifact — the invariant *"every row in `products`
  is real Boss Daddy gear"* is unconditionally true. For an editorial brand whose
  whole promise is "I actually tested this," that invariant is worth more than the
  minor simplicity of a single table.
- Candidates are one-off per-query junk; keeping them out avoids slug-namespace
  collisions and table/index bloat in the spine.
- **Surfacing safety becomes free:** once researched gear is never in `products`,
  no public surface can leak it — no quarantine flag, no whitelist gymnastics
  required. The separation *is* the guarantee.

(Fork A — candidates as `status='researched'` drafts inside a unified `products`
table — is legitimate and slightly simpler operationally, but trades away the
clean invariant. Rejected. Documented here so we don't relitigate.)

---

## 3. Target data model — 3 stores + 1 bridge

```
┌─────────────────────┐     adopt (deliberate)    ┌──────────────────────────┐
│  gear_candidates    │ ────────────────────────▶ │  products  (THE SPINE)   │
│  (candidate zone)   │                            │  one entity, one status, │
│  AI-found, never    │                            │  one source. Earned entry│
│  public, prunable   │                            │  Public surfaces read     │
└─────────────────────┘                            │  ONLY this table.        │
        ▲                                          └──────────────────────────┘
        │ writes candidates                          ▲ bench = early states
┌───────┴───────────┐                                │ (considering/queued/testing)
│ research_gear tool │──┐                             │ reviewed/passed = late
└───────────────────┘  │ logs demand                  │
                       ▼                              │
        ┌──────────────────────────┐    ┌────────────┴───────────┐
        │ boss_research_cache (keep)│    │ gap/demand log (keep)  │
        │ query_key → payload, perf │    │ "most-requested        │
        │ cache only                │    │  untested" roadmap     │
        └──────────────────────────┘    └────────────────────────┘
```

### 3.1 `products` — the unified gear spine
- **Fold `wishlist_items` INTO `products`.** One row per piece of gear. `products`
  is the survivor (it's the "spine" name; reviews/collections already reference it).
- **One `status` lifecycle** (finalize names at implementation; proposed):
  `considering` → `queued` → `testing` → `reviewed` → `passed` (`archived` only if
  we want a hard-hide distinct from `passed`). Reconciles the two old vocabularies
  (`wishlist` ≡ `considering`; `skipped`/`passed`/`archived` collapse to `passed`).
  **`researched` is NOT a spine status** — researched gear is not in this table.
- **One `source`** column (provenance, orthogonal to status):
  `hand | pa_api | adopted_from_research`.
- Absorbs bench-only columns/behavior: `priority`, `review_id`, `gallery_images`
  (mig 093), follow-up review fields (mig 069), votes & subscriptions (via FK
  repoint, see §5.D).
- **RLS:** public read `to anon, authenticated`; write `is_admin()` (per the RLS
  doctrine in CLAUDE.md). Confirm `products` already follows this.

### 3.2 `gear_candidates` — the candidate zone (NEW)
- Per-product researched entities. Columns: `id`, `slug` (unique), `name`,
  `brand`, `category`, `affiliate_url`, `store`, `source` (`'boss_research'`),
  `request_count` (dedupe + demand), `citations jsonb`, `created_at`,
  `last_seen_at`.
- **Never public.** RLS admin-only (server/admin-client writes, like
  `boss_research_cache`).
- `/go` resolves against this as the fallback (so tracked links work pre-adoption
  without a spine row — see §5.C).
- Prunable (TTL sweep) — it's derived data.

### 3.3 `boss_research_cache` — keep as-is
- Query-keyed perf cache (migs 097/098). Its `payload.candidates` reference
  candidate slugs. Job unchanged: avoid re-running `web_search` for repeat queries.
- Distinction to preserve: **cache = per-query**, **gear_candidates = per-product**.

### 3.4 Gap / demand log — keep
- `research_gear`'s `logRoadmap()` (`lib/boss/tools/research_gear.ts:222+`) already
  logs the gap query. This is the genuinely valuable byproduct (editorial demand
  signal). Confirm it writes to its own table and is admin-surfaced; do not route
  demand through the catalog.

### 3.5 The bridge — "adopt"
- One deliberate admin action: candidate → new `products` row with
  `status='considering'`, `source='adopted_from_research'`, carrying over
  name/brand/affiliate/citations.
- **Naming collision to avoid:** `app/api/wishlist/[id]/promote/route.ts` already
  uses "promote" to mean *link a review and set `status='reviewed'`*. Do **not**
  reuse "promote." Name the new action **`adopt`** (`/api/gear-candidates/[id]/adopt`).

---

## 4. Why this matches how real sites work (recap, for the record)
- **Editorial (Wirecutter/RTINGS/Consumer Reports):** internal research DB is
  private; published = vetted. Editorial firewall = our adopt gate.
- **E-commerce/PIM (Amazon/Shopify):** feeds auto-create *draft* SKUs; nothing is
  shopper-visible until explicitly published.
- **Recsys:** recommendations are ephemeral/query-scoped, never promoted to
  canonical entities.
- **RAG (Perplexity):** web results cached as derived data, not elevated to
  first-class objects — exactly our `boss_research_cache`.
- **CRM:** AI-researched gear = inbound *lead*; becomes an account only on
  conversion. Adopt = conversion.

Our only atypical practice was auto-promoting derived data into canonical+public
state. Everything else (caching, tracked links, demand logging) is normal.

---

## 5. Implementation plan (task groups)

> Order within the refactor matters even though this is "the true fix, not a
> phased ship." Suggested sequence: A → B → C → D → E → F → G.

### A. Schema migrations (start from `supabase/migrations/_TEMPLATE.sql`; next # = `099`)
- [ ] `099_gear_candidates.sql` — create candidate zone table + admin RLS + slug unique + recency index.
- [ ] `100_products_spine.sql` — add to `products`: `source`, `priority`,
      `review_id`, `gallery_images`, follow-up review columns; reconcile/extend the
      `status` CHECK to the unified enum; backfill existing `products` rows'
      `source='hand'`.
- [ ] `101_repoint_bench_fks.sql` — repoint `wishlist_votes.wishlist_item_id` and
      `wishlist_subscriptions.wishlist_item_id` to `products(id)` (data is tiny —
      migrate rows, then swap FK). Update `get_wishlist_item_status()` RPC to read
      `products`. Update comments `content_type` usage (`'wishlist_item'` →
      decide: keep value, point at products id; or add `'product'`).
- [ ] `102_drop_wishlist_items.sql` — after data moved + all readers repointed,
      drop `wishlist_items` (and dependent triggers/seed). **Last step**, only once
      §E is green.
- [ ] Regenerate types: `npm run db:types` after each applied migration.

### B. Candidate zone + `research_gear` rewrite
- [ ] `lib/boss/tools/research_gear.ts` `seedCatalog()` — **stop writing to
      `products` and `wishlist_items`.** Write candidates to `gear_candidates`
      (upsert by slug, bump `request_count`/`last_seen_at`). Keep returning the
      `/go/{slug}` map.
- [ ] Keep `boss_research_cache` writes and `logRoadmap()` unchanged.
- [ ] Update the ResearchedCard / chat result copy if it implies catalog/bench
      membership.

### C. `/go` resolution
- [ ] `app/go/[slug]/route.ts:43–53` — change the fallback: after `products`
      miss, resolve `gear_candidates` (not `wishlist_items`) for `affiliate_url`.

### D. Spine unification (the heavy lift)
- [ ] `lib/wishlist.ts`, `lib/products.ts` — fold bench helpers/types onto the
      products spine; reconcile status types.
- [ ] `app/api/wishlist/*` routes — repoint to `products`; reconcile the zod
      status enums (currently `['considering','queued','testing','reviewed','skipped']`)
      to the unified enum.
- [ ] `app/api/reviews/[id]/route.ts:208–238` — today updates **both** `products`
      and `wishlist_items` on approval; collapse to one `products` update.
- [ ] `app/api/wishlist/[id]/promote/route.ts` — repoint to `products`; keep its
      "link review → reviewed" meaning (distinct from `adopt`).

### E. Public surface repointing (`wishlist_items` → `products`)
Every reader below must query `products` with the same status filter. Once they
read `products` (which contains no researched gear), the leak is closed by
construction:
- [ ] `app/(public)/page.tsx:183` — homepage "On the Bench" reel.
- [ ] `components/BenchStrip.tsx:26`
- [ ] `components/PipelineCounter.tsx:26`
- [ ] `components/InMotionTicker.tsx:83`
- [ ] `components/OffTheBench.tsx` (reads `reviewed`)
- [ ] `app/(public)/bench/page.tsx:24–29` — lists ALL bench items (limit 150),
      grouped by status; another current leak surface.
- [ ] `app/(public)/bench/[slug]/page.tsx` — individual bench detail (researched
      gear currently gets a public URL here).
- [ ] `app/(public)/reviews/[slug]/page.tsx`, `app/(public)/account/settings/page.tsx`,
      `lib/wishlist-emails.ts`, vote/subscribe/graduated-votes routes.
- [ ] **Route URLs unchanged** (`/bench`, `/bench/[slug]`) — only the query target
      changes, so no `proxy.ts`/`legacy_slugs` work needed.

### F. Admin + adopt UI
- [ ] Admin candidate review screen: list `gear_candidates` (sorted by
      `request_count`), with **Adopt → bench** (one click).
- [ ] `POST /api/gear-candidates/[id]/adopt` — insert `products` row
      (`status='considering'`, `source='adopted_from_research'`), optional delete/flag
      candidate.
- [ ] Optional: surface "Adopt" affordance on the Boss chat ResearchedCard for admin.
- [ ] Admin demand/roadmap view reads the gap log (confirm it exists; wire if not).

### G. Teardown
- [ ] Apply `102_drop_wishlist_items.sql` only after E verified.
- [ ] Remove dead helpers/scripts referencing `wishlist_items`
      (`scripts/list-bench-items.mjs`, `scripts/_archive/delete-bench-placeholders.mjs`).
- [ ] Grep sweep: zero remaining `from('wishlist_items')`.

---

## 6. File inventory (from grep, 2026-06-18)

**Writes the leak:** `lib/boss/tools/research_gear.ts` (seedCatalog 166–220, logRoadmap 222+).
**`/go`:** `app/go/[slug]/route.ts`.
**Public bench readers:** `app/(public)/page.tsx`, `components/{BenchStrip,PipelineCounter,InMotionTicker,OffTheBench}.tsx`, `app/(public)/bench/page.tsx`, `app/(public)/bench/[slug]/page.tsx`, `app/(public)/reviews/[slug]/page.tsx`, `app/(public)/account/settings/page.tsx`.
**API:** `app/api/wishlist/route.ts`, `app/api/wishlist/[id]/{route,promote,subscribe,vote}.ts`, `app/api/wishlist/my-graduated-votes/route.ts`, `app/api/reviews/[id]/route.ts`.
**Admin:** `app/(dashboard)/dashboard/admin/wishlist/{page,[id]/page}.tsx`, `WishlistForm.tsx`.
**Libs:** `lib/wishlist.ts`, `lib/products.ts`, `lib/wishlist-emails.ts`, `lib/labels.ts`, `lib/supabase/database.types.ts`.
**Migrations referenced:** 030 (wishlist + votes/subs + RPC + seed), 038 (comments type), 046 (products), 069 (follow-up), 075 (store check), 087 (brand/specs), 093 (gallery), 096 (researched + roadmap), 097/098 (research cache). Next free #: **099**.

---

## 7. Open questions — LOCKED 2026-06-18
1. **Status vocabulary (unified `products.status`):** `considering | queued |
   testing | reviewed | passed | archived`. **`archived` kept distinct from
   `passed`** — `passed` = evaluated, won't review (may still show in
   "passed on it" contexts); `archived` = hard-hidden, never surfaced. Old→new
   map: wishlist `considering`→`considering`, `skipped`→`passed`; products
   `wishlist`→`considering`. **`researched` is removed** (was never in the
   `ProductStatus` TS type anyway — only written by the raw seed upsert).
   Public bench whitelist: `considering | queued | testing | reviewed`.
2. **Comments polymorphism:** introduce `content_type='product'` and migrate any
   existing `'wishlist_item'` comment rows in the merge migration (expected ~0).
3. **Candidate retention:** `gear_candidates` rows persist. `adopt` **flags**
   (`adopted_at` + `adopted_product_id`), never deletes — keeps provenance and
   stops re-surfacing as "new." Manual prune for now (no cron); `last_seen_at` +
   `request_count` maintained on each research hit.
4. **`/go` for candidates:** YES — keep tracked `/go` links for un-adopted
   candidates (click tracking + bot rate-limit + disclosure already on the
   ResearchedCard; Amazon Associates allows linking un-reviewed products).
   Resolution order: `products` → `gear_candidates` → `wishlist_items` (the last
   is legacy, dropped after the spine merge).
5. **Demand log:** confirmed — `boss_research_requests` (mig 096) is the home and
   stays as-is; admin view built in Increment 2 (§F).

## 7b. Build sequencing (each increment leaves the app working)
- **Increment 1 — candidate zone (stops the leak):** mig `099` creates
  `gear_candidates`, backfills from already-leaked `products.status='researched'`
  rows + deletes them and their twin bench rows, and drops `researched` from the
  status CHECK. `research_gear` writes candidates instead of products/bench. `/go`
  gains the candidate fallback. `products`/`wishlist_items` otherwise untouched →
  app keeps working, leak closed.
- **Increment 2 — spine unification:** migs `100`–`102` (spine columns + status
  reconcile, FK/RPC/comments repoint + data merge, drop `wishlist_items`), repoint
  all public readers (§E), `adopt` action + admin candidate/demand views (§F).

---

## 8. Data handling (few rows — clean cut is safe)
- Before migrating: snapshot current `products` and `wishlist_items` row counts +
  any rows already `status='researched'` (these are mis-seeded — move to
  `gear_candidates` or delete).
- Because volume is tiny and there are no users, prefer **migrate-then-verify**;
  reseeding from scratch is acceptable if cleaner.
- Run the CI migration-replay guard (`check-migrations.yml`) — new Supabase symbols
  need a stub in `scripts/shadow-setup.sql`.

---

## 9. Risks & guardrails
- **Naming doctrine tension (CLAUDE.md):** "never rename a DB table." Merging
  `wishlist_items` into `products` is a *structural correction* (two tables → one
  entity), not a cosmetic rename, and it's justified only because there are no
  users and a green field. Route URLs (`/bench*`) are preserved → no display/label
  churn. Record this as a deliberate one-time exception.
- **RLS doctrine:** new `gear_candidates` = admin-only; `products` public-read must
  stay `to anon, authenticated`. Use `is_admin()` helper, never inline EXISTS.
- **`proxy.ts`:** untouched — never rename.
- **FK repoint risk (D/A):** votes/subscriptions cascade-delete; migrate rows
  before swapping FKs so no vote/subscription is orphaned.
- **Surfacing regression test:** after §E, assert no public bench surface can
  return a `source='adopted_from_research'`-only/untested item that wasn't
  deliberately set to a bench status — and that `gear_candidates` rows never appear
  on any public route.

---

## 10. One-line summary
Split derived AI-research data (a disposable, private **candidate zone** +
existing query cache + demand log) from a single **earned-entry product spine**
that all public surfaces read, bridged only by a deliberate **adopt** action —
making "untested gear can't surface" true by construction instead of by filter.

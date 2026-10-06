# Gear IA + On the Radar — plan

> Status 2026-10-06. Operator decisions are locked. Steps 1, 2, 2a and 2b are built (2–2b
> uncommitted, awaiting the operator's walkthrough); the public surfaces (step 3) are next.
> Memory: `project_gear_ia_concerns`.

## Why

"Gear" meant two things: `/gear` was tested reviews rated 8+, but `/gear/[slug]`
was the merch store. And there was no home for products that are just cool,
interesting or trending but that Boss Daddy hasn't bought or tested.

## Decisions (operator, 2026-09-29)

1. **Merch moves to `/shop`.** `/gear` means tested and watched gear only.
2. **New lane: "On the Radar"**, inside `/gear`. Untested products with a short,
   honest take in the Boss Daddy voice: why a dad would care, plus one honest
   reservation. Never dressed up as a review: no score, no "tested" badge, a
   clear "not tested" chip. FTC disclosure still applies to buy links.
3. **Radar cards carry a "Want me to test it?" vote.**
4. **Radar sits above Boss Approved** on `/gear`.

## The funnel

`Radar` ("caught my eye") → `Bench` ("I'm going to test this") → `Review` ("the verdict")

Radar items get visible outcomes: *moved to the Bench*, *reviewed (score) →*,
or *passed, and here's why*. Passing on something publicly builds trust and fits
the voice.

## Data model

Radar is the **first status in the existing product lifecycle**, not a separate
table (this reversed the first sketch of a `radar_entries` table once the
schema was read):

- `products.status` gains `'radar'`, the lifecycle becomes
  `radar → considering → queued → testing → reviewed → passed / archived`.
- `products.radar_take text` holds the short take.
- `products.spotted_at timestamptz` is stamped when a product enters Radar and is
  **kept** after it moves on, so the archive can show the outcome (derived from
  the current status).
- Votes reuse `wishlist_votes`, which is already keyed to `products.id`. A vote
  cast on Radar carries straight over when the item moves to the Bench.

Guards in migration 157:

- **Trigger `trg_products_spotted_at`** stamps `spotted_at` on every entry into
  Radar (insert or status change), so a product that passed and comes back reads
  as fresh. An explicitly set `spotted_at` is respected, and leaving Radar never
  clears it.
- **`status = 'radar'` is live** (products has no draft flag), so a CHECK
  requires a non-empty `radar_take` and a `spotted_at` while on Radar.
- **Scheduling:** a future `spotted_at` = a scheduled release. Public queries
  MUST filter `spotted_at <= now()`.

App-side rules the migration can't enforce (steps 2–3):

- **Outcome precedence:** a Radar item can be reviewed directly (mig 111's
  trigger sets `review_id` but never `status`). Derive the outcome as
  `review_id` (approved review) → "Reviewed", then `passed` → "Passed" +
  `skip_reason`, then a Bench status → "Moved to the Bench", else live. Never
  show a reviewed product as untested.
- **Admin form:** `radar_take` max 600 in zod (matches the CHECK). Show the take
  field when status = Radar. The API should return the CHECK violation as a
  readable error, not a 500.
- **Leaks to check:** `/api/admin/search` (`neq archived`) will return Radar
  products. That's fine for collections, as long as they render as honest product
  cards. `/bench/[slug]` already excludes Radar, so it 404s there, which is correct.
- **FTC:** Radar cards with buy links sit under the page's affiliate disclosure.

Why: a product already has everything a Radar card needs (name, image,
description, affiliate URL, category, price), "move to the Bench" becomes a
status change, and the product stays the single canonical record.

## `/gear` layout (a trust ladder)

1. Header: drop the blanket "Daddy Tested, Boss Approved" claim. Radar makes it
   false for the page as a whole.
2. Tested lead: #1 Pick and Perfect Score.
3. **On the Radar**: the newest 6–9, dated, plus "See everything on the radar"
   linking to `/gear/radar`.
4. **Boss Approved** (9s; renamed from "Boss Picks") and **Solid Gear** (8s).
5. Bench strip.
6. Gift guides and the featured collection, lower.
7. Merch strip teaser → `/shop`.

Also: `/gear/category/[slug]` gets a labelled Radar section below its tested
gear. No per-item Radar detail pages at first (cheap to produce, avoids thin
pages); an item that earns more graduates to the Bench and a review. Cadence
beats volume: ~3 a week. Old items age off `/gear` but stay in the archive.

## Build steps

1. **`/shop` split + merch discovery**: SHIPPED `e6be242`. `/gear/<x>` 301s to
   `/shop/<x>` unless `x` is in `GEAR_ROUTES` (`lib/proxy/rewrites.ts`: `category`,
   `radar`). **Add any new `/gear` sub-route there.**
2. **Radar data + admin**: DONE 2026-10-06 (uncommitted). Mig 157 applied, types
   regenerated. `LABELS.radar`; `'radar'` in `ProductStatus` / `PRODUCT_STATUSES`;
   `radar_take` (max `RADAR_TAKE_MAX` = 600) + `spotted_at` in the zod schemas
   (`spotted_at` never nullable through the API); `productCheckViolation()` turns
   the 23514 CHECKs into 400s in both admin product routes; a Radar tab +
   "Scheduled" badge on the admin list; the form's Radar card (take, plus a
   "Goes live" schedule sent only when edited); `isRadarScheduled()` in
   `lib/products.ts`. Approving a review now also advances a `radar` product to
   `reviewed` (`app/api/reviews/[id]/route.ts`).
2a. **Product lifecycle v2 + claims** (decided 2026-10-06, migration 158 APPLIED,
   built, uncommitted). The operator's rule: a product claims only what he sets,
   plus legal disclosures (brand-guide §1.9).
   - **Stages:** `catalog` (private, the new default) | `radar` → `queued` → `testing`
     → `reviewed` | `passed` | `archived`. `considering` is retired (same promise
     as Radar); its 4 rows moved to catalog. The column default was the dead
     `'wishlist'` and is now `catalog`.
   - **`reviewed` is a trigger** (`trg_advance_product_on_review_approval`) on an
     approved top-level review. The app-code flip is gone. Promote-to-draft no
     longer sets `reviewed`, and the admin API refuses a hand-set `reviewed`
     without an approved review. Backfill fixed 3 drifted rows.
   - **How I got it:** `acquisition` (purchased | provided | loaner) +
     `provided_by`. `productClaims()` / `acquisitionDisclosure()` in
     `lib/products.ts` decide every chip. The disclosure renders in the review's
     TrustReceipt, on the Bench page and on collection product cards.
   - **Testing notes:** the `product_testing_notes` table, an admin panel on the
     product edit page, and a public "Testing Notes" timeline on `/bench/[slug]`
     ("Week N" counted from the first note).
   - **Collections:** the "Owner pick · not yet reviewed" / "Researched · not
     tested" chips are gone. `ProductClaimLine` shows only set claims, and
     `upgradeReviewedProducts()` turns a showcased product into its review card
     once the review is approved. The Boss's own "Researched · not tested" label
     (in the AI chat) stays, because there an AI is speaking in the brand voice.
   - **Fixed:** `/bench/[slug]` rendered ANY product by slug. It now 404s
     unless the stage is queued / testing / reviewed / passed.
   - **Gate:** rewrite the "no PR samples / own money" copy before the first
     brand-provided review (Brief §6).

2b. **Paste-a-link product import**: BUILT 2026-10-06, uncommitted. Files:
   `lib/products/import.ts`, `POST /api/admin/products/import`, the "Import From
   a Link" box in ProductForm, `resolveRedirects()` in `lib/link-preview/fetch.ts`.
   Amazon share links (`a.co`/`amzn.to`, most of the catalog's Amazon links)
   resolve by redirect headers only, and the product page is never read. The
   import fills EMPTY fields only. The web lookup is a separate opt-in button
   (research bucket, `claude-aux` rate limit). NOT live-tested from the CLI: the
   operator's guardrail blocks shell fetches, so the first real run is the
   operator's browser walkthrough. Original brief (operator asked 2026-10-06,
   before the public surfaces, because Radar's ~3-a-week cadence makes entry
   speed matter): Paste a URL on New product: the server fetches it with the
   hardened DM link-preview fetcher (`lib/link-preview/fetch.ts` `guardedFetch`:
   SSRF + DNS-rebinding guard, size caps). It reads schema.org Product JSON-LD +
   OpenGraph (name, brand, image, price, description, GTIN), detects the store
   from the domain, pulls the ASIN and builds the affiliate link. Optionally the
   page text runs through the existing spec-sheet autofill. Everything lands as
   editable fields and nothing saves until Create. **Amazon:** ASIN + affiliate
   link only. Details and images need PA-API (Associates rules), so the fallback
   is a web lookup by name/ASIN for facts, with no images. Retailer copy is a
   starting point to rewrite, never published verbatim.
3. **Public surfaces**: the Radar section on `/gear` (with the vote), the
   `/gear/radar` archive, the category-page section, the header and deck rewrite,
   and the "Boss Picks" → "Boss Approved" rename.

   Also for step 3 (decided 2026-10-06): **the Bench gets one job.** Radar
   cards carry the vote ("Want me to test it?"). Bench items carry **follow**
   ("Notify me when the review's out"), and Up Next can show "Requested by N
   dads" from carried-over votes. `/gear` tells the whole journey (Radar →
   Bench → Boss Approved), and `/bench` stays the full list. Testing notes
   should also show on the review page as a "Testing log", because
   `/bench/<slug>` 307s to the review once reviewed, which hides them.

   Found while building step 2:
   - "Promote to Review" (`/api/wishlist/[id]/promote`) sets `status = 'reviewed'`
     as soon as the review *draft* exists. Status alone doesn't prove a verdict,
     so the archive must check for an **approved** review before showing "Reviewed".
   - Add `/gear/radar` to `revalidateProductPaths()` when the route exists.
   - The vote route (`/api/wishlist/[id]/vote`) has no status gate, so Radar votes
     work as-is.

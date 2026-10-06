# Gear IA + On the Radar — plan

> Status 2026-10-06. Operator decisions are locked. Steps 1–2b are shipped (`e6be242`,
> `b2c1733`). Step 3 (the public surfaces) is BUILT and uncommitted, awaiting the operator's
> walkthrough. Memory: `project_gear_ia_concerns`.

## Why

"Gear" meant two things: `/gear` was tested reviews rated 8+, but `/gear/[slug]`
was the merch store. And there was no home for products that are just cool,
interesting or trending but that Boss Daddy hasn't bought or tested.

## Decisions (operator, 2026-09-29)

1. **Merch moves to `/shop`.** `/gear` means tested and watched gear only.
2. **New lane: "On the Radar"**, inside `/gear`. Untested products with a short,
   honest take in the Boss Daddy voice: why a dad would care, plus one honest
   reservation. Never dressed up as a review: no score, no "tested" badge. FTC
   disclosure still applies to buy links. (The original "clear 'not tested'
   chip" was superseded on 2026-10-06 by *claims only when set*, brand-guide
   §1.9: showcasing claims nothing, so there's no default chip either way. The
   lane name and the "Want me to test it?" vote say it.)
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
3. **Public surfaces**: BUILT 2026-10-06, uncommitted (check + 582 tests + prebuild
   green). What shipped:
   - **Data:** `lib/products/radar.ts`: `getLiveRadar()` (status radar, `spotted_at <= now`),
     `getRadarArchive()` (radar | queued | testing | reviewed | passed, released,
     newest first, cap 200), `toRadarItem()`, and `radarOutcome()` (the precedence
     below; `null` = no honest outcome, so the item is left out). The review embed
     names its FK (`reviews!products_review_id_fkey`): products↔reviews are linked
     both ways, so a bare embed is ambiguous.
   - **Components:** `components/radar/RadarCard` (category eyebrow, "Spotted <date>"
     in America/Chicago, the take, `ProductClaimLine stage={false}`, then an outcome
     footer: the vote + buy link while live, else *Moved to the Bench* / *Reviewed N/10*
     / *Not Testing* + reason) and `RadarLane` (the section: FTC line above the first
     buy link, 3 cards on phones and 6 from `sm`, always rendered, with a slim line
     when empty per the uniformity rule).
   - **Vote:** `components/wishlist/RadarVote` ("Want me to test it?", *Test it* /
     *Requested*, "Requested by N dads") replaced `VoteButton`. The per-user reads
     are batched (`vote-state.ts` → `GET /api/wishlist/votes?ids=`, cap 50, chunked),
     so a grid costs one request. The old per-item GET is gone. `POST
     /api/wishlist/[id]/vote` takes a NEW vote only when `isRadarLive()` (409
     otherwise; un-voting is always allowed) and now checks its write errors.
     `revalidateVotePaths()` purges the pages that print counts.
   - **Pages:** `/gear` restructured to the trust ladder (#1 Pick → pills → Perfect
     Score → **On the Radar** → **Boss Approved** (was "Boss Picks", anchor
     `#boss-approved`) → Solid Gear → Bench strip → Ask the Boss → gift guides →
     featured collection → merch strip). The header is now eyebrow "Rated · Testing ·
     Watching", H1 `LABELS.gear.full` ("Boss Daddy's Gear"), and a deck built on the house line.
     `/gear/category/[slug]` got a category-scoped lane under its rated gear. The new
     `/gear/radar` archive has a *Live* section (votes), then *Where They Went*.
     Sitemap: `/gear/radar` added, and Radar rows now date `/gear` + the listed category pages.
   - **Bench = follow:** no vote on `/bench/[slug]`. `SubscribeButton` now reads
     "Notify me when the review's out" / "You're on the list" (and lost its banned
     `bg-blue-50`). Carried-over votes show as "Requested by N dads" on Bench cards
     + detail. Vote copy was moved off the Bench everywhere: `/bench` meta + deck, `LABELS.bench.tagline`,
     the BenchStrip default CTA, PipelineCounter ("follow along"), the login modal
     (`intent` vote | follow), the queued follower email (it said "your vote"), and
     the Boss chat's researched-list link (→ `/gear/radar`).
   - **Testing Log:** `components/products/TestingLog` is shared by `/bench/[slug]`
     (open section) and the review page (closed `<details>` under the TrustReceipt).
     The review's "From the Bench" pill linked to `/bench/<slug>`, which 307s back
     to the same review. It now jumps to `#testing-log` (or `/bench` when there's no
     log). Note edits purge the product's review pages
     (`revalidateProductReviewPages()`).
   - **Category empty state (found in the operator's walkthrough):** gear pages list
     reviews rated 8+. Tools & DIY has 3 published reviews (7.2 / 7.0 / 6.25), so its
     page showed "No rated tools & diy gear yet", which was false. It now states the bar
     and links "See all 3 Tools & DIY reviews" (`/reviews/category/<slug>`), and the
     footer link is category-scoped ("every score"). **The 8+ bar stays** (operator,
     2026-10-06): a gear page means "what I'd recommend". No "Also reviewed" tier.
   - **Copy fixed under §1.9 as a side effect:** "Dad-tested gift guides" → "Hand-picked";
     Solid Gear's "Good enough that I kept them" (an ownership claim a loaner breaks).

   - **A vote also follows (operator, 2026-10-06, built same day):** voting inserts
     the follow too (`followChangeForVote()` in `lib/wishlist.ts`; upsert on the
     existing unique key, no migration), so voters get the follower emails (up next →
     testing → review's out). Guardrails: (1) the card says "I'll email you when I test
     it." the moment they vote, and the vote sign-up modal says it before they join;
     (2) un-voting while the item is still on the Radar deletes the follow too, and once it has
     moved on the follow is left alone; (3) no backfill of the 4 votes that existed
     before. The card promises email only while the follow row exists (`following` is
     in both the POST and the batch GET). Every follow row gets its own unsubscribe
     token (DB default), and the email footer now reads "voted for or followed".
     A Radar follow isn't listed on `/account` until the item reaches the Bench
     (that list shows Bench stages only).

   **Open for the operator:** (a) the public name is one label, "Testing Log",
   on both pages (was "Testing Notes" on the Bench); (b) DECIDED, see the vote/follow
   bullet above. Optional later: a "passed, here's why" email (no one is told about
   a pass today). (c) the indexed titles changed on purpose:
   `/gear` ("…— Rated Picks and What's on the Radar") and `/bench` ("…— What Boss
   Daddy Is Testing Now"). Left alone on purpose: the gift-occasion "— Boss Daddy
   Picks" SEO titles, and the "Boss Pick" + "own money" line in the Tools & DIY POV
   (`lib/categories.ts`), which belongs to the own-money copy gate.

   Also for step 3 (decided 2026-10-06): **the Bench gets one job.** Radar
   cards carry the vote ("Want me to test it?"). Bench items carry **follow**
   ("Notify me when the review's out"), and Up Next can show "Requested by N
   dads" from carried-over votes. `/gear` tells the whole journey (Radar →
   Bench → Boss Approved), and `/bench` stays the full list. Testing notes
   should also show on the review page as a "Testing log", because
   `/bench/<slug>` 307s to the review once reviewed, which hides them.

   Found while building step 2 (all handled in step 3):
   - "Promote to Review" set `status = 'reviewed'` on the *draft* (fixed in 2a). The
     archive still derives "Reviewed" from an approved + visible review, never the status alone.
   - `/gear/radar` is in `revalidateProductPaths()`.
   - The vote route had no status gate. It now takes new votes only on live Radar items.

# Home / Manifesto v2 — Design System Spec

> **Status:** Phase 1 built on branch `design-v2` (2026-07-06). This is the build source-of-truth for the editorial "Manifesto" redesign, which applies **site-wide** for uniformity. The homepage is the *reference implementation*; every other page inherits these primitives.
>
> **Approved mock:** `docs/mockups/home-manifesto.html` (open in a browser). Comparison mocks: `hero-directions.html`, `home-utility.html`, `home-proof-search.html`, `home-redesign.html`.

---

## 1. Locked decisions

| Area | Decision |
|---|---|
| Direction | Manifesto — magazine/editorial |
| Theme | **Dark-first everywhere** (already live via `data-theme="dark"` on `<html>`). Zinc-light retired. |
| Editorial serif | **Fraunces** (`--font-editorial-display`), scoped opt-in via `.font-editorial-display` |
| Default headings | Montserrat `font-black` (unchanged) |
| Hero H1 | **"Dad Like a Boss."** ("Boss." in `text-accent`) — v3.4 title-case; do NOT all-caps `BOSS` |
| Independence claim | **"Zero paid placements"** (never "zero sponsors" — affiliate links exist, keep FTC-safe) |
| Hero ticker | 100% live/DB-backed: reviews count · guides count · 4 tools · zero paid placements |
| Score rings | Tiered — ring on Cover Story / Featured / review-detail; numeric chip in grids |
| Emoji | None on web (SVG icons only) |
| Hero photo | Placeholder `hero-workshop.webp` now → real hero shoot later (swap `<Image src>` only) |
| "Meet the Boss" | → `/about` |
| Nav | Transparent-over-hero → solid on scroll (Phase 1b — see Open items) |

### The Creed (mid-page dark moment, signed) — canonical v3.4 manifesto
> Boss Daddy isn't just another men's fashion, fitness, or lifestyle brand. It is the gold standard and trusted hub for Boss Dads Built Different — men who believe being a proud and present father isn't a compromise of his strength, but **the ultimate expression of it.**
> — The Boss

This is the **single canonical manifesto** (source: `docs/brand-guide.md` §1.7). It replaced the old "isn't just another review site" Creed — do not reintroduce that variant. Use this exact wording. (payoff phrase "the ultimate expression of it" in `text-accent`; rendered in `font-editorial-display`.)

---

## 2. Shared primitives (built once, used site-wide)

| Component | File | Purpose |
|---|---|---|
| `HomeHero` | `components/home/HomeHero.tsx` | Full-bleed photo cover + live ticker. Props: `reviewCount`, `guidesCount`, `toolsCount`. Homepage only. |
| `EditorialHeader` | `components/EditorialHeader.tsx` | Section header: sans eyebrow + Fraunces serif title + optional right link. **The site-wide section pattern.** |
| `PageHeader` | `components/PageHeader.tsx` | Interior "slim editorial band": eyebrow + Fraunces H1 + deck + hairline. **Every non-home page.** |
| `ScoreBlock` | `components/ScoreBlock.tsx` | `variant="ring"` (hero moments) or `variant="plain"` (default). |

Reused as-is: `DroppedCard`, `GuideRow`, `EmailCaptureSection`, `BossApprovedBadge`, `getCategoryBySlug`.
`SectionHeader` (3px-rule) is retained for compact/admin surfaces; public editorial surfaces migrate to `EditorialHeader`.

### Type / token gotchas
- `@theme inline` does **not** emit `--color-*` runtime vars. In inline `style={{}}`, use raw `--bd-*` (e.g. `var(--bd-orange)`, `var(--bd-surface-hover)`), never `var(--color-accent)`.
- `.font-editorial-display` is declared **unlayered** in `globals.css` so it beats the unlayered `h1–h4 { font-family: var(--font-display) }` element rule. Don't rely on the Tailwind-generated `font-*` utility for this — it would lose the cascade.

---

## 3. Homepage section order (reference impl — `app/(public)/page.tsx`)

1. **Hero** — `HomeHero` (full-bleed photo, "Dad Like a Boss.", ticker)
2. **The Cover Story** — featured review as editorial split (photo + serif title + excerpt + `ScoreBlock` ring + CTA)
3. **The Library** — enlarged guides footprint (the growth engine): topic chips + lead feature guide + reading list (`GuideRow`). Fetches 6 guides. Promoted into the slot the old wayfinding pillars used.
4. **Just Dropped** — recent reviews grid (`DroppedCard`)
5. **The Creed** — mission statement, dark `bg-chrome` moment
6. **Boss Tools** — Ask the Boss (feature) + Weekends Until + Savings
7. **Merch strip** — slim "Made by Boss Daddy" band, reused `MerchStrip` (`exploreHref="/gear#merch"`)
8. **Email capture** — `EmailCaptureSection`

### Removed vs. the previous homepage (preserved in git history)
- **"In this issue" wayfinding pillars** — dropped; the sticky nav already handles wayfinding, and the space was reallocated to the enlarged **Library**.
- **Top Picks leaderboard · From the Vault · On the Bench · Get-the-App band · PipelineCounter** — dropped to match the approved mock. **Flagged for the operator to re-add if wanted.**

---

## 4. Rollout (branch `design-v2`, incremental)

1. **Phase 1 (done):** Fraunces + primitives + homepage + doc/rule updates. **Phase 1b (done):** transparent-over-hero nav — `Header` floats transparent on the homepage top, solidifies on scroll (>24px); solid from top on every other page; mobile search hides while transparent.
2. **Phase 2 (DONE — all public listings):** Listing pages → swap the ad-hoc "tick-line eyebrow + H1" header to `PageHeader` (full-width band above a `py-12` content container).
   - **Done:** `/reviews`, `/guides` (all-view + per-category), `/gear`, `/gifts`, `/comparisons`, `/picks`, `/stacks`, `/vault`, `/category/[slug]`, `/reviews/tag/[slug]`, `/guides/tag/[slug]`. tsc + eslint clean.
   - **Note:** `/tools` (the `(tools)` route group) is intentionally NOT here — it has its own minimal-chrome layout and is handled in **Phase 4**, not moved into `(public)`.
   - **Recipe (per page):** import `PageHeader`; wrap the `return` in a `<>` fragment; delete the old header `<div>` (tick-line span + eyebrow `<p>` + `<h1>`) and replace with `<PageHeader eyebrow=".." title=".." deck=".." />` placed **above** the content container; change the outer wrapper `max-w-6xl mx-auto px-6 py-16` → `py-12`; keep stats/count lines just under the header; drop inline `CategoryIcon` from the H1 (editorial titles are text-only). Close with `</div></>`. Run `npx tsc --noEmit` after each.
3. **Phase 3:** Detail pages (review, guide, gear) → `PageHeader` + `ScoreBlock` ring on detail headers.
4. **Phase 4:** Tools pages.
5. **Phase 5:** Editorial/static (`/about` = the "Meet the Boss" story, `/how-we-test`, legal) → **merge to master**.

---

## 5. Open items (non-blocking)

- **Hero shoot** — swap `hero-workshop.webp` / `hero-workshop-mobile.webp` for the real cover shot.
- **Nav transparent-over-hero → solid on scroll** — small `Header` change (Phase 1b).
- **Newsletter subscriber count** — omit until ≥ ~500; then surface.
- **Testing-integrity creed** ("I buy it. I break it…") — park on `/how-we-test`, not the homepage.
- **Re-add decision** for the dropped sections above.

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

### The Creed (mid-page dark moment, signed) — canonical v3.5 manifesto
> Boss Daddy isn't just another men's fashion, fitness, or lifestyle brand. It is the gold standard and trusted hub for men living The Boss Dad Standard — men who believe being a proud and present father who shows up every day isn't a compromise of strength, but **the ultimate expression of it.**
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

Reused as-is: `GuideRow`, `EmailCaptureSection`, `BossApprovedBadge`, `getCategoryBySlug`.

**Cadence primitives (added 2026-08-03, Wirecutter-derived).** The homepage runs one
repeated module shape — "Template A": a `LeadCard` paired with a column of compact
rows — so adjacent sections never share a weight:

| Component | Path | Notes |
|---|---|---|
| `LeadCard` | `components/LeadCard.tsx` | Lead half of a Template A module. Shared by Just Dropped (reviews), the Library's topic blocks, `/guides`, and `/reviews`. |
| `ContentRow` | `components/ContentRow.tsx` | **The** compact directory row, site-wide. Text left, thumbnail right. Replaced four near-identical rows (`GuideRow`, `ReviewRow`, `/guides`'s `GuideRowItem`, `/reviews`'s local `ReviewRow`) that had drifted into two geometries. Optional `rating` — pass it on `/reviews`, omit it on recency surfaces. |
| `TopicBlock` | `components/TopicBlock.tsx` | One category as a Template A module, and the single implementation behind **all three** per-category directories: homepage Library, `/guides`, `/reviews`. Content-kind agnostic — callers map to `TopicItem`. **One shape, ungated:** thin categories render with a short/empty row column by decision. Don't re-add a depth gate or a per-count layout swap; both were built and rejected. Takes `index` — see Alternating handedness below. |

### Alternating handedness (settled 2026-08-03)

Topic blocks run **serpentine**: even blocks lead-left/rows-right, odd blocks
lead-right/rows-left, across all three per-category directories. Driven by
`TopicBlock`'s `index` prop, so the rule has one home and no surface can drift.

- **This departs from Wirecutter on purpose.** All nine of their lead+rows modules
  run the same way round, holding the lead card on a single vertical scan line. Both
  versions were built and compared live across the three surfaces; the serpentine won.
  Don't "restore" uniform handedness as a consistency fix.
- **The rows mirror with the module** (`flip` → `ContentRow`). Non-negotiable: an
  unmirrored row in a left-hand column stacks its thumbnails against the middle
  gutter, hard against the lead card. Mirroring keeps thumbnails on the outer edge so
  the module's silhouette mirrors cleanly instead of just swapping sides.
- **It's `lg:order-*`, never reordered children.** DOM order stays lead-then-rows, so
  the single-column mobile stack always opens on the lead card. Reversing children
  instead would bury the lead on mobile — invisible on desktop, wrong on the phone.
- Alternation is desktop-only by nature: below `lg` every module is one column.
| `LatestRail` | `components/home/LatestRail.tsx` | Text-only recency index beside the Cover Story — the page's only image-free tier. Rendered as a bordered panel, not naked text. |
| `BossToolsSection` | `components/home/BossToolsSection.tsx` | Boss Tools extracted verbatim so it could move mid-page. |
| `CredibilityBreak` | `components/CredibilityBreak.tsx` | Mid-directory breather at the halfway mark of the topic blocks, on all three directories. Renders `BRAND.credibility`. **No card, no big type, no link** — the pause comes from the absence of a card and from vertical air; §359 specs this line as supporting weight. See brand-guide §1.7 line assignment. |

`on={'background' | 'surface'}` on `LeadCard` and `LibraryGuideCard` names the surface
the card sits **on** and picks the card's own background. Getting it wrong is the
dark-canvas bug: a `bg-surface` card inside a `bg-surface` section is invisible but for
its border.

`DroppedCard`, `guides/_components/GuideCard`, and `guides/_components/GuidesGrid` were
**deleted 2026-08-03** — orphaned by the restructure (the latter two had already been
dead). `LibraryGuideCard` survives and is now shared with `/guides/category/[slug]`.
`SectionHeader` (3px-rule) is the **utility** lane; `EditorialHeader` is the **editorial** lane. Settled 2026-07-27: `/gear` is deliberately utility-styled and keeps `SectionHeader` (5 call sites) — it's a working gear list, not an editorial read. Full rule: `brand-guide.md` §2 "two lanes".

### Type / token gotchas
- `@theme inline` does **not** emit `--color-*` runtime vars. In inline `style={{}}`, use raw `--bd-*` (e.g. `var(--bd-orange)`, `var(--bd-surface-hover)`), never `var(--color-accent)`.
- `.font-editorial-display` is declared **unlayered** in `globals.css` so it beats the unlayered `h1–h4 { font-family: var(--font-display) }` element rule. Don't rely on the Tailwind-generated `font-*` utility for this — it would lose the cascade.

---

## 3. Homepage section order (reference impl — `app/(public)/page.tsx`)

1. **Hero** — `HomeHero` (full-bleed photo, "Dad Like a Boss.", ticker)
2. **The Cover Story** — featured review as editorial split (photo + serif title + excerpt + `ScoreBlock` ring + CTA)
2b. **The Latest rail** — `LatestRail`, in the Cover Story's right column (`lg:grid-cols-[1fr_300px]`). Merged guide+review recency index, text only, no images. Gives the first screen ~8 entry points instead of 1.
3. **The Library** — the guides footprint (the growth engine), organised as a **topic directory**: chips + lead feature guide + one `TopicBlock` per category with a live guide, in `lib/categories.ts` taxonomy order. Eyebrow is "Every topic", not "Latest guides" — below the lead it isn't recency-ordered. Fetches **every** published guide (capped at `GUIDE_FETCH_CAP`), because a recency window can't feed a per-category directory.
4. **Boss Tools** — Ask the Boss (feature) + Weekends Until + Savings. Moved up from position 6: it's the only image-free content section, so it's the mid-scroll breath between two image grids. Wirecutter's Finder sits in the same slot.
5. **The Vault** — collections strip, flat 3-up (`VaultCard`)
6. **Just Dropped** — Template A: `LeadCard` + 3 `ReviewRow`s. Was a flat 2/4-up grid, which put two same-weight card grids back to back with the Vault — the page's flattest stretch. Deduped against the Cover Story's `featured` review.
7. **The Creed** — mission statement, dark `bg-chrome` moment. Stays late: `Creed → Email capture` is the payoff-then-ask sequence.
8. **Merch strip** — slim "Made by Boss Daddy" band, reused `MerchStrip` (`exploreHref="/gear#merch"`)
9. **Email capture** — `EmailCaptureSection`

**The cadence rule:** no two adjacent sections share a shape. Reading down —
big-image split, text rail, per-topic Template A modules, text cards, flat 3-up grid,
Template A, centred prose. If you add a section, check what sits either side of it.

### Removed vs. the previous homepage (preserved in git history)
- **"In this issue" wayfinding pillars** — dropped; the sticky nav already handles wayfinding, and the space was reallocated to the enlarged **Library**.
- **Top Picks leaderboard · From the Vault · On the Bench · Get-the-App band · PipelineCounter** — dropped to match the approved mock. **Flagged for the operator to re-add if wanted.**

---

## 4. Rollout (incremental, on `master`)

> The original `design-v2` branch was absorbed into `master` on 2026-07-06 (`2c96f8a`); every phase
> since has shipped straight to `master` (`ec152d3`, `38c5b86`, and Phase 2.5 below). There is no
> unmerged design branch — don't go looking for one.

1. **Phase 1 (done):** Fraunces + primitives + homepage + doc/rule updates. **Phase 1b (done):** transparent-over-hero nav — `Header` floats transparent on the homepage top, solidifies on scroll (>24px); solid from top on every other page; mobile search hides while transparent.
2. **Phase 2 (DONE — all public listings):** Listing pages → swap the ad-hoc "tick-line eyebrow + H1" header to `PageHeader` (full-width band above a `py-12` content container).
   - **Done:** `/reviews`, `/guides`, `/gear`, `/gear/category/[slug]`, `/gifts`, `/comparisons`, `/picks`, `/stacks`, `/vault`, `/category/[slug]`, `/reviews/tag/[slug]`, `/guides/tag/[slug]`. tsc + eslint clean.
   - **Correction (2026-07-27):** this list previously claimed "per-category" was done. It wasn't — `/reviews/category/[slug]` and `/guides/category/[slug]` kept their bespoke `font-black` headers, and `/bench` was never listed at all. Closed in Phase 2.5.
   - **Note:** `/tools` (the `(tools)` route group) is intentionally NOT here — it has its own minimal-chrome layout and is handled in **Phase 4**, not moved into `(public)`.
   - **Recipe (per page):** import `PageHeader`; wrap the `return` in a `<>` fragment; delete the old header `<div>` (tick-line span + eyebrow `<p>` + `<h1>`) and replace with `<PageHeader eyebrow=".." title=".." deck=".." />` placed **above** the content container; change the outer wrapper `max-w-6xl mx-auto px-6 py-16` → `py-12`; keep stats/count lines just under the header; drop inline `CategoryIcon` from the H1 (editorial titles are text-only). Close with `</div></>`. Run `npx tsc --noEmit` after each.
3. **Phase 2.5 (DONE 2026-07-27):** closed the Phase 2 stragglers so the listing layer is genuinely uniform — `/reviews/category/[slug]`, `/guides/category/[slug]`, `/bench` → `PageHeader`; `/how-we-test` → `PageHeader` (its prose column is now left-aligned inside the same `max-w-6xl` rail so the article's left edge matches the H1); deleted the dead `ScoreBubble` (zero call sites since the superseded zinc-light era). Also fixed `brand-guide.md`'s type scale, which still told authors listing H1s were `font-black` sans.
   - **Pulse restored (2026-07-27):** Phase 2.5 dropped `/bench`'s animated "Live Testing Pipeline" chip for a plain eyebrow; the operator wanted the pulse back, so it returned **inside the eyebrow** as a status glyph — not as a chip below it (that would restate the eyebrow) and not in `actions` (`hidden md:block` would hide status on phones). `PageHeader.eyebrow` is therefore `ReactNode`, scoped by its doc comment to a status glyph prefixing the label. **Not** a general slot for chips, links, or a second line.
4. **Phase 3:** Detail pages (review, guide, gear) → `PageHeader` + `ScoreBlock` ring on detail headers.
   - **Blocked on a consolidation, not styling:** `RatingScore` has 18 call-site files vs `ScoreBlock`'s 1. Phase 3 is really "migrate `RatingScore` → `ScoreBlock`", then apply `variant="ring"` to the detail headers.
   - **Two constraints from later sessions:** `f96a7e0` deliberately removed the product-name chip from the review detail header and made **category the lead role eyebrow** — preserve that. And `a3287b8`/`42d70dc` restored static/ISR across the public hubs, so header work must stay prop-only server components (no `cookies()`/`headers()`).
   - **Settled 2026-07-27 — `/gear` stays utility-styled.** The `SectionHeader`-vs-`EditorialHeader` conflict is resolved as two lanes by surface (`brand-guide.md` §2): editorial surfaces use `EditorialHeader`, utility surfaces use `SectionHeader`, and `/gear` is deliberately in the utility lane. So Phase 3 does **not** convert `/gear`'s 5 `SectionHeader` call sites.
   - **Scope still under discussion.** Do not start Phase 3 on the spec's original review→guide→gear order. Open questions: which detail page leads (the case for `guides/[slug]` first is that Table Duty / Watch Duty essays render as guides, and it has no score-component entanglement), and whether the `RatingScore` → `ScoreBlock` consolidation ships as its own PR ahead of any ring styling.
5. **Phase 4:** Tools pages (12 routes in the `(tools)` group).
6. **Phase 5:** Editorial/static — legal pages, `/editorial-standards`, `/install`, `/search`. (`/how-we-test` landed early in Phase 2.5.)
   - **`/about` is EXEMPT — decided 2026-07-27. Do not migrate it.** Its H1 is a two-line composition (`<br />` + an accent-colored span: "The Dad Who Thought / He'd Never Be One."), its container is `max-w-4xl`, and its deck is a 6-line personal opening that #58 tuned on 2026-07-24. `PageHeader`'s `title: string` can express none of that, and the H1 *is* a design element here. `/about` is therefore a **second reference implementation** alongside the homepage — a story page, not an interior page. Widening `title` to `ReactNode` was considered and **rejected**: a second `ReactNode` prop would make "just pass JSX" the path of least resistance and the system drifts. (Separate, unrelated: the `STATS` grid under its hero shows scale counts — check it against the no-vanity-metrics rule.)
   - **Out of scope, stated explicitly:** account (5 routes), `/cart`, `/order/[id]` are app chrome, not editorial surfaces. They keep the sans `font-black` H1 (see the brand-guide type-scale row).

---

## 5. Open items (non-blocking)

- **Hero shoot** — swap `hero-workshop.webp` / `hero-workshop-mobile.webp` for the real cover shot.
- **Nav transparent-over-hero → solid on scroll** — small `Header` change (Phase 1b).
- **Newsletter subscriber count** — omit until ≥ ~500; then surface.
- **Testing-integrity creed** ("I buy it. I break it…") — park on `/how-we-test`, not the homepage.
- **Re-add decision** for the dropped sections above.

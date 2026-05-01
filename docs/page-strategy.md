# Boss Daddy — Page Strategy & Information Architecture

> Canonical reference for what every page on the site is for, what belongs on it, and what doesn't.
> Pair with [`brand-guide.md`](brand-guide.md) (visual system) and [`CLAUDE.md`](../CLAUDE.md) (engineering rules).
> Last revised: 2026-05-01

---

## 0. How to use this document

When designing, redesigning, or adding sections to any page, **start here**. If a proposed change conflicts with a page's "Belongs here" / "Doesn't belong here" rules, either change the rules deliberately (and update this doc) or rework the proposal.

Two-column rule for every page section: **(1)** what user job does this section serve, **(2)** what page is its primary home. If a section can't answer both, cut it.

---

## 1. Strategic Principles

These five rules govern every page-level decision. They override component-level instincts.

1. **One job, masterfully.** Each page does exactly one thing at a high standard. A homepage that tries to be the about page, the latest-content feed, *and* the category index does none of them well.

2. **Audience asymmetry shapes the homepage.** ~70% of content traffic lands directly on detail pages from Google. Homepage visitors are different — returners, podcast/social referrals, press, or curious readers who just finished a review. They have *higher* intent to understand "who is this site?" The homepage is a brand storefront, not a magazine cover.

3. **Evergreen + seasonal beats trending.** We do not run a news feed. We update flagship reviews quarterly, run seasonal guides on a calendar (Father's Day, Back-to-School, Holiday), and let evergreen content do the SEO work. Trending news is a treadmill that requires editorial staff we don't have.

4. **Category pages are topical authority hubs, not filtered lists.** A user who lands on `/category/strollers` from Google should feel they've arrived at the definitive Boss Daddy stroller destination — POV, best reviews, buying guide, recommended picks, FAQ. Not a paginated list of stroller reviews sorted by date.

5. **Voice is the differentiator.** Wirecutter wins on institutional rigor. We win on first-person dad voice and lived experience. Every page should make that voice unmistakable within three seconds of scroll.

---

## 2. Page Inventory & Roles

Current public pages and their assigned role under this strategy.

| Route | Primary job | Status |
|---|---|---|
| `/` | Brand identity + curated proof of work + wayfinding | **Redesign** (see §3) |
| `/about` | Full founder story, mission, methodology depth | Keep — extend |
| `/category/[slug]` | Topical authority hub (all content types for a topic) | **Redesign** (see §4) |
| `/reviews` | Reviews index — discovery for reviews specifically | Keep |
| `/reviews/[slug]` | Single review — conversion + authority | Keep |
| `/reviews/category/[slug]` | Reviews filtered by category | **Deprecate** — fold into `/category/[slug]` |
| `/reviews/tag/[slug]` | Reviews filtered by tag | Keep — narrow utility surface |
| `/guides` | Guides index | Keep |
| `/guides/[slug]` | Single guide — utility + trust | Keep |
| `/stuff` | Branded merch + curated affiliate shop | Keep — clarify role vs. `/gear` |
| `/gear` | "What I personally use" — endorsement list without full reviews | Keep |
| `/bench` | Testing pipeline / wishlist — transparency | Keep |
| `/bench/[slug]` | Single wishlist item — pre-review interest capture | Keep |
| `/author/[username]` | Author profile | Keep |
| `/search` | Site search | Keep |
| `/how-we-test` | Methodology / trust page | Keep — link aggressively from reviews |
| `/editorial-standards` | Trust / transparency | Keep — link from About + footer |
| `/affiliate-disclosure` | Legal / FTC | Keep |

### Page-role matrix

| Page | Primary job | Belongs here | Doesn't belong here | Current redundancy / risk | Success signal |
|---|---|---|---|---|---|
| **Homepage** | Establish identity + send brand-curious traffic to depth | Identity hero, curated best work, trust signals, category wayfinding, newsletter | Latest-everything dump, full About text, social feed, news ticker | Today: too much "newest" weight, identity buried | High scroll depth + clicks into About, How We Test, or 1–2 hero pieces |
| **About** | Full story — first-time dad journey, faith, mission, why this site exists | Long-form founder story, photo, methodology summary, contact CTA | Latest reviews, product grids, newsletter as primary CTA | Today: under-utilized; homepage tries to do its job in compressed form | Time-on-page; click-through to a flagship review |
| **Category page** | Topical authority hub — all content types for one topic | POV intro, best reviews, best guides, top picks, seasonal block (if active), FAQ, archive link | Unfiltered chronological dump, generic "all categories" cross-promo | Today: behaves like a filtered review list; competes with `/reviews/category/*` | Visitor lands on category page from Google and stays in-category for 2+ pages |
| **Reviews index** | Discovery for users who want a review specifically | Filterable/sortable review feed, search, category nav | Editorial commentary, brand identity content, guides | Risk: drifting into homepage territory if we add too much "story" | Filter use rate; bounce-to-review-detail |
| **Review detail** | Conversion + authority on one product | Verdict, hands-on testing, pros/cons, affiliate CTA, related reviews/guides, methodology link | Unrelated product cross-sells, generic newsletter wall | Strong already | Affiliate click-through; scroll to verdict |
| **Guides index** | Discovery for utility-seeking readers | Filterable guide feed, category grouping | Reviews mixed in, identity-heavy hero | OK | Filter/category use; click into guide |
| **Guide detail** | Deliver utility; build trust for adjacent reviews | Long-form how-to, embedded product mentions where genuine, related reviews | Hard product sells, unrelated affiliate dumps | OK | Read-through; click into a referenced review |
| **Stuff** | Branded merch + curated affiliate shop surface | Boss Daddy merch, curated affiliate categories | Full reviews, founder story, guides | Risk: overlaps with `/gear` if roles aren't clarified | Click-through to product pages |
| **Gear** | "What I personally use" — daily-carry endorsement list | Short personal endorsements, no full reviews, affiliate links with disclosure | Full review depth, branded merch | Risk: blurs into `/stuff` — keep editorially distinct | Click-through; perceived authenticity |
| **Bench (wishlist)** | Transparency: what's being considered/tested next | Pipeline of items, brief rationale, "review coming" markers | Finished reviews, hard sells | Working as designed | Subscribers asking about pipeline items; pre-review interest |

---

## 3. Homepage Specification (priority order)

The homepage is the highest-leverage page on the site for brand-curious traffic. Sections are listed in **scroll order** and **priority** — the further down, the more cuttable.

### 3.1 Identity hero (must-have, top of page)
- One paragraph in first-person voice: who you are, why this site exists, what makes it different.
- Crystallized — not the full About story. ~3–5 sentences max.
- Anchor element: a real photo or signature visual. Not a stock illustration.
- One primary link: "Read my story →" → `/about`.

**Belongs:** founder voice, mission in one breath, photo, single link to About.
**Doesn't belong:** taglines without substance, generic "trusted reviews" boilerplate, multiple CTAs.

### 3.2 Proof of work (curated, not chronological)
- 3–4 hand-picked flagship pieces. Mix of reviews and guides.
- Picked for *quality and representativeness*, not recency. These are the pieces a stranger should read first.
- Update quarterly, not weekly.

**Belongs:** editor's-pick style cards with short why-this-matters blurb each.
**Doesn't belong:** "Latest 6 reviews" auto-feed, infinite scroll.

### 3.3 Trust signals
- Short row linking to: How We Test · Editorial Standards · Affiliate Disclosure.
- Optional: a stat or two (e.g., "X reviews, Y hours of hands-on testing"), but only if real.

**Belongs:** link row, methodology snippet.
**Doesn't belong:** logos of publications you haven't appeared in, fake testimonials.

### 3.4 Category wayfinding
- The site's top-level categories as a clean grid — these are doors to topical hubs (see §4).
- Use `shortLabel` per `lib/categories.ts`, unified treatment per brand guide.
- Each tile links to `/category/[slug]`, not `/reviews/category/[slug]`.

**Belongs:** top-level category grid, clear labels, optional one-line description per category.
**Doesn't belong:** every tag, archived/dormant categories, per-category color treatments.

### 3.5 Latest content (last, not first)
- A small "Recently published" strip — 3–4 items max.
- This serves *returning* visitors, who are the only people who care about recency on the homepage.
- Linked to `/reviews` and `/guides` indexes for the "see all" path.

**Belongs:** small recent-items strip with index links.
**Doesn't belong:** dominant feed, infinite scroll, mixed media types in one giant grid.

### 3.6 Newsletter capture (footer-adjacent)
- Single field, single CTA. Clear value prop ("monthly recap, no spam").
- After identity is established — never the first ask.

**Belongs:** clean form, value prop, link to past newsletter samples if available.
**Doesn't belong:** modal popups on entry, exit-intent overlays, second-screen takeovers.

### 3.7 Optional: Bench teaser
- One-line "What I'm testing next →" link to `/bench`. Reinforces transparency.
- Cut if it adds clutter.

### What the homepage is NOT
- An About page (that's what `/about` is for — link to it, don't duplicate it).
- A category index (the wayfinding section is a *door*, not the room).
- A reviews feed (that's `/reviews`).
- A news ticker (we don't do news — see Principle 3).

---

## 4. Category Page v2 Specification

This is the highest-leverage architectural change after the homepage. Today, category pages function as filtered review lists. They should be topical hubs.

### 4.1 Sections, in order

1. **Category POV intro** — 2–3 sentences in voice: what this category covers from a Boss Daddy perspective, what we look for, why we care. Acts as a mini-thesis statement.
2. **Best reviews in this category** — 3–6 hand-picked, not "latest." These are the definitive picks.
3. **Best guides in this category** — 2–4 utility guides (how-tos, buying advice, comparison frameworks).
4. **Top recommended picks** — 3–6 affiliate products surfaced from `/stuff` or `/gear` filtered to this category.
5. **Seasonal/timely block (conditional)** — only renders if a relevant seasonal campaign is active (e.g., "Father's Day Stroller Picks" in May–June). Otherwise omit entirely. **Not a news feed.**
6. **FAQ** — 4–8 common questions, structured for SEO (FAQ schema markup). Pulled from a per-category FAQ source.
7. **Full archive link** — "See all stroller reviews →" → `/reviews/category/[slug]` for users who want the chronological dump.
8. **Newsletter capture (category-specific, future)** — opt-in to category-tagged newsletter. Defer until newsletter segmentation is built.

### 4.2 Rules
- **Curated > chronological.** Editor's picks beat "newest first" on hub pages.
- **Cross-content-type by design.** A category hub mixes reviews, guides, and products — that's the whole point.
- **Deprecate `/reviews/category/[slug]` as a primary surface.** Keep it as the "full archive" link target but stop linking to it from nav. All category nav and homepage tiles point to `/category/[slug]`.
- **Per-category data lives in code, not Markdown.** POV intro, FAQ, picks, and seasonal blocks belong in `lib/categories.ts` (or a sibling file) so they're queryable and edit-controlled.

### 4.3 What a category page is NOT
- A chronological review feed (that's `/reviews/category/[slug]`).
- A search results page.
- A news/trends page (no news here).
- A duplicate of the guide index filtered by category (the hub *includes* guides; it doesn't replace `/guides`).

---

## 5. What we are explicitly NOT doing

State plainly so future "what about adding X?" conversations have a written answer.

| Rejected pattern | Why |
|---|---|
| Trending news / news ticker / "what's hot" feed | Treadmill that demands editorial staff we don't have. Loses to publishers built for it. Rots fast. |
| Per-category color/branding | Brand guide already says no — kept here for completeness. |
| Magazine-style homepage (latest-content feed) | Wastes the moment for brand-curious visitors who land on `/`. |
| Modal newsletter popups on entry | Hostile UX. Newsletter capture comes after value is delivered. |
| Per-category landing pages that duplicate `/category/[slug]` | One hub per category, full stop. |
| Forcing every page to "do everything" | Each page does one job. Cross-promotion happens through curated links, not section duplication. |
| Adding a generic "Blog" surface | We have Guides. The word "blog" never appears in user-facing copy (see brand guide). |

---

## 6. Implementation Roadmap

Ordered by impact-to-effort ratio. Each item is independently shippable.

### High impact

1. **Homepage redesign per §3.** Largest brand lever. Likely a single PR touching `app/(public)/page.tsx` and a few new components. Effort: **Medium**.
2. **Category page v2 per §4** — pilot one category first (suggest: strollers or whichever has the deepest content). Effort: **Medium–High** (data shape changes in `lib/categories.ts` + new section components). Once the pattern is proven, roll out to remaining categories.
3. **Deprecate `/reviews/category/[slug]` as a primary nav surface.** Update homepage tiles, top nav, and category nav to point at `/category/[slug]`. Keep the route alive as the "full archive" link target inside category hubs. Effort: **Low**.

### Medium impact

4. **About page extension.** Once homepage stops trying to do About's job, About has room to breathe. Add the full first-time-dad story, methodology depth, and a clearer contact path. Effort: **Low–Medium**.
5. **Clarify `/stuff` vs `/gear` editorial roles.** Both keep distinct copy at the top of each page so the user understands the difference. Cross-link, don't merge. Effort: **Low**.
6. **Per-category FAQ data + schema markup.** Drives long-tail SEO from category hubs. Effort: **Medium**.

### Lower impact / defer

7. **Seasonal block infrastructure.** Build only when the first seasonal campaign is real and on a calendar. Don't pre-build. Effort: **Medium**, defer.
8. **Category-specific newsletter segmentation.** Defer until base newsletter has consistent send cadence and audience size justifies segmentation. Effort: **High**, defer.

---

## 7. Maintenance

- Update §2 page inventory whenever a new public route is added or a route's role changes.
- Update §5 (rejected patterns) whenever a "should we add X?" conversation produces a "no" — so the same conversation doesn't happen twice.
- Quarterly review: are homepage proof-of-work picks still the right ones? Are category hubs still curated, or have they drifted back into chronological mode?

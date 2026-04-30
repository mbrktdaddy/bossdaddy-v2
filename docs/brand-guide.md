# Boss Daddy — Brand Guide

> Single source of truth for the Boss Daddy v2 design system. Update this file when design decisions change.
> Last revised: 2026-04-30

## 0. Naming & Vocabulary

User-facing content types are referred to consistently as:

| User-facing term | What it covers | Code/internal term |
|---|---|---|
| **Reviews** | Product reviews | `reviews` table, `Review*` types |
| **Guides** | All long-form editorial — how-tos, skills, advice, articles | `articles` table, `Article*` types (kept for now) |
| **Wishlist** | Pipeline of products being considered/tested | `wishlist_items` table |
| **Shop** | Boss Daddy branded merch | `shop_products` table |
| **Gear** | Curated gear list (the items I personally use) | `/gear` route |

**Important rules:**
- The user-facing term is **always "Guides"** in nav, headings, buttons, metadata, search results, dashboard labels, and any visible UI string.
- Internal code, types, file/folder names, DB tables, and variable names also use `guide` / `guides` (post-cleanup as of migrations 032 + 034).
- Never use the word "Blog" in user-facing copy. The site doesn't have a blog; it has Guides.
- When introducing new copy, prefer "guide" / "guides" (lowercase in body, title-case in headings/labels).

**Permanently kept (never rename):**
- **`shop_launch` email-interest tag** — stored on subscriber records. Renaming would orphan existing subscriber segmentation. New signups still use this tag.
- **`openGraph: { type: 'article' }` in page metadata** — W3C OpenGraph protocol value. `'guide'` is not a valid OG type; must stay `'article'` (or `'website'`) for social cards/SEO to render.

**Storage buckets:** `guide-images` (guides hero images), `review-images` (review hero images), `media` (product/media assets). All public read. Uploads use the service-role admin client.

**Rename gotchas — watch out next time we do a sweep like article→guide:**

These are non-obvious places that earlier regex sweeps missed during the article→guide rename. If we ever do another sitewide content-type rename, these are where to look first:

1. **JSX attribute values use double quotes** (`contentType="article"`) — different from JS/TS string literals (`'article'`). A regex targeting `'article'` (single-quoted) misses every JSX prop. Always run a second pass with `"article"` patterns and grep `="article"` and `={"article"}`.
2. **Email templates** (`emails/` directory) have their own `ContentType` union types. Easy to forget when listing files for a rename script — `emails/` lives outside `app/` and `components/` typical scope.
3. **DB CHECK constraints fire on UPDATE** — drop the old constraint *before* updating row values, then add the new constraint after. If you UPDATE first, the old constraint rejects the new value (error 23514). Migration 034 hit this; the fix is in its history if you need a template.
4. **`LIKE '_'` wildcard pitfall in PL/pgSQL renames** — underscore is a single-char wildcard in `LIKE`/`ILIKE`. Pattern `'shop_products%'` matches `'shop products'` (with space). Always use `ESCAPE '\'` when matching identifier names with underscores. Migration 033 hit this; bug fix is in its history.
5. **RPC function bodies referencing renamed tables** — Postgres updates SQL function dependencies on table rename in most cases, but PL/pgSQL functions and `LANGUAGE sql` functions can drift. Always include a `DROP FUNCTION IF EXISTS old; CREATE OR REPLACE new` block in the migration to be explicit.
6. **`openGraph: { type: 'article' }` is W3C protocol, not internal** — TypeScript types validate this. Don't rename. The string `'article'` here is a fixed external standard.
7. **Storage bucket names** are tied to every stored `image_url` column — see the deferred TODO above.
8. **API route folders + redirect ordering** — when renaming `/articles` → `/guides`, add the 301 redirect in `proxy.ts` *before* the rest of the page-level work so dev/preview environments don't 404 mid-refactor.

---

## 1. Brand Identity

### Mission
Boss Daddy is honest gear reviews and real-dad skills — for men who actually show up. Every product is self-purchased, every review is field-tested, every recommendation is earned.

### Voice
- First-person dad voice. Direct. No corporate speak.
- Reference real testing: "I used this for 3 weekends..." / "I built a fence with it."
- Zero sponsors. Zero fluff. 100% real. (This is the trust pill, the masthead, and the operating principle.)
- FTC affiliate disclosure auto-injected on reviews with affiliate links — never bypass.

### What we never do
- Use the default vivid Tailwind orange (`#f97316`). Our `orange-600` is `#CC5500` — earthy, not loud.
- Per-category rainbow colors. All categories share one unified treatment (`lib/categories.ts`).
- Sponsored content positioned as honest reviews.

---

## 2. Color System (Forge Base)

### Tokens — `app/globals.css`

| Variable | Hex | Usage |
|---|---|---|
| `--bd-bg` / `--color-gray-950` | `#0b0b0d` | Page background — neutral warm-black |
| `--bd-surface` / `--color-gray-900` | `#141418` | Card/panel surface |
| `--bd-surface-raised` / `--color-gray-800` | `#1c1c22` | Elevated surfaces |
| `--bd-border` / `--color-gray-700` | `#28282e` | Subtle borders (used sparingly) |
| `--bd-text` | `#f5f5f5` | Primary text on dark |
| `--bd-text-muted` | `#a8a8b0` | Secondary text |
| `--bd-text-faint` | `#6a6a72` | Tertiary / metadata |
| `--bd-orange` / `--color-orange-600` | `#CC5500` | **Primary brand accent** |
| `--bd-orange-light` / `--color-orange-500` | `#d96200` / `#d96200` | Hover state |
| `--color-orange-400` | `#e87030` | Accent text on dark |
| `--color-orange-700` → `--color-orange-950` | earthy scale | Borders, bg tints |
| `--bd-paper` | `#EDE6D3` | Cream — second voice for editorial moments |
| `--bd-paper-muted` | `#C9BFA8` | Cream muted |

### Tailwind utilities (mapped via `@theme inline`)
- `bg-gray-950` → page bg
- `bg-gray-900` → card surface
- `text-orange-500` → accent text
- `bg-orange-600` → primary CTA
- `text-gray-400` / `text-gray-500` / `text-gray-600` → text muted scale

### Status colors (wishlist + section indicators)
| Status | Color | Use |
|---|---|---|
| `testing` | `text-green-400` | Live testing pulse |
| `queued` | `text-blue-400` | Coming soon |
| `considering` | `text-orange-400` | Voting / pipeline |
| `reviewed` | `text-orange-500` | Done / shipped |

---

## 3. Typography

### Fonts (loaded via next/font in `app/layout.tsx`)
- **Display / Headings**: `var(--font-montserrat)` — heavy weight (`font-black` 900) for hero, `font-bold` 700 elsewhere.
- **Body / UI**: `var(--font-geist-sans)` — neutral grotesk.
- **Editorial body** (`.bd-editorial` prose): `var(--font-serif)` — serif voice for review/article body copy only.

### Type scale

| Element | Class | Notes |
|---|---|---|
| Hero H1 (homepage) | `text-6xl md:text-[7.5rem] leading-[0.92] tracking-tight` | "Dad Like a Boss." energy |
| Page H1 (listings) | `text-4xl md:text-5xl font-black tracking-tight` | Editorial weight |
| Section H2 | `text-2xl font-black` | Big-Quiet rhythm — sections stay quiet so content can breathe |
| Card H3 | `text-base font-semibold leading-snug` | Card titles |
| Hero/Featured H3 | `text-2xl md:text-3xl font-black` | Featured-card titles |
| Body | `text-base leading-relaxed` | 16px, comfortable line-height |
| Small / metadata | `text-sm text-gray-500` | |
| Eyebrow | `text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold` | Editorial section opener |
| Tracked caps utility | `text-xs uppercase tracking-widest font-semibold` | Used on "View all →" links, eyebrow lines |

### Numerical type
- Always use `tabular-nums` on numeric data (counts, ratings, dates with numerals, index numbers).
- Index/TOC numbers: `01 02 03` format (`String(i+1).padStart(2, '0')`) with `tabular-nums tracking-[0.2em]`.

### Letter-spacing rules
- Big display (>72px): `-0.035em` to `-0.05em` (tighter as size grows).
- Small caps eyebrows: `tracking-[0.18em]` to `tracking-[0.2em]` (open them up).
- Body / UI: default Tailwind tracking.

### Eyebrow voice — em-dash prefix
All section eyebrows lead with an em-dash:
```
— JUST IN
— THE GEAR
— THE FIELD NOTES
— REVIEWS / OUTDOORS
— THE BOTTOM LINE
```
Magazine-cover detail. Single character, big editorial signal.

---

## 4. Shape Language

### Corner radius
- **Cards, panels, buttons, inputs**: `rounded-2xl` (16px). One number, used everywhere.
- **Pills**: `rounded-full` (badges, filter buttons, status pills).
- **Small avatar / image holder**: `rounded-2xl` on hero card swatches; `rounded-full` on user avatars.

We tested 0px, 4px, 8px, 16px, 24px and landed on 16px for the right balance of *modern* and *not blocky*. Sharper than 16px reads cold; softer reads consumer.

### Border principle — Shadow Skin
Cards have **no borders**. Visual separation is achieved through:
1. Elevation (drop shadows)
2. Surface-color contrast (`bg-gray-900` on `bg-gray-950` page)
3. Whitespace

Borders survive only on:
- Small badge pills (`border-orange-800/50` on hero trust pill etc.)
- Form inputs that need clarity (the newsletter input)
- The brand horizontal architectural rule (orange hairline at top of Featured Review section)
- The 3px vertical orange rule next to section headers

### Shadow scale
| Class | Use |
|---|---|
| `shadow-md shadow-black/30` | Subtle — small inline elements, pills, list rows |
| `shadow-lg shadow-black/40` | Standard cards (review/article/wishlist) |
| `shadow-xl shadow-black/40` | Feature cards (Featured Review, hero cards, callouts) |
| `shadow-xl shadow-black/60` | Card hover state |

---

## 5. Layout System

### Page structure
- **Container**: `max-w-6xl mx-auto px-6` (1152px max width, 24px gutter).
- **Section padding**: `py-16` (64px) standard; `py-20`/`py-24` for hero/headline sections.
- **Card grid gap**: `gap-5` (20px).

### Big-Quiet rhythm
- Hero H1 carries the brand statement at near-display-size (96-120px on desktop).
- Section H2s stay quiet (`text-2xl` = 24px) so editorial *content* (review titles, article headlines) carries equal weight.
- Hero hits, sections breathe, content earns attention.

### No alternating-BG
The whole site sits on the uniform base bg (`bg-gray-950`). Section separation comes from:
- Whitespace (consistent section padding)
- Shadow elevation on cards
- Architectural rules where deliberate

The only exceptions:
- **Hero**: hybrid radial + linear orange gradient overlay (homepage only).
- **Featured Review section** (homepage): single orange hairline rule at the top fading at edges, plus a 3px vertical orange rule next to the section header.

### Hero composition (homepage)
- Centered, single-column layout (no asymmetric carousel right).
- Trust pill → H1 → subhead → CTAs (4 elements, each doing one job).
- Hero gradient overlay (atmospheric):
  ```css
  background:
    radial-gradient(ellipse 70% 60% at 50% -10%, rgba(204,85,0,0.18), transparent 70%),
    linear-gradient(180deg, rgba(204,85,0,0.10), transparent 70%);
  ```

### Section opener pattern (sitewide)
Every meaningful section uses this structure:
```jsx
<div className="flex items-stretch gap-4">
  <div className="w-[3px] bg-orange-600 rounded-full" />
  <div>
    <p className="text-[11px] text-orange-500 uppercase tracking-[0.18em] font-bold mb-1">— Eyebrow</p>
    <h2 className="text-2xl font-black text-white">Section Heading</h2>
    <p className="text-sm text-gray-500 mt-1">Optional subtitle</p>
  </div>
</div>
```
With an optional right-aligned `View all →` link in tracked caps.

### Closing (homepage)
The page ends with a deliberate punctuation:
- 24px-wide centered orange hairline rule above
- `— THE BOTTOM LINE` eyebrow
- `text-3xl md:text-5xl font-black` closing tagline
- `py-24 md:py-32` generous padding

---

## 6. Component Patterns

### Card skeleton (review / article / wishlist / shop)
```jsx
<Link
  href="..."
  className="group flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200"
>
  {/* Image — 44 height, object-cover, hover scale */}
  <div className="relative w-full h-44 bg-gray-800 shrink-0">
    <Image ... className="object-cover group-hover:scale-105 transition-transform duration-300" />
    {/* Boss Approved badge top-right when rating >= 8 */}
  </div>
  <div className="p-5 flex flex-col flex-1">
    {/* Top row: product/category pill + rating score */}
    <div className="flex items-center justify-between mb-3">
      <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full truncate max-w-[60%]">
        {productName}
      </span>
      <RatingScore rating={rating} />
    </div>
    <h3 className="text-base font-semibold leading-snug text-white group-hover:text-orange-400 transition-colors flex-1">
      {title}
    </h3>
    <p className="text-gray-500 text-sm mt-2 line-clamp-2">{excerpt}</p>
    {/* Foot row: date + action link (no border-t) */}
    <div className="flex items-center justify-between mt-4 pt-4">
      <span className="text-xs text-gray-600">{date}</span>
      <span className="text-xs text-orange-500 font-medium">Read review →</span>
    </div>
  </div>
</Link>
```

### Featured (horizontal hero) card pattern
- `flex flex-col md:flex-row` — image left 50%, content right
- Image gets `Featured` orange pill badge top-left
- Larger H3 (`text-2xl md:text-3xl font-black`)
- 3-line excerpt (`line-clamp-3`)
- More generous padding (`p-8 md:p-10`)

### Filter pills
```jsx
{/* Active */}
className="px-4 py-2.5 rounded-full text-sm font-semibold bg-orange-600 text-white shadow-md shadow-black/30"

{/* Inactive */}
className="px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40 transition-all"
```

### Buttons
- **Primary** (CTAs): `bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-2xl px-6 py-3`
- **Secondary**: `bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-semibold rounded-2xl px-6 py-3` (no border)
- **Tertiary / link**: `text-orange-500 hover:text-orange-400 transition-colors` (text-only)
- **Tracked-caps action link**: `text-xs text-gray-500 hover:text-orange-400 transition-colors uppercase tracking-widest font-semibold`

### Index numbers (More Reviews TOC treatment)
```jsx
<span className="absolute top-3 left-3 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-orange-400 text-[10px] font-bold tracking-[0.2em] tabular-nums">
  {String(i + 1).padStart(2, '0')}
</span>
```
Magazine table-of-contents detail. Used on the More Reviews grid on the homepage.

### Empty states
```jsx
<div className="text-center py-24 bg-gray-900/40 rounded-2xl">
  <p className="text-gray-500 text-lg font-semibold">No items here yet.</p>
  <p className="text-gray-600 text-sm mt-2">Check back soon, Boss.</p>
</div>
```
No dashed borders. Soft panel that reads as "this is intentional" not "this is broken."

### Boss Approved badge
- Card variant: top-right of card image when `rating >= 8`.
- Component: `components/BossApprovedBadge.tsx`.

---

## 7. Iconography

- **Categories**: emoji-based (👶 🏕️ 🛠️ 👨‍🍳 💪 🎮 🎒). Source of truth: `lib/categories.ts`.
- **Status indicators**: small colored circle (`w-2 h-2 rounded-full`) + animated pulse for "live" feels.
- **Inline UI**: no icon library — minimal, type-led.

---

## 8. Hero Patterns by Page

### Homepage (`app/(public)/page.tsx`)
- Centered hero with hybrid radial+linear orange gradient.
- Story-led narrative: Hero → Featured Review → Stats (inline-removed) → On Deck → Articles → Categories → More Reviews → Shop → Newsletter → Closing.

### Listing pages (`/reviews`, `/articles`, `/wishlist`, `/gear`)
- Page header pattern: eyebrow + h1 + count line. No hero gradient.
- Filter pills below header (where applicable).
- Section openers use the vertical orange rule pattern.

### `/gear` — unified Gear + Merch page
- "Shop" is **not** a separate top-level concept. The unified `/gear` page hosts both:
  1. **Boss Daddy Approved Gear** — the curated top-rated picks from reviews (rating ≥ 8.0). The substance.
  2. **Made by Boss Daddy** — featured panel for branded merch, sits between the category filter and the gear grid. Renders a tight coming-soon callout when no merch is live; renders a 3-up product grid when products are available.
- Hero copy: *"Boss Daddy Approved Gear"* H1 + *"Field-tested by a real dad. And, soon, made by one."* tagline.
- `/shop` 301-redirects to `/gear` for SEO + bookmark continuity.

### Detail pages (`/reviews/[slug]`, `/articles/[slug]`)
- Article header with rating + meta (no border-b under it — spacing carries).
- Hero image at `rounded-2xl`.
- Pros/Cons cards in green-950/30 + red-950/30 backgrounds, no borders, `shadow-md`.
- ProductCtaCard: `bg-gradient-to-br from-orange-950/60 to-gray-900`, `shadow-xl shadow-black/40`.
- Author bio at the end uses shared `<AuthorBio />` component.
- Related reviews/articles sidebar (xl breakpoint+) uses the standard card pattern.

### Static / legal pages (`/about`, `/terms`, `/privacy-policy`, etc.)
- Inherit Forge Base palette globally.
- No card system needed — text-led pages.
- `prose prose-invert prose-orange max-w-none` for body copy.

---

## 9. File Reference

### Source of truth files
| Concern | Path |
|---|---|
| Color tokens, gray scale, fonts | `app/globals.css` |
| Categories (slug, label, icon, color, accent) | `lib/categories.ts` |
| Wishlist statuses + helpers | `lib/wishlist.ts` |
| Claude AI brand voice (system prompt) | `lib/claude/client.ts` |
| Project rules / agent context | `CLAUDE.md` |
| Brand assets (logos, placeholders) | `public/images/` |

### Shared component locations
| Component | Path | Used by |
|---|---|---|
| `BossApprovedBadge` | `components/BossApprovedBadge.tsx` | Card images, review headers |
| `RatingScore` | `components/RatingScore.tsx` | All review cards/details |
| `ProductCtaCard` | `components/ProductCtaCard.tsx` | Review detail pages |
| `AuthorBio` | `components/AuthorBio.tsx` | Article + review detail |
| `EmailSignup` | `components/EmailSignup.tsx` | Newsletter sections |
| `Header` / `Footer` | `components/Header.tsx`, `Footer.tsx` | Site shell |
| `ReviewCard` | `app/(public)/reviews/_components/ReviewCard.tsx` | `/reviews`, homepage |
| `ArticleCard` | `app/(public)/articles/_components/ArticleCard.tsx` | `/articles`, homepage |
| `WishlistCard` | `components/wishlist/WishlistCard.tsx` | `/wishlist` |

---

## 10. Design Decision Log

A short history of key choices and why — useful when reconsidering trade-offs later.

| Decision | Rationale |
|---|---|
| **Forge Base palette** (neutral warm-black, not brown-warm) | After A/B with 14 alternative palettes (Ranger heritage, Atlas navy, Voltage electric, Hearth domestic, Graphite mono, Trophy hunter green, Ember oxblood, etc.), Forge's earthy orange + neutral dark won for workshop/honest-craftsman feel without going too cold. |
| **16px corners** (`rounded-2xl`) | Tested 0/2/4/8/12/16/20/24px live. 8px felt too blocky in real context; 16px holds the modern-friendly feel without going consumer-soft. |
| **Inter Black 900 → kept Montserrat in production** | Inter Black tested as the heading font in prototypes but the deployed site uses Montserrat (already loaded). Tested Anton/Bebas/Oswald/Archivo Black/Playfair/Fraunces — sans-bold won over condensed/serif alternatives. |
| **Hybrid hero gradient** (spotlight + linear) | A/B between Spotlight Bright/Soft/Wide, Linear Strong/Soft, and Hybrid. Hybrid keeps the centered focal point AND the even top-down wash. |
| **Shadow skin** (no card borders) | Tested hairline, hairline-strong, chunky 2px, shadow, float, inset-glow. Shadow won for being "modern SaaS without losing tactical edge." |
| **Big-Quiet rhythm** (104px hero + 24px sections) | A magazine-cover hero with restrained section headings so editorial content (review titles) carries equal weight. Tested against 5 other rhythms (Quiet/Confident/Statement/Display/uniform). |
| **Sweet density** (1140px container, 64px sections) | Between Current and Roomy. Pairs naturally with Big-Quiet — small section headings need surrounding space to feel intentional. |
| **No alternating BG** (was tested + dropped) | Initial alternating-tint pattern felt amateurish in real context. Replaced with architectural top-rule + vertical accent-rule on Featured Review section only. |
| **Architectural treatment, not atmospheric** | When two adjacent sections need different emphasis, change the *type* of treatment — don't just turn the dial up or down on the same effect. (Hero is atmospheric gradient; Featured Review is architectural rules.) |
| **Featured Review card on homepage** | Promotes one specific review to magazine-cover treatment. The rest of the section becomes "More Reviews" grid below. Creates real hierarchy where uniform 3-up grids had none. |
| **Story-led page reorder** | Hero → Featured Review → Stats → On Deck → Articles → Categories → More Reviews. Categories demoted from primary content to mid-page browsing aid. |
| **On Deck section pulls 3 statuses** | testing/queued/considering blended with status pills so the section always renders 3 items balanced. |
| **Inline mini-stats deleted from hero** | Trust pill at the top already carries the "no sponsors" signal. Repeating as numbers is redundant. |
| **HeroCarousel deleted** | Featured Review section directly below was carrying the proof. Centered hero composition is more confident. |

---

## 11. How to Maintain This Guide

- When you make a design decision in a session (color, type, spacing, component pattern), come back here and update the relevant section.
- Add to the **Design Decision Log** when reconsidering or reversing a previous choice — don't just rewrite. The history is valuable.
- Keep file references current. If a component moves, update the path in §9.
- This file is checked into the repo. Treat changes like code changes — descriptive commit messages.

---

## 12. Quick Reference (cheat sheet)

```
Page bg          bg-gray-950 / #0b0b0d
Card surface     bg-gray-900 / #141418
Brand accent     #CC5500 (text-orange-500 / bg-orange-600)
Text             #f5f5f5 / text-muted #a8a8b0 / text-faint #6a6a72

Cards            bg-gray-900 rounded-2xl shadow-lg shadow-black/40
Cards hover      hover:shadow-xl hover:shadow-black/60
Featured cards   shadow-xl shadow-black/40
Empty state      bg-gray-900/40 rounded-2xl

Hero H1          text-6xl md:text-[7.5rem] leading-[0.92] tracking-tight
Page H1          text-4xl md:text-5xl font-black tracking-tight
Section H2       text-2xl font-black
Eyebrow          text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold
                 (prefix with em-dash: "— Just In")

Section opener   3px vertical orange-600 rule + eyebrow + h2

Container        max-w-6xl mx-auto px-6
Section padding  py-16
Card grid        gap-5
Numbers          tabular-nums
```

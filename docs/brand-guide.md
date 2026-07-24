# Boss Daddy — Brand Guide

> Single source of truth for the Boss Daddy v2 design system. Update this file when design decisions change.
> Last revised: 2026-07-24 (v3.5 — "The Boss Dad Standard" positioning; design sections reconciled to shipped reality)

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

### 1.1 Mission Statement
Boss Daddy's mission is to be the gold standard and trusted hub for men of all ages committed to being the ultimate dads — strong, present, and proud fathers their families deserve.

Rooted in an uncompromising duty to God, Family, and Faith, we stand for honesty, loyalty, and brotherhood. Through smart tools, honest reviews, practical guides, and real brotherhood, we help dads make better decisions and lead with strength, pride, and purpose — because being a proud and present father isn't a compromise of his strength, but the ultimate expression of it.

### 1.2 Positioning & Brand Essence
**Positioning (who we are):** *The Boss Dad Standard* — the identity line. Boss Dads aren't a softer kind of man; they live to a standard: present, proud fatherhood as the ultimate expression of strength.

**Essence (one-liner):** *Boss Daddy — the gold standard and trusted hub for men who Dad Like a Boss.*

### 1.3 Core Values
1. **Faith-First Leadership** — Uncompromising duty to God, family, and faith as the foundation for family leadership and meaningful purpose.
2. **Honesty** — Transparent reviews, informative guides, real talk. No fluff, no sponsored BS.
3. **Loyalty & Brotherhood** — A tight community for men who support and challenge each other like brothers.
4. **Present & Proud** — Strong, fully present, and proud fathers every day.
5. **Pursuit of Excellence** — Always pursuing the highest standards and expectations in all that we do.

> *Community is brand positioning today; product features ship later. The guide describes where we're going.*

### 1.4 Target Audience
- **Primary**: Fathers aged 25–55 — new dads through seasoned ones — who want to level up as leaders.
- **Secondary**: Aspiring fathers, young men seeking mentorship, and grandfathers passing wisdom.
- **Psychographics**: Value faith, family, competency, wisdom, and traditional masculine virtues. Seek practical tools, smart tech, community, and accountability. Frustrated with modern "soft" masculinity and mediocrity but want balanced strength — the protector who is both provider and nurturer.

### 1.5 Brand Personality Archetype
**The Wise Warrior / Protector King** — a strong, stoic patriarch who leads by example and isn't afraid to tell it like it is.

**Core traits:** Authoritative yet approachable. Confident, competent, disciplined, no-nonsense. Inspiring. Trustworthy. Loving and warm toward family. Brings humor and playfulness with a playfully cynical, borderline-condescending edge — the experienced dad who's seen it all and lightly roasts mediocrity while still having your back.

### 1.6 Tone of Voice

**Two registers — know which one you're in.** Boss Daddy speaks in two voices, and copy fails when they collide:
- **Declarative register (brand statements)** — the elevated, confident voice of the positioning line, manifesto, hero, creed, and pull-quotes. Short, absolute, no hedging: *"The Boss Dad Standard." "…the ultimate expression of it."* This is the brand announcing itself. Sanctioned brand phrases ("The Boss Dad Standard," "Boss Up.") live here.
- **Brotherly register (editorial body)** — the first-person, tough-loving older-brother voice for reviews, guides, emails, and everyday copy. Specific, warm, a little cynical toward mediocrity. This is one dad talking to another.

Declarative is for **display moments only** — heroes, taglines, creed, sign-offs. Everywhere else, write brotherly. Never staple a marketing tagline into the middle of a review. The rules below govern the brotherly register (the one you write in 95% of the time).

**Personality voice:**
- Direct and clear — no corporate jargon, no fluff.
- Encouraging but tough-loving and playfully humorous ("You've got this, brother… but don't screw it up.").
- Playfully cynical toward soft culture, weak excuses, and participation-trophy parenting — delivered with a smirk and brotherly intent.
- Grounded in faith without being preachy or overbearing.
- Proud but humble — celebrate real wins, share honest struggles, call men higher.
- We speak like the older, wiser brother who wants you to win — equal parts motivation, accountability, and banter.

**Operational voice rules** *(execution layer — these run in the Claude system prompt and editorial review):*

*Voice mechanics*
- First-person always: "I used this for 3 weekends," "I built a fence with it."
- Active voice. No hedge words (may/might/could). No vague time refs ("recently," "lately").
- Sentences 15–25 words. Paragraphs 3–5 sentences. Lead with the useful info, not background.
- Address the reader as a peer: "Brother," "Friends," "Fellow Dads," direct "you." `BOSS` as noun-of-address sparingly.
- Direct openers welcome: "Here's the deal:", "Bottom line:", "Real talk:".

*Banlist — never use*
- Hype phrases: "revolutionary." Hype is for mediocrity.
- Corporate jargon: "leverage" (as verb), "synergy," "circle back," "stakeholder," "deep-dive," "ecosystem."
- Sponsored-content phrasing: "in partnership with," "thanks to our friends at," "brought to you by."
- Soft-parenting tells: "every child is unique," "no judgment," "you do you."

*Sanctioned brand language (v3.5 — NOT hype, do not flag)*
- **"The Boss Dad Standard"** and **"Boss Up."** are brand-owned messaging (see §1.7), not banned swagger. Use "The Boss Dad Standard" as the positioning line; use "Boss Up." as the action/CTA verb. Don't spray them through body copy as filler — that's what makes hype hype.

*"Boss Dads" — identity term, never an address*
- **"Boss Dads" is a third-person identity/positioning term** (brand → world): "the hub for Boss Dads," "men living The Boss Dad Standard." ✅
- It is **never a second-person address** (writer → reader). "Hey boss dads," / "Listen up, boss dads" ❌ — still off. But direct peer address **is** welcome (v3.5): "Brother," "Friends," "Fellow Dads," "you." Address the reader one brother to another; just don't christen the audience with the brand name. See [[feedback_no_reader_nicknames]].

*Specificity — always required*
- Every claim has specifics: durations ("4 hours of continuous use"), conditions ("18°F garage, no insulation"), outcomes ("zip-tied in under a minute").
- Reviews require a real-testing reference: "I used this for X," "I ran this through Y."
- Self-purchased + field-tested is not a slogan — it's a fact-check rule. Don't review what you didn't buy and use.

*Humor calibration*
- One dad joke per piece, max. Earn it.
- Playfully cynical edge aims at *mediocrity, soft culture, weak excuses, participation-trophy parenting* — never at individual dads who are struggling, asking, or learning.
- When in doubt, see "Where the edge is OFF" below — default to warm Protector mode.

*Faith mentions*
- Faith and family-as-foundation referenced naturally when it fits ("we lead our households," "what we owe our wives and kids").
- Never preach. No scripture dropped without context. No moralizing about other men's choices.
- Faith content earns its own posture — warm and grounded, not cynical.

*Trust & legal*
- Zero sponsors. Affiliate is fine, disclosed, and earned. Sponsored placement positioned as honest review is forbidden.
- FTC affiliate disclosure auto-injected on reviews with affiliate links — never bypass.
- Brotherhood-direct addresses ("Brother," "BOSS") never used in legal or safety content.

**Where the edge is OFF — switch to warm Protector mode:**
The playfully cynical / borderline-condescending edge is OFF and warmth/presence is ON when:
- Talking to first-time dads who are genuinely struggling or overwhelmed.
- Topics involving loss, mental health, marriage strain, or fatherhood grief.
- Faith content where someone is wrestling, not coasting.
- Safety-critical guidance — car seats, infant sleep, water safety, firearms in the home.
- Replies to a reader who came in vulnerable. Meet them where they are; don't roast them.

The edge exists to call up men who are *coasting*. It is never aimed at men in the trenches.

### 1.7 Messaging System & Wordmark Usage (v3.5 — locked 2026-07-24)

The Boss Daddy messaging system is a **five-level hierarchy**. Each line has a distinct job — don't swap jobs, don't blend them into one line. Use them together in the recommended lockups below.

> **The literal strings are canonical in code at `lib/brand.ts`** (imported by the UI + metadata). Treat the lines here as the human-readable spec; if you change a line, change it in both places.

| Level | Element | Line | Purpose | Primary usage |
|---|---|---|---|---|
| **Positioning** | Main identity | **The Boss Dad Standard** | Who we are + status | Hero sections, logo lockup, major branding, video intros, social bios |
| **Primary Tagline** | Rallying cry | **Dad Like a Boss.** | Action + emotional hook | Campaigns, CTAs, merch, social, article sign-offs |
| **Action Line** | Motivational CTA | **Boss Up.** | Call to action & growth | Community, emails, challenges, button text |
| **Credibility Line** | Trust builder | **Real Dads. Smart Tools. Better Decisions.** | Honesty & value proof | Reviews, guides, product pages, footer trust bar, "How We Test" |
| **Philosophy** | Manifesto | *(full statement below)* | Core belief & differentiation | About page, founder story, welcome sequence, long-form/sales pages |

**Philosophy / Manifesto (canonical wording — do not paraphrase in hero/about placements):**
> Boss Daddy isn't just another men's fashion, fitness, or lifestyle brand. It is the gold standard and trusted hub for men living The Boss Dad Standard — men who believe being a proud and present father who shows up every day isn't a compromise of strength, but the ultimate expression of it.

> *Scope note:* the "fashion, fitness, or lifestyle" phrasing is **contrast/positioning framing only** — it elevates us above generic lifestyle brands. It is **not** a commitment to ship fashion or fitness content pillars. The content roadmap (reviews, guides, gear, community) is unchanged.

**Usage guidelines — how the lines work together:**

*Homepage hero lockup:*
```
The Boss Dad Standard.

Dad Like a Boss.

Real Dads. Smart Tools. Better Decisions.
```

*About page structure:* Hero → **The Boss Dad Standard.** · Sub-head → **Dad Like a Boss.** · Body → full Philosophy statement · Trust block → **Real Dads. Smart Tools. Better Decisions.**

*Social / email:* Lead with **The Boss Dad Standard.**, support with **Dad Like a Boss.**, close the CTA with **Boss Up.**

*Email specifics:* the **welcome sequence** carries the full manifesto (it's the "our why" moment). Use **"Boss Up."** as an action-oriented subject-line / challenge verb. Sign off editorial and newsletter emails with **"Dad Like a Boss."** Keep the declarative register for these display moments; the body of the email is still brotherly. (Note: email templates render light, not dark — see §2.)

**Merch / Shop voice (context-specific — sits outside the core five):**
- **"Boss Stuff for Boss Dads"** — the merch/shop tagline. Use only in store, product, and merch-graphic contexts. It does a job the core system doesn't; keep it scoped to the shop so it doesn't dilute the positioning lines.

**Capitalization rule (v3.4 — Title Case wins):**
- The five core lines and the merch line are written in **Title Case with periods** — e.g. *The Boss Dad Standard.* / *Dad Like a Boss.* / *Boss Up.* Lowercase the articles ("a," "the") per Title Case. The periods give punch without shouting. **Do not** set these lines in all-caps or cap `BOSS` mid-line (retired: the old "Dad like a BOSS" emphasis).
- **All-caps `BOSS DADDY` is reserved strictly for the wordmark/logo lockup.** Do not all-caps the brand name in hero H1s, taglines, OG cards, email banners, or body copy.
- **Title-case `Boss Daddy`** everywhere else the name is referenced — editorial body, in-narrative mentions ("Boss Daddy was built because…"), reviews, guides, dashboards.
- Never lowercase. Never camel-case ("BossDaddy") except in code/file/identifier contexts.
- `BOSS` alone may still be used in caps as a rare noun of address ("Stay locked in, BOSS.") — the one sanctioned exception, sparingly, never as filler.

**Brand vocabulary — "Stuff":**
"Stuff" is a brand-personal colloquialism — the casual word for "things a dad wants, needs, or uses." Lean into it:
- *"The good stuff"* — what we recommend (newsletter, intros, hooks)
- *"Boss stuff"* — branded merch and curated picks
- *"Dad stuff"* — categories and editorial framing
- *"More stuff"* — tongue-in-cheek about always wanting more
- *"Boss Stuff for Boss Dads"* — merch tagline (see above)

"Stuff" is the brotherly counterpart to formal terms (products, items, merch). Use it to keep editorial copy grounded and conversational. Use formal terms in legal, structured, or admin contexts.

**Brand vocabulary — "Boss Up":**
"Boss Up." is the action/CTA verb of the messaging system (see the table above) — it means *level up, take action, show up stronger*. Use it to rally, not to describe:
- CTAs and buttons: *"Boss Up Your Gear," "Boss Up and join the crew."*
- Email subject lines, community prompts, and challenges.
- Merch — standalone or paired with the logo.

Keep it a display/CTA line — don't drop "boss up" into the middle of editorial prose as filler (that's what makes hype hype). Title Case with a period when it stands alone: *Boss Up.*

### 1.8 What we never do
- Use the default vivid Tailwind orange (`#f97316`). Our accent is `#E55A1A` (Hot, on dark) / `#CC5500` (core) — warm and earthy, never the loud default.
- Per-category rainbow colors. All categories share one unified treatment (`lib/categories.ts`).
- Sponsored content positioned as honest reviews. Affiliate is fine and disclosed; sponsored is not.
- Preach faith — it's the foundation, not the lecture.
- Punch down on struggling dads. The edge is for mediocrity, not for men in the trenches.

---

## 2. Color System (Dark-First — 2026-06)

The site is **dark-first everywhere** (`data-theme="dark"` on `<html>` in `app/layout.tsx`). Near-black canvas, elevated charcoal surfaces, off-white text. Brand orange is the ONLY accent — shifted to **Hot `#E55A1A`** on dark (the core `#CC5500` reads muddy on near-black). No gold, no per-type rainbow, no cream/peach/brown. The light values in `:root` are a vestigial opt-in base (emails/print) — app chrome never renders light.

> **Elevation comes from borders + raised surfaces, NOT shadows.** Black drop-shadows are invisible on near-black; use `border-soft` (+ `hover:border-strong`/`hover:border-accent`) and the raised surface tiers.

### Tokens — `app/globals.css` (dark values)

| Variable | Hex (dark) | Usage |
|---|---|---|
| `--bd-chrome` / `--color-chrome` | `#09090b` | Masthead / footer / bottom-nav — flush with canvas |
| `--bd-bg` / `--background` | `#09090b` | Page canvas (zinc-950) |
| `--bd-surface` / `--color-surface` | `#18181b` | Card/panel surface, reading panel (zinc-900) |
| `--bd-surface-raised` | `#27272a` | Elevated cards, alt sections, logo tiles (zinc-800) |
| `--bd-surface-hover` / `--color-surface-hover` | `#3f3f46` | Interactive hover lift (zinc-700) |
| `--bd-surface-sunken` | `#09090b` | Wells, recessed (zinc-950) |
| `--bd-border` / `--color-soft` | `#27272a` | Hairlines, card edges (zinc-800) |
| `--bd-border-strong` / `--color-strong` | `#3f3f46` | Confident edges (zinc-700) |
| `--bd-text` / `--foreground` | `#f4f4f5` | Body text (zinc-100) |
| `--bd-text-muted` | `#d4d4d8` | Captions, muted nav (zinc-300) |
| `--bd-text-faint` | `#71717a` | Timestamps, decorative (zinc-500) |
| `--bd-orange` / `--color-accent` | `#E55A1A` | **Primary brand accent — Hot, on dark** |
| `--bd-orange-hover` / `--color-accent-hover` | `#CC5500` | Button hover (core orange) |
| `--bd-orange-text` / `--color-accent-text` / `--color-eyebrow` | `#f48a4a` | Inline links / eyebrows on dark (orange-400) |
| `--bd-accent-tint` / `--color-accent-tint` | `#27272a` | Brand-territory surface (zinc-800) |

### The surfaces (dark)

1. **Chrome** (`--color-chrome`, #09090b) — masthead/footer/bottom-nav; flush with canvas, separated by border + blur. (Replaced the legacy `--color-drama`.)
2. **Canvas** (`--bd-bg`, #09090b) — page background.
3. **Surface** (`--bd-surface`, #18181b) — cards; the long-form reading panel on phone/tablet.
4. **Raised** (`--bd-surface-raised`, #27272a) — elevated cards, alt-section bands, logo tiles.
5. **Hover** (`--bd-surface-hover`, #3f3f46) — interactive hover lift.

### Tailwind utilities (mapped via `@theme inline`)
- `bg-chrome` → masthead / footer / bottom-nav
- `bg-background` → page canvas
- `bg-surface` / `bg-surface-raised` / `bg-surface-hover` → surface tiers
- `text-prose` / `text-prose-muted` / `text-prose-faint` → text tiers
- `text-accent` → inline orange text/links · `bg-accent` / `bg-accent-hover` → CTA buttons
- `border-soft` → card edges · `border-strong` → confident edges

### Reading surface (reviews / guides)
Long-form body sits on an elevated **panel below `lg`** (phone/tablet — no margin to frame, OLED halation worst) and **bare canvas at `lg+`** (desktop margins frame the column). Single source of truth: `ARTICLE_SURFACE_CLASS` in `lib/article-surface.ts`. Body is **sans**; the *body* editorial serif (Source Serif 4) is reserved for blockquotes/pull-quotes only. The *display* editorial serif (Fraunces via `.font-editorial-display`) is used for editorial headings per the Manifesto v2 exception (§3). Article images get a subtle frame (`border` + rounded) so white-bg product shots don't glare.

### Status colors (chips / pipeline indicators on dark)
| Status | Color | Use |
|---|---|---|
| `testing` | `text-green-400` | Live testing pulse |
| `queued` | `text-blue-400` | Coming soon |
| `considering` | `text-amber-400` | Voting / pipeline |
| `reviewed` | `text-accent` | Done / shipped |

For bordered chips prefer the token recipe (`bg-{danger,success,warn,info}-bg` + `border-…-line` + `text-…-ink`) — it inverts correctly on dark.

### The accent band (replaced the dark-island rule)
Everything is dark now, so the old "one dark island per page" rule is retired. Its successor: **one elevated accent band** per page (e.g., the homepage TrustBand) — `bg-surface-raised` + a 3px orange top rule — as the single punctuating moment.

### The section header convention
Every section heading sitewide uses the same shape: a 3px × 18px brand-orange vertical rule + uppercase tracked label, optional right-side link. Use the `SectionHeader` component — do not inline this pattern.

---

## 3. Typography

### Fonts (loaded via next/font in `app/layout.tsx`)
- **Display / Headings (default)**: `var(--font-montserrat)` — heavy weight (`font-black` 900) for hero, `font-bold` 700 elsewhere. Default for every `h1–h4` via the global rule in `globals.css`.
- **Editorial display serif (Manifesto v2)**: `var(--font-editorial-display)` = **Fraunces**. **Scoped opt-in** via the `.font-editorial-display` class — see the exception below. Carries the magazine / "cover story" voice.
- **Body / UI**: `var(--font-geist-sans)` — neutral grotesk.
- **Editorial body** (`.bd-editorial` prose): `var(--font-serif)` = Source Serif 4 — serif voice for review/article **blockquotes / pull-quotes only**.

> **Editorial-serif heading exception (Manifesto v2, 2026-07-06).** The prior rule ("all headings are `font-black` Montserrat; serif is pull-quotes only") is amended. Headings still **default** to Montserrat `font-black`; specific **editorial** headings opt into Fraunces with `font-editorial-display font-semibold`. Allowed ONLY on: homepage Cover Story H2/H3, `EditorialHeader` section titles, `PageHeader` H1s, guide titles, and the mission Creed. Do **not** blanket-apply serif to card titles, eyebrows, nav, or UI labels — those stay sans. Reference impl: `app/(public)/page.tsx` + `docs/home-manifesto-spec.md`.

### Type scale

| Element | Class | Notes |
|---|---|---|
| Hero H1 (homepage) | `text-6xl md:text-[7.5rem] leading-[0.92] tracking-tight` | "Dad Like a Boss." energy |
| Page H1 (listings) | `text-4xl md:text-5xl font-black tracking-tight` | Editorial weight |
| Section H2 | `text-2xl font-black` | Big-Quiet rhythm — sections stay quiet so content can breathe |
| Card H3 | `text-base font-semibold leading-snug` | Card titles |
| Hero/Featured H3 | `text-2xl md:text-3xl font-black` | Featured-card titles |
| Editorial section H2 (`EditorialHeader`) | `font-editorial-display font-semibold text-3xl md:text-4xl tracking-tight` | Manifesto section titles — **serif** |
| Editorial page H1 (`PageHeader`) | `font-editorial-display font-semibold text-4xl md:text-5xl tracking-tight` | Interior "slim editorial band" — **serif** |
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

### Messaging lockups & the Title-Case exception (v3.4)

The v3.4 messaging lines (§1.7) are the **one place headline copy is set in Title Case, not uppercase.** Everything else in the display system — section headings (`font-black`), eyebrows (uppercase, tracked) — stays as documented above. Don't uppercase the messaging lines to "match" a heading, and don't Title-Case a section heading to match a messaging line. They are different type roles.

- **Positioning lockup** — *The Boss Dad Standard.* Set with tight leading (`leading-[0.98]`), `font-black` Montserrat, `tracking-tight`; "Standard." can carry the `text-accent` color. Largest type on the page. (Note: the live homepage hero H1 currently renders the primary tagline "Dad Like a Boss." with "Boss." in accent — `HomeHero` is the reference pattern.)
- **Primary tagline** — *Dad Like a Boss.* One line, `font-black`, accent on the final word ("Boss.") when it sits alone as a hero/marquee line.
- **Action line** — *Boss Up.* Button/CTA weight (`font-extrabold`/`font-bold`), never larger than the tagline it sits under.
- **Credibility line** — *Real Dads. Smart Tools. Better Decisions.* Small-to-mid supporting type; works as a footer trust bar or a sub-deck under the hero. Not `font-black` — it's a supporting line, set in body/UI weight.
- **Manifesto** — the one place the editorial serif is welcome: `font-editorial-display` (Fraunces), with the payoff phrase "the ultimate expression of it" in `text-accent`. See the homepage Creed in `docs/home-manifesto-spec.md`.

**Never:** all-caps a messaging line, cap `BOSS` mid-line, or drop the trailing periods — the periods are the punctuation signature of the system.

---

## 4. Shape Language

### Corner radius
- **Cards, panels, buttons, inputs**: `rounded-xl` (12px). One number, used everywhere.
- **Pills**: `rounded-full` (badges, filter buttons, status pills).
- **Small avatar / image holder**: `rounded-xl` on hero card swatches; `rounded-full` on user avatars.

We landed on 12px (`rounded-xl`) for the balance of *modern* and *not blocky* — tightened from the earlier 16px (`rounded-2xl`). Sharper reads cold; softer reads consumer.

### Border principle — Border + soft shadow (dark-first)
On the dark canvas, **elevation comes from a visible border plus a *soft* shadow** — pure black drop-shadows vanish on near-black. The shipping card skin is:

```
bg-surface rounded-xl border border-soft shadow-lg shadow-black/5
hover:border-copper hover:shadow-xl hover:shadow-black/10 hover:-translate-y-1
```

1. `border border-soft` — the primary separator (→ `border-copper`/`border-strong` on hover).
2. A soft shadow at low opacity (`shadow-black/5` → `shadow-black/10` on hover) for a subtle lift.
3. A small hover translate (`-translate-y-0.5` / `-translate-y-1`).
4. Surface-color contrast (raised surfaces) + whitespace.

The shared primitive `components/ui/Card.tsx` is border-only (`bg-surface rounded-xl border border-soft`, no shadow). The old "Shadow Skin / no borders / `shadow-black/40`" system is **retired**.

### Shadow scale (soft — dark-first)
Shadows are low-opacity accents *on top of* the border, not the primary separator.
| Class | Use |
|---|---|
| `shadow-md shadow-black/5` | Subtle — pills, list rows, wishlist cards |
| `shadow-lg shadow-black/5` | Standard cards (review/guide) |
| `shadow-xl shadow-black/10` | Card hover (paired with `hover:border-copper` + `-translate-y-1`) |

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

### Card skeleton (review / guide / wishlist / shop)
Real pattern (see `ReviewCard.tsx` / `GuideCard.tsx`): semantic tokens only, `rounded-xl`, border + soft shadow, hover lift.
```jsx
<Link
  href="..."
  className="group relative flex flex-col bg-surface rounded-xl overflow-hidden border border-soft shadow-lg shadow-black/5 hover:border-copper hover:shadow-xl hover:shadow-black/10 hover:-translate-y-1 transition-all duration-200"
>
  {/* Image — h-44, object-cover, hover scale */}
  <div className="relative w-full h-44 bg-surface-raised shrink-0">
    <Image ... className="object-cover group-hover:scale-105 transition-transform duration-300" />
    {/* Boss Approved badge top-right when rating >= 8 */}
  </div>
  <div className="p-5 flex flex-col flex-1">
    {/* Top row: category (CategoryIcon SVG) + rating score */}
    <div className="flex items-center justify-between mb-3">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-eyebrow uppercase tracking-widest truncate max-w-[60%]">
        <CategoryIcon slug={cat.slug} className="w-4 h-4" />
        {cat.label}
      </span>
      <RatingScore rating={rating} />
    </div>
    <h3 className="text-base font-semibold leading-snug text-prose group-hover:text-accent-text transition-colors flex-1">
      {title}
    </h3>
    <p className="text-prose-faint text-sm mt-2 line-clamp-2">{excerpt}</p>
    {/* Foot row: date + action link */}
    <div className="flex items-center justify-between mt-4 pt-4">
      <span className="text-xs text-prose-faint">{date}</span>
      <span className="text-xs text-accent-text font-medium">Read review →</span>
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
className="px-4 py-2.5 rounded-full text-sm font-semibold bg-accent text-white"

{/* Inactive */}
className="px-4 py-2.5 rounded-full text-sm font-medium bg-surface text-prose-muted border border-soft hover:border-strong hover:text-prose transition-all"
```

### Buttons
- **Primary** (CTAs): `bg-accent hover:bg-accent-hover text-white font-extrabold rounded-xl px-7 py-3.5 min-h-[48px]`
- **Secondary**: `border border-strong text-prose hover:border-accent hover:text-accent font-bold rounded-xl px-7 py-3.5 min-h-[48px]`
- **Tertiary / link**: `text-accent-text hover:text-accent transition-colors` (text-only)
- **Tracked-caps action link**: `text-xs text-prose-faint hover:text-accent-text transition-colors uppercase tracking-widest font-semibold`

### Index numbers (More Reviews TOC treatment)
```jsx
<span className="absolute top-3 left-3 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-orange-400 text-[10px] font-bold tracking-[0.2em] tabular-nums">
  {String(i + 1).padStart(2, '0')}
</span>
```
Magazine table-of-contents detail. Used on the More Reviews grid on the homepage.

### Empty states
```jsx
<div className="text-center py-24 bg-surface/40 rounded-xl">
  <p className="text-prose-faint text-lg font-semibold">No items here yet.</p>
  <p className="text-prose-faint text-sm mt-2">Check back soon, Boss.</p>
</div>
```
No dashed borders. Soft panel that reads as "this is intentional" not "this is broken."

### Boss Approved badge
- Card variant: top-right of card image when `rating >= 8`.
- Component: `components/BossApprovedBadge.tsx`.

---

## 7. Iconography

- **Categories**: inline stroke SVGs (24×24, `currentColor`, `strokeWidth={2}`) via `components/CategoryIcon.tsx`, keyed by category slug. **No emoji on web surfaces.** (The `icon` emoji field in `lib/categories.ts` is vestigial — not rendered.)
- **Status indicators**: small colored circle (`w-2 h-2 rounded-full`) + animated pulse for "live" feels.
- **Inline UI**: hand-drawn stroke SVGs, Heroicons-style. Minimal, type-led; no emoji, no icon library.

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
| `GuideCard` | `app/(public)/guides/_components/GuideCard.tsx` | `/guides`, homepage |
| `WishlistCard` | `components/wishlist/WishlistCard.tsx` | `/wishlist` |

---

## 10. Design Decision Log

A short history of key choices and why — useful when reconsidering trade-offs later.

| Decision | Rationale |
|---|---|
| **Forge Base palette** (neutral warm-black, not brown-warm) | After A/B with 14 alternative palettes (Ranger heritage, Atlas navy, Voltage electric, Hearth domestic, Graphite mono, Trophy hunter green, Ember oxblood, etc.), Forge's earthy orange + neutral dark won for workshop/honest-craftsman feel without going too cold. |
| **16px corners** (`rounded-2xl`) | Tested 0/2/4/8/12/16/20/24px live. 8px felt too blocky in real context; 16px holds the modern-friendly feel without going consumer-soft. *(Later tightened to 12px `rounded-xl` in the dark-first build — see §4.)* |
| **Border + soft shadow** (retired "Shadow Skin") | On the near-black dark canvas, black drop-shadows are invisible, so the original no-border/shadow-only "Shadow Skin" was dropped. Cards now separate with `border border-soft` + a low-opacity `shadow-black/5` and a hover lift. See §4. |
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
Canvas (dark)    bg-background / #09090b            (token — not bg-gray-950)
Card surface     bg-surface #18181b · raised bg-surface-raised #27272a
Brand accent     text-accent / bg-accent = #E55A1A (Hot, on dark) · hover #CC5500
Inline links     text-accent-text / text-eyebrow = #f48a4a
Text             text-prose #f4f4f5 · text-prose-muted #d4d4d8 · text-prose-faint #a1a1aa
Borders          border-soft #27272a · border-strong #3f3f46

Cards            bg-surface rounded-xl border border-soft shadow-lg shadow-black/5
Cards hover      hover:border-copper hover:shadow-xl hover:shadow-black/10 hover:-translate-y-1
Empty state      bg-surface/40 rounded-xl (no dashed border)

Hero H1          text-5xl (mobile) · text-7xl md:text-[5.5rem] (desktop) font-black leading-[0.98]
Page H1          text-4xl md:text-5xl font-black tracking-tight
Editorial H1     font-editorial-display font-semibold (PageHeader — Fraunces)
Section H2       text-2xl font-black
Eyebrow          text-[11px] text-eyebrow uppercase tracking-[0.2em] font-bold
                 (prefix with em-dash: "— Just In")

Section opener   3px vertical accent rule + eyebrow + h2  (use SectionHeader)
Icons            inline SVG (CategoryIcon) — no emoji

Container        max-w-6xl mx-auto px-6   (detail pages max-w-7xl)
Section padding  py-12 md:py-16
Card grid        gap-5
Numbers          tabular-nums
```

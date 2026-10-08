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
- Every claim has specifics: durations ("4 hours of continuous use"), conditions ("18°F garage, no insulation"), outcomes ("zip-tied in under a minute"). Specifics come from real use, manufacturer specs, or research — never invented.
- Reviews require a real-testing reference: "I used this for X," "I ran this through Y."
- Field-tested is not a slogan — it's a fact-check rule **for reviews**. Don't review, score, or badge what you haven't used. The unit can be bought or provided by a brand (§1.9 — disclosed, never paid for). Any piece may *mention, link or showcase* products we haven't reviewed, using the mention types in §1.9 — every mention true, none implying firsthand experience that didn't happen.

*Humor calibration*
- One dad joke per piece, max. Earn it.
- Playfully cynical edge aims at *mediocrity, soft culture, weak excuses, participation-trophy parenting* — never at individual dads who are struggling, asking, or learning.
- When in doubt, see "Where the edge is OFF" below — default to warm Protector mode.

*Faith mentions*
- Faith and family-as-foundation referenced naturally when it fits ("we lead our households," "what we owe our wives and kids").
- Never preach. No scripture dropped without context. No moralizing about other men's choices.
- Faith content earns its own posture — warm and grounded, not cynical.

*Inquiry register — philosophical & moral discussion (scoped exception)*
- **What it's for:** meaning and purpose, faith and doubt, the existence of God, death and grief, duty, conscience, what a life is for, what we're handing our kids. It is the house default for **Table Duty** and **Watch Duty**, and it can be switched on for any pillar when a piece has earned it (a Health & Wellness essay on grief and faith wants it).
- **The balance is humble in posture, decisive in substance.** Both halves are load-bearing, and the failure modes run in both directions: the abrasive verdict-first hot take on one side, the wishy-washy survey that never commits on the other. The second is the easier mistake to make here.
- Write **student-first**: an imperfect dad thinking it through out loud, not a man handing down the verdict. Show the reasoning so the reader can follow it and disagree.
- **But land it.** Make a real attempt at an answer — a position, an explanation, a way of thinking that actually helps. Humility governs how you *hold* a conclusion; it is not permission to avoid reaching one. A piece that circles a question and walks away has failed the reader. A closing question is welcome *after* the answer, never instead of it.
- **Use what's already known.** Philosophy, theology, psychology, history and hard-won common sense have serious answers to most of these questions. Bring them, say where the weight of thoughtful opinion sits, and name which view convinces you. Don't reason from scratch on a question people have worked on for millennia.
- Engage the **strongest** version of the opposing view, never a strawman — then say why you still land where you land.
- Honest uncertainty is allowed but it isn't the deliverable. "I don't know" earns its place attached to what you *do* think — name the specific unsettled piece rather than hedging the whole essay.
- **Suspended here:** the four gear content pillars (Practical Win / Family Proof / Honest Assessment / Value Play) and affiliate links. Don't force a gear-style action item onto a moral question — what you owe the reader is clearer thinking.
- **Relaxed here:** the hedge-word ban, for the purpose above. Vagueness is still banned.
- Faith is **lived, not preached** — no sermonizing, no judging another man's walk. It can absolutely be where you land; show the reasoning that got you there rather than letting a verse stand in for it. Doubt gets honest airtime too.
- **Weight varies with the subject** — some pieces are hard-won life lessons, others are genuinely fun thought experiments. Match it.
- No partisan cheerleading, no personal attacks. Every piece answers one question: **why does this matter at the family table?** (fathers, family, faith, the next generation).
- Warm Protector mode still auto-engages on vulnerability (loss, mental health, struggling dads); the rest of the banlist still applies.
- **Table Duty** = timeless conversation; **Watch Duty** = timely, with a freshness window (weeks, then archive or grow into a Table Duty essay). Same register for both. Scope + boundaries: `docs/pillar-taxonomy.md`.

> **How it fires (execution layer).** The register is opt-in, never ambient: `BOSS_DADDY_SYSTEM` only applies it when the user message carries a literal `INQUIRY MODE: ON` line. The guide wizard's **Inquiry mode** toggle sends it — checked by default for `table-duty`/`watch-duty` (`isInquiryCategory()` in `lib/categories.ts`), overridable in both directions. `guide-draft`, `guide-refine` and `suggest-prompt` all honor the flag; refine infers it from the article's category, since the mode isn't persisted on the row. The submit-time moderator (`MODERATOR_SYSTEM`) has the matching carve-out and judges these as essays — it derives the mode from the pillar rather than accepting it from the caller, because a compliance gate must not be steerable by what it is gating.

*Trust & legal*
- Zero sponsors. Affiliate is fine, disclosed, and earned. Sponsored placement positioned as honest review is forbidden.
- **Provided products are fine; paid coverage never is** (decided 2026-10-06). Brands may send products for testing or review. That never buys coverage, a score, or a look at the piece before it publishes, and nobody is paid to place, sway or score anything. A provided or loaned unit is disclosed on the page, next to the opinion (§1.9).
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
The Boss Dad Standard.        ← eyebrow (identity kicker)

Dad Like a Boss.              ← H1

Field-tested gear, no-fluff guides…  ← subhead (page copy, not a brand line)
```

*Homepage line assignment (revised 2026-08-03).* One brand line per beat, spaced down
the page, each doing a different job — so no line does two jobs in one viewport:

| Beat | Line |
|---|---|
| Hero eyebrow | **Positioning** — an eyebrow above the H1 is an *identity* slot |
| Hero H1 | **Primary tagline** |
| Mid-directory interstitial (`CredibilityBreak`) | **Credibility** — proof, delivered mid-browse where trust is actually decided |
| The Creed | **Creed** + "That's The Boss Dad Standard." (deliberate bookend with the eyebrow) |
| Email capture button | **Action line** — §1.7 names button text; this is the site's one real call to join |
| Merch strip | **Merch voice** |
| Footer trust bar | **Credibility** |

Two changes from the older lockup, both deliberate:

- **The hero no longer carries the credibility line.** It moved to the mid-directory
  interstitial on the homepage Library, `/guides`, and `/reviews`. In the hero it was
  an 11px kicker decorating the H1; mid-browse it's the only voice in ~3,500px of
  repeated module, at the moment a reader is deciding whether to trust the shelf. The
  footer trust bar keeps its copy, so the line still appears twice per page — far
  apart rather than bunched at the top.
- **The hero subhead is page copy, not a brand line,** and stays that way. "Field-tested
  gear… If it can't survive my house, it doesn't get a score." is first-person with a
  falsifiable standard — §1 voice. Do **not** swap in `essence`: it's third-person
  brand-about-brand ("gold standard and trusted hub"), it restates the H1 it sits
  under, and it deletes the gear/guides/tools wayfinding a first-time visitor needs.

**`essence` renders nowhere, on purpose.** It describes the brand to itself, which is
right for meta descriptions, social bios, and the phone Claude Project file — and wrong
for any reader-facing surface. Don't find it a slot.

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
- Use the default vivid Tailwind orange (`#f97316`). Our accent is `#CC5500` (core, on the light page) / `#E55A1A` (Hot, inside dark zones) — warm and earthy, never the loud default.
- Per-category rainbow colors. All categories share one unified treatment (`lib/categories.ts`).
- Sponsored content positioned as honest reviews. Affiliate is fine and disclosed; sponsored is not.
- Preach faith — it's the foundation, not the lecture.
- Punch down on struggling dads. The edge is for mediocrity, not for men in the trenches.
- Imply firsthand testing of a product we haven't used — in copy, meta descriptions, or AI drafts.
- Invent an endorsement — a made-up friend's recommendation or an unsourced "best-seller" claim.
- Claim a team that doesn't exist. Boss Daddy is founder-written and founder-edited; contributor rules are written in the future tense ("anyone who joins").

### 1.9 Product Mentions & Claims (locked 2026-09-24)

Industry standard, same as Wirecutter / CNN Underscored / Gear Patrol: **one affiliate disclosure per page** (auto-rendered from `lib/affiliate.ts` `FTC_DISCLOSURE_HTML`), **no per-product labels**. Testing claims belong to reviews; selection claims cover everything.

**House line:** *Every review is earned. Every pick is independently chosen.*

| Type | Example | Allowed where | The rule |
|---|---|---|---|
| **1. Firsthand** | "I ran this for three weekends" | Reviews, or any piece where it actually happened | Must have actually happened |
| **2. Secondhand** | "My brother-in-law swears by the ___" | Anywhere | A real person really said it. If they have a stake (work for the brand, sell it), disclose it. |
| **3. Reputation** | "Many dads go with the ___" / "one of the hottest picks for X right now" | Anywhere | True when written. No exact figures that go stale ("4.8 stars, 20k reviews") unless dated. |
| **4. Selection** | "If I were buying today, this is the one I'd look at" | Anywhere | Honest opinion |

- Scores and the Boss Daddy Approved badge are type 1 only (reviews).
- **Claims only when set** (2026-10-06). Showcasing a product (On the Radar, collections, guides) is type 4 and claims nothing about owning or testing it. A product carries a status or relationship claim only when the operator sets it: *Up Next* / *Testing Now* / *Reviewed* (its stage), *Bought it* (its "How I got it" field). No default disclaimers either — no "not tested", no automatic "owner pick". The one exception to "no per-product labels" is legal: a **brand-provided or loaned** unit renders its material-connection disclosure wherever the product is reviewed or recommended. One helper (`productClaims()`, `lib/products.ts`) decides every product chip.
- Never let secondhand or reputation drift into firsthand later in the same piece.
- Listing/gift/stack copy says **"dad-picked" / "hand-picked" / "independently chosen"** — never "dad-tested" or "personally tested" unless every item on the page is a published review. ("Dad-tested" stays correct on review-only surfaces: `/reviews`, review category/tag pages.)
- Enforced in the AI layer: `BOSS_DADDY_SYSTEM` PRODUCT MENTIONS block + `MODERATOR_SYSTEM` claim checks (`lib/claude/client.ts`). Full rollout record: `docs/disclosure-copy-rewrite.md`.

---

## 2. Color System (Light Editorial — 2026-10-08)

The site runs a **light editorial canvas**: no `data-theme` on `<html>` (`lib/canvas.ts` decides; `BD_CANVAS=dark` restores the dark page for a side-by-side). White page, near-black text, hairline borders, orange as the ONLY accent — core `#CC5500` on white. **The chrome stays near-black.** `Header`, `Footer`, `MobileBottomNav`, `StickyMobileCta`, the homepage brand band (`HomeHero`), `InMotionTicker`, the Creed, and the `(dashboard)` layout wrap themselves in `data-theme="dark"`, so the black / orange / white edge lives in the frame and in one dark band per page — not in the reading surface. No gold, no per-type rainbow, no cream/peach/brown, no vivid `#f97316`.

Why: every comparable publication (Wirecutter, Strategist, Gear Patrol, Fatherly, Uncrate) runs light; the dark-first build (2026-06 → 2026-10) read as software, not as a magazine. Full rationale and rollout: `docs/light-editorial-plan.md`.

> **Elevation = whitespace + hairline rules.** Content cards are **borderless** (image + type + one hairline above the footer). Utility surfaces (forms, menus, tool tiles, dashboard) keep `border-soft` + the raised tier. No drop-shadows on content — `check:shadow` still bans `shadow-black/*` as a design rule; overlays may use bare `shadow-*`.

### Tokens — `app/globals.css` (`:root` = light page · `[data-theme="dark"]` = zones)

| Variable | Light (page) | Dark (zones) | Usage |
|---|---|---|---|
| `--bd-bg` / `--background` | `#ffffff` | `#09090b` | Page canvas |
| `--bd-chrome` / `--color-chrome` | `#09090b` | `#09090b` | Masthead / footer / bottom nav — always near-black |
| `--bd-surface` / `--color-surface` | `#ffffff` | `#18181b` | Cards — white on white on purpose; a content card is its image and its type |
| `--bd-surface-raised` | `#fafafa` | `#27272a` | Soft panels: tool tiles, Key Takeaways, alt sections |
| `--bd-surface-hover` | `#f4f4f5` | `#3f3f46` | Interactive hover lift |
| `--bd-surface-sunken` | `#f4f4f5` | `#09090b` | Wells, code blocks, search / modal panels |
| `--bd-border` / `--color-soft` | `#e4e4e7` | `#27272a` | Hairlines, row dividers |
| `--bd-border-strong` / `--color-strong` | `#d4d4d8` | `#3f3f46` | Outline buttons, chips, menu edges |
| `--bd-text` / `--foreground` | `#18181b` | `#f4f4f5` | Headlines + body — near-black, never grey |
| `--bd-text-muted` | `#52525b` | `#d4d4d8` | Decks, captions, **eyebrows** |
| `--bd-text-faint` | `#71717a` | `#a1a1aa` | Timestamps, decorative (AA on both) |
| `--bd-prose-body` | `#18181b` | `#d4d4d8` | Long-form body |
| `--bd-orange` / `--color-accent` | `#CC5500` | `#E55A1A` | Orange fills, rules, score rings, active states |
| `--bd-orange-hover` / `--color-accent-hover` | `#B85A14` | `#CC5500` | Hover on orange fills |
| `--bd-orange-text` / `--color-accent-text` | `#B85A14` | `#f48a4a` | Inline links; the opt-in orange kicker (4.67:1 on white — the core `#CC5500` misses AA at eyebrow size) |
| `--color-eyebrow` | = text-muted | = text-muted | Eyebrows are **quiet by default** |
| `--bd-cta` / `-hover` / `-ink` | `#09090b` / `#CC5500` / `#fff` | `#E55A1A` / `#CC5500` / `#fff` | **Primary button: black on the page, orange in zones.** Consumed by `buttonVariants('primary')` only |
| `--bd-accent-tint` | `#f4f4f5` | `#27272a` | Neutral brand-territory surface — never peach |

### The surfaces (light page)

1. **Chrome** (`bg-chrome`, near-black, inside a dark zone) — masthead / footer / bottom nav / brand band / Creed.
2. **Canvas** (`bg-background`, white) — the page.
3. **Surface** (`bg-surface`, white) — cards. Same value as the canvas on purpose.
4. **Raised** (`bg-surface-raised`, zinc-50) — soft panels: tool tiles, takeaways, alt sections.
5. **Hover** (`bg-surface-hover`, zinc-100) — interactive lift.

### Tailwind utilities (mapped via `@theme inline`)
- `bg-chrome` → masthead / footer / bottom-nav (always inside a `data-theme="dark"` zone)
- `bg-background` → page canvas · `bg-surface` / `bg-surface-raised` / `bg-surface-hover` → surface tiers
- `text-prose` / `text-prose-muted` / `text-prose-faint` → text tiers · `text-eyebrow` → the quiet kicker
- `text-accent` → orange text ("Read the guide →", scores) · `text-accent-text` → inline links / opt-in orange kicker
- `bg-cta text-cta-ink hover:bg-cta-hover` → the primary button (via `buttonVariants`, never by hand)
- `border-soft` → hairlines · `border-strong` → outline controls

### State is encoded with colour, never with geometry

**A conditional class must never change an item's box.** State — selected, active,
done, missed, today — is carried by **fill, border colour, or ring**. It is never
carried by `margin`, `width`, `padding`, `aspect`, or `rounded-*`, because those move
the item relative to its neighbours and the shift reads as a rendering bug rather
than as information.

Two failure modes, both found in shipped code:

- **The off-axis item.** A calendar cell got `-ml-[4px] rounded-l-none` when it
  continued a run. The box grew 4px while its centred day number stayed centred *in
  the wider box*, so that one day sat visibly off the column everyone else was on.
  Reported as "why is the 13th rendering odd" — nobody reads a 2px offset as a
  feature. Fixed by leaving every cell identical and drawing the connection as a
  separate bar behind the two chips.
- **The ragged row.** Anything conditional in a flex/grid row of equal siblings —
  a wider border on the active tab, a bigger radius on the current step — shears the
  row's rhythm even when the intent is emphasis.

Safe ways to say "this one": `ring-*` (box-shadow based, zero layout), a colour swap
at equal border width (`border-accent` ↔ `border-transparent`), `font-bold` on
centred or left-aligned text, an added child (dot, bar, check) inside an unchanged
box. Negative margins remain legitimate for **containers** — the `-mx-{n}` break-out
for horizontal scroll strips (§5) — and for hit-area clawback on a lone control
(`p-1 -mr-1`). The rule is about *items in an aligned set*, not about the utility.

### Reading surface (reviews / guides)
Long-form body sits on **bare canvas at every breakpoint** (reversed 2026-09-23 — phone/tablet used to get an elevated panel, which washed out nested `bg-surface` elements against its same-color fill). Single source of truth: `ARTICLE_SURFACE_CLASS` in `lib/article-surface.ts`. Body is **sans**; the *body* editorial serif (Source Serif 4) is reserved for blockquotes/pull-quotes only. The *display* serif (Fraunces via `.font-editorial-display`) is used for the Creed only (§3, "One voice"). Article images get a subtle frame (`border` + rounded) so white-bg product shots don't glare.

### Status colors (chips / pipeline indicators)
| Status | Color | Use |
|---|---|---|
| `testing` | `text-green-400` | Live testing pulse |
| `queued` | `text-blue-400` | Coming soon |
| `considering` | `text-amber-400` | Voting / pipeline |
| `reviewed` | `text-accent` | Done / shipped |

For bordered chips prefer the token recipe (`bg-{danger,success,warn,info}-bg` + `border-…-line` + `text-…-ink`) — it inverts correctly inside the dark zones.

### The dark band (one per page)
On the light canvas the old "one dark island per page" idea is back with a sharper definition: **one near-black band** per page as the punctuating moment — the homepage brand band + ticker, the Creed, the credibility band, the sticky price bar on a review. A band is a `data-theme="dark"` zone, so every token inside it inverts by itself; never fake one with `bg-zinc-950` and hand-set text colours. The elevated accent band (`bg-surface-raised` + a 3px orange top rule) remains available for utility surfaces (e.g. the newsletter section).

### The section header convention — two lanes (settled 2026-07-27)

There are **two** sanctioned section-header shapes. Pick by surface, never by taste, and **never inline either pattern**:

| Lane | Component | Shape | Use on |
|---|---|---|---|
| **Editorial** | `EditorialHeader` | quiet eyebrow (role) + Montserrat black title + optional right link | public editorial surfaces — homepage, listings, editorial pages |
| **Utility** | `SectionHeader` | 3px × 18px brand-orange vertical rule + uppercase tracked `font-black` label | utility surfaces — **`/gear`** (the sanctioned utility public page), dashboard/admin, compact panels |

The prior wording ("every section heading sitewide uses `SectionHeader`") was written before Manifesto v2 and is retired: it contradicted the editorial rollout and described an admin population that no longer used the component. **`/gear` is deliberately utility-styled** — it's a working gear list, not an editorial read, and it stays on `SectionHeader` (5 call sites). That is a decision, not drift; don't "fix" it to `EditorialHeader`.

---

## 3. Typography

### Fonts (self-hosted via `next/font/local` — defined in `app/fonts/fonts.ts`, files in `app/fonts/`)

Never switch back to `next/font/google`: it fetches Google's CSS on every build, and a response-shape change from Google broke Turbopack builds on 2026-10-08. Each family ships a Latin + Latin Extended face; the font stacks in `app/globals.css` list the `-ext` variable first.

- **Display / Headings (default)**: `var(--font-montserrat)` — heavy weight (`font-black` 900) for hero, `font-bold` 700 elsewhere. Default for every `h1–h4` via the global rule in `globals.css`.
- **Display serif**: `var(--font-editorial-display)` = **Fraunces**. **The Creed only** (`.font-editorial-display`). Not a headline face — see "One voice" below.
- **Body / UI**: `var(--font-geist-sans)` — neutral grotesk.
- **Editorial body** (`.bd-editorial` prose): `var(--font-serif)` = Source Serif 4 — serif voice for review/article **blockquotes / pull-quotes only**.

> **One voice (2026-10-08).** Boss Daddy is bold and heavy, and its headings say so: **every heading is Montserrat** — `font-black` for the brand-band tagline, section titles (`EditorialHeader`), page H1s (`PageHeader`), review/guide titles, the cover story and lead cards; `font-extrabold` for card, row, and list titles. The Fraunces serif lives in exactly one place, the mission Creed; article pull-quotes use the body serif (Source Serif 4). The Manifesto v2 "editorial serif heading" exception and the same-day "serif = content" pass are both retired — the serif headlines were tried live and read as a mismatch with the brand. Editorial feel comes from layout, whitespace, and the black chrome, not from a typeface. Don't re-propose serif headlines.

### Type scale

| Element | Class | Notes |
|---|---|---|
| Brand-band H1 (homepage) | `font-black text-4xl sm:text-5xl md:text-6xl leading-[0.98] tracking-tight` | "Dad Like a Boss." — Montserrat stays; slim band, not a poster |
| Page H1 (app chrome: account, cart, order) | `text-4xl md:text-5xl font-black tracking-tight` | Sans. **Public pages do NOT use this** — they use the `PageHeader` row below (Manifesto v2 Phase 2/2.5 migrated every public listing to it). |
| Section H2 | `text-2xl font-black` | Big-Quiet rhythm — sections stay quiet so content can breathe |
| Card / row H3 | `font-extrabold text-base sm:text-lg leading-snug tracking-tight` | Content card and row titles |
| Lead / cover H3 | `font-black text-2xl md:text-4xl leading-[1.05] tracking-tight` | Lead cards, cover story |
| Detail H1 (review / guide) | `font-black text-4xl md:text-5xl leading-[1.05] tracking-tight` | |
| Editorial section H2 (`EditorialHeader`) | `font-black text-3xl md:text-4xl leading-[1.02] tracking-tight` | Section titles |
| Editorial page H1 (`PageHeader`) | `font-black text-4xl md:text-5xl leading-[1.0] tracking-tight` | Interior "slim editorial band" |
| Body | `text-base leading-relaxed` | 16px, comfortable line-height |
| Small / metadata | `text-sm text-gray-500` | |
| Eyebrow | `text-[11px] text-eyebrow uppercase tracking-[0.2em] font-bold` | Quiet grey by default; orange only on dark bands via `text-accent-text` |
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

### Corner radius (tightened 2026-10-08)
The Tailwind radius scale is **overridden globally** in `app/globals.css` `@theme inline`, so every `rounded-*` call site tightens together and the ratio between tiers holds. Keep writing `rounded-xl` / `rounded-2xl`; the values are the design's:

| Class | Renders | Use |
|---|---|---|
| `rounded-sm` | 2px | square tags on images |
| `rounded-md` | 4px | inputs, small badges |
| `rounded-lg` | 6px | sm buttons, rows, thumbnails |
| `rounded-xl` / `rounded-2xl` | 8px | buttons, cards, images (one card radius) |
| `rounded-3xl` | 10px | hero / cover packages |
| `rounded-full` | pill | chips, avatars, dots — **not** badges over photos |

Tailwind's defaults (12 / 16 / 24px) are the SaaS silhouette; editorial and gear publications run 0–8px. Tune in one place, never per component.

### Border principle — hairlines, no boxes
- **Content cards are borderless.** `LeadCard`, `LibraryGuideCard`, `ReviewCard`, the cover story, the lead guide: the image carries `rounded-xl overflow-hidden`, the copy sits flush with the image's left edge, and the only rule is the hairline above the footer. Hover = title to `text-accent` + a 2px lift.
- **Rows separate by hairline** (`border-b border-soft`), never by card.
- **Utility surfaces keep the box.** `components/ui/Card.tsx` stays `bg-surface rounded-xl border border-soft` for forms, menus, tool tiles, dashboard panels. Soft panels (`bg-surface-raised`, no border) are the middle option — Boss Tools tiles, Key Takeaways.
- **No drop-shadows on content.** `check:shadow` bans `shadow-black/*`; bare `shadow-*` is for overlays (modals, dropdowns, lightboxes) only.
- **One mark per image.** The Boss Approved badge, or a small square black tag (`rounded-sm bg-chrome text-white`). Never an orange pill over a photo.

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

### Brand band (homepage)
- A slim near-black band under the masthead: kicker → tagline (one line on desktop, two on a phone) → one-line subhead → "Meet the Boss" text link → the in-motion ticker. No photo, no gradient, no full-height poster: the cover story sits on the first screen.
- **Placeholder composition (2026-10-08).** The operator wants a dedicated design pass on the band. Keep it slim when you do — content on the first screen is the point. The hero photographs stay in `public/images` for `/about`.

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
Real pattern (see `LeadCard.tsx` / `LibraryGuideCard.tsx` / `ReviewCard.tsx`): semantic tokens only, **borderless**, image carries the radius, serif title, quiet eyebrow, one hairline above the footer, hover = title colour + lift. See §4.

> **Enforced since 2026-08-03.** `npm run check:shadow` (in `prebuild`) fails the build on
> any `shadow-black/*`. The pattern had reached 63 occurrences across 46 files precisely
> *because this skeleton taught it* — every new card was copied from a documented example
> carrying `shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/10`. Fixing the doc
> couldn't stop copy-paste from existing components, so the build now does.
>
> **If you want elevation on dark, tint it.** A coloured glow renders where black cannot:
> `shadow-[0_0_10px_rgba(229,90,26,0.7)]` (BenchStrip's live dot), `shadow-accent/30`
> (MobileBottomNav), `shadow-orange-950/25` (BossApprovedBadge). Those are all allowed.
>
> Known gap: bare `shadow-md|lg|xl|2xl` with no colour override is *also* invisible, and
> ~26 survive on overlay surfaces (modals, dropdowns, lightboxes, toasts) that already sit
> above a backdrop scrim. Not enforced — see the guard's header for the reasoning.
```jsx
<Link
  href="..."
  className="group flex flex-col hover:-translate-y-0.5 transition-transform duration-200"
  /* NO border, NO shadow: a content card is its image and its type. */
>
  {/* Image carries the radius — one mark on it at most (Approved badge or a square tag) */}
  <div className="relative aspect-[16/10] bg-surface-raised shrink-0 rounded-xl overflow-hidden">
    <Image ... className="object-cover group-hover:scale-[1.03] transition-transform duration-300" />
  </div>
  {/* Copy flush with the image's left edge — no inset padding without a box */}
  <div className="pt-4 flex flex-col flex-1">
    <span className="text-[10px] font-extrabold text-eyebrow uppercase tracking-[0.16em] mb-2">{cat.label}</span>
    <h3 className="font-extrabold text-base leading-snug tracking-tight text-prose group-hover:text-accent transition-colors">
      {title}
    </h3>
    <p className="text-sm text-prose-muted mt-2 line-clamp-2">{excerpt}</p>
    {/* The one hairline the card keeps */}
    <div className="flex items-center justify-between mt-4 pt-3 border-t border-soft text-[11px] text-prose-faint">
      <span className="text-sm font-semibold text-accent">Read review →</span>
      <span>{date}</span>
    </div>
  </div>
</Link>
```

### Featured (horizontal hero) card pattern
- `flex flex-col md:flex-row` — image left 50%, content right
- One mark on the image at most: the Boss Approved badge, or a small square black tag — never an orange pill
- Larger H3 — `font-black text-2xl md:text-4xl`
- 3-line excerpt (`line-clamp-3`)
- Copy sits flush with the image edge on a phone; on desktop the text column takes a gap, not a box

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

- **Categories**: inline stroke SVGs (24×24, `currentColor`, `strokeWidth={2}`) via `components/CategoryIcon.tsx`, keyed by category slug. **No emoji as interface iconography.** (The `icon` emoji field in `lib/categories.ts` is vestigial — not rendered.)
- **Status indicators**: small colored circle (`w-2 h-2 rounded-full`) + animated pulse for "live" feels.
- **Inline UI**: hand-drawn stroke SVGs, Heroicons-style. Minimal, type-led; no emoji, no icon library.

### 7.1 Emoji — where they're allowed (amended 2026-08-17)

The rule was a flat "no emoji on web surfaces," and it over-reached. The line that
actually holds:

| | Emoji | Why |
|---|---|---|
| **Interface iconography** — nav, section headers, eyebrows, buttons, card meta, status, empty states, marketing copy | **Never** | Renders differently per OS, can't be tinted to the accent or thinned to stroke-1.5, and reads casual against an editorial rhythm that is deliberately anti-casual. Use an inline outlined SVG. |
| **What one member says to another** — DM bodies, comments, goal-note bodies | **Yes** | It's their text. Stripping or discouraging emoji in a man's own message is editing him, not designing. |
| **Reaction vocabularies** — DM reactions, comment reactions | **Yes** | Emoji *is* the convention here; a hand-drawn SVG reaction set would be strictly worse — unrecognisable, and it would make us the only messenger on earth with bespoke reactions. |

**The test:** is the glyph *ours* (chrome we're drawing) or *theirs* (content and
reaction, authored by a member)? Ours → SVG. Theirs → emoji is fine.

Keep reaction sets **small and fixed** (a handful, not a full picker) so the row
stays a UI element with a predictable width rather than an open text field, and
render them at text size with no colour treatment — they carry their own colour and
must not be tinted.

---

## 8. Hero Patterns by Page

### Homepage (`app/(public)/page.tsx`)
- Desktop topic row under the masthead (`CategoryBar`, scrolls away), slim near-black brand band + ticker (§5), then the **featured review** package (cover story + the Latest list) on the first screen.
- Then, in order: **Boss Approved gear** (the product board — rated 8+, "Paid $X", score), **Guides** (topic chips, the newest guide, ONE spotlight module on the deepest category), gift season (in window), **Tools** (three tiles), the newsletter, **On the bench**, the **About band** (portrait + the Creed + Meet the Boss / How I test — the closing dark moment), the shop strip.
- Plain section labels: Featured review · Top picks · Guides · Tools · On the bench · About. No "Cover Story / Library / Creed" vocabulary on the page.
- Column footer: Brand · Topics · Browse · Trust & Legal.

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
- Title Montserrat `font-black`, body sans on bare canvas.
- Verdict card, pros/cons, takeaways use the status-chip token recipe and `bg-surface-raised` panels — no hand-set shades, no shadows.
- Author bio at the end uses shared `<AuthorBio />` component.
- Related reviews/articles sidebar (xl breakpoint+) uses the standard card pattern.

### Static / legal pages (`/about`, `/terms`, `/privacy-policy`, etc.)
- Inherit Forge Base palette globally.
- No card system needed — text-led pages.
- `prose prose-orange max-w-none` for body copy — colours come from the role tokens (`.prose` in `app/globals.css`); no `prose-invert`.

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
| `LibraryGuideCard` | `components/LibraryGuideCard.tsx` | `/guides/category/[slug]` 3-up grid. Takes `on={'background' \| 'surface'}`. Replaced `guides/_components/GuideCard.tsx` (deleted 2026-08-03). |
| `LeadCard` | `components/LeadCard.tsx` | Lead half of a "Template A" module. Takes the same `on` prop. |
| `ContentRow` | `components/ContentRow.tsx` | The compact directory row, site-wide: text left, thumbnail right. **The editorial lane.** `/gear` keeps its own image-left rows on purpose — don't convert it. |
| `TopicBlock` | `components/TopicBlock.tsx` | A category as `LeadCard` + `ContentRow`s. Behind the homepage Library, `/guides`, and `/reviews` — one pattern, three surfaces. Blocks alternate handedness by `index` (serpentine); rows mirror with them. Settled 2026-08-03 — see `home-manifesto-spec.md`. |
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
| **Light editorial canvas** (2026-10-08, replaces dark-first) | The operator's read: the site "does not look or feel like most other major sites." Root cause: the Vercel/Linear touchstones are software products; the content is a magazine, and every comparable publication runs light. White page + near-black chrome zones keeps the black/orange/white edge. `docs/light-editorial-plan.md`. |
| **Black primary CTA** (2026-10-08) | Orange-on-white buttons shout; black buttons that go orange on hover cut. Orange fill returns inside dark zones via the `cta` tokens. |
| **Borderless content cards · quiet eyebrows · 8px radius** (2026-10-08) | On a white canvas the 1px grey box, the orange kicker on every card, and 16–24px corners were the "component library" tells. Removed as a set after a live render against Wirecutter / Strategist / Gear Patrol. |
| **One voice — every heading Montserrat** (2026-10-08) | A serif-content-headline pass (Fraunces on cards, rows, detail titles) was rendered live the same day and rejected by the operator as a mismatch with the bold, heavy brand. Headings are Montserrat black/extrabold everywhere; Fraunces is the Creed only. Editorial feel comes from layout and the black chrome, not a typeface. |
| **Poster hero retired** (2026-10-08) | No comparable publication leads with a brand poster; the cover story is now the first screen. The slim brand band is a placeholder owed a dedicated pass. |

---

## 11. How to Maintain This Guide

- When you make a design decision in a session (color, type, spacing, component pattern), come back here and update the relevant section.
- Add to the **Design Decision Log** when reconsidering or reversing a previous choice — don't just rewrite. The history is valuable.
- Keep file references current. If a component moves, update the path in §9.
- This file is checked into the repo. Treat changes like code changes — descriptive commit messages.

---

## 12. Quick Reference (cheat sheet)

```
Canvas (light)   bg-background / #ffffff            (token — not bg-white)
Chrome (zones)   data-theme="dark" + bg-chrome #09090b   (header, footer, nav, brand band, Creed)
Card surface     bg-surface #ffffff · raised bg-surface-raised #fafafa · hover #f4f4f5
Brand accent     text-accent / bg-accent = #CC5500 (page) · #E55A1A (zones) · hover #B85A14
Inline links     text-accent-text = #B85A14 (page) · #f48a4a (zones)
Eyebrow          text-eyebrow = muted grey (quiet by default)
Primary button   buttonVariants('primary') → bg-cta (black on page, orange in zones)
Text             text-prose #18181b · text-prose-muted #52525b · text-prose-faint #71717a
Borders          border-soft #e4e4e7 · border-strong #d4d4d8

Content cards    borderless · image rounded-xl overflow-hidden · copy flush · one hairline footer
Cards hover      group-hover:text-accent on the title + hover:-translate-y-0.5
Utility cards    bg-surface rounded-xl border border-soft (components/ui/Card)
Image marks      one at most — Approved badge, or rounded-sm bg-chrome text-white tag
Empty state      bg-surface-raised rounded-xl (no dashed border)

Brand-band H1    font-black text-4xl sm:text-5xl md:text-6xl leading-[0.98]   (Montserrat)
Page H1          font-black text-4xl md:text-5xl leading-[1.0] tracking-tight  (Montserrat)
Content H3       font-extrabold text-base leading-snug tracking-tight          (Montserrat)
Section H2       font-black text-3xl md:text-4xl (EditorialHeader) · utility: SectionHeader
Serif            Fraunces = the Creed ONLY · Source Serif = pull-quotes ONLY
Eyebrow          text-[11px] text-eyebrow uppercase tracking-[0.2em] font-bold

Section opener   3px vertical accent rule + eyebrow + h2  (use SectionHeader)
Icons            inline SVG (CategoryIcon) — no emoji

Container        max-w-6xl mx-auto px-6   (detail pages max-w-7xl)
Section padding  py-12 md:py-16
Card grid        gap-5
Numbers          tabular-nums
```

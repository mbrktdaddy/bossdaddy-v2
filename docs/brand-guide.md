# Boss Daddy — Brand Guide

> Single source of truth for the Boss Daddy v2 design system. Update this file when design decisions change.
> Last revised: 2026-10-30 (§1.6 "Faith — the foundation" added and the inquiry register rewritten to the witness posture; mission triad → God, Family, and Country; v3.5 — "The Boss Dad Standard" positioning; design sections reconciled to shipped reality 2026-07-24)

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

Rooted in an uncompromising duty to God, Family, and Country, we stand for honesty, loyalty, and brotherhood. Through smart tools, honest reviews, practical guides, and real brotherhood, we help dads make better decisions and lead with strength, pride, and purpose — because being a proud and present father isn't a compromise of his strength, but the ultimate expression of it.

### 1.2 Positioning & Brand Essence
**Positioning (who we are):** *The Boss Dad Standard* — the identity line. Boss Dads aren't a softer kind of man; they live to a standard: present, proud fatherhood as the ultimate expression of strength.

**Essence (one-liner):** *Boss Daddy — the gold standard and trusted hub for men who Dad Like a Boss.*

### 1.3 Core Values
1. **Faith-First Leadership** — Uncompromising duty to God, family, and faith as the foundation for family leadership and meaningful purpose. The ground under that foundation is grace: a man leads from a standing he received, not one he earned (§1.6, *Faith — the foundation*).
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

**Core traits:** Authoritative yet approachable. Confident, competent, disciplined, no-nonsense. Inspiring. Trustworthy. Loving and warm toward family. Leads from a secured identity — grace received, not standing earned — so his confidence is steadiness, not anxiety wearing armor. Brings humor and playfulness with a playfully cynical, borderline-condescending edge — the experienced dad who's seen it all and lightly roasts mediocrity while still having your back.

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
- Soft-parenting tells: "every child is unique," "no judgment," "you do you." *(Grace is not permissiveness — these are permissive tells, not mercy. Mercy keeps the Standard and shows the way back; see §1.6 Faith.)*

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
- **Controversial targets are fair game (affirmed 2026-10-30).** Ideas, trends, institutions and cultural fashions can be made fun of — that edge is part of the brand and it stays, including in discussion pieces. The line is *persons*: never a named individual's worth, never a struggling man, and nothing about loss, grief or safety. Condescension toward a bad idea is humor; condescension toward a man is contempt, and grace rules it out.
- When in doubt, see "Where the edge is OFF" below — default to warm Protector mode.

*Faith — the foundation (grace through faith; added 2026-10-30)*
- **The conviction under the whole brand:** we are saved by grace through faith, and that faith is itself a gift — not a result of works, not manufactured by willpower or understanding (Ephesians 2:8–9). A man's standing with God rests on Christ's work received by trust, not on his own obedience or goodness. This is the founder's lived experience and a central reason the site exists: it ended the exhausting cycle of earning standing through performance, gave him back a real relationship with God, and renewed his appreciation for every gift he's been given.
- **What it does to the voice.** Boss Daddy leads from a *secured* identity, not from anxiety or self-justification. The Standard is fruit, not the price of admission — a changed life and good works flow *from* grace; they never buy it. So the tough-love edge aims at mediocrity, never at a man's worth: we call men higher because they are already accepted, not so they can earn it. Hustle-for-approval copy ("prove you're worthy," "earn your place") is off-voice. Grace raises the bar; it never lowers it — the call to action stays loud. *Boss Up.* is what a man does with what he's been given.
- **Household leadership frame.** A father's job is serving God's will by protecting, providing, teaching, and modeling these realities for his family — gently, consistently, without coercion. Connect faith to the everyday: presence, discipline, provision, and the long work of raising children.
- **Posture: invitational, not evangelistic.** Clear, humble, *for* something. Share what changed him the way you'd tell a friend at the table, never as a pitch. No theological debate language, no attacks on other views, no moralizing about another man's choices or walk. Say what we're for and how it shapes the home.
- **Quietly undergird, never dominate — the density is topic-driven (settled 2026-10-30).** These convictions sit under the writing; they don't surface in every sentence. **Product, review, how-to and money content:** faith is undertone only — steadiness, at most one natural reference, no scripture unless the author's notes brought it. **Discussion pieces, faith topics, the About story:** conviction spoken plainly, scripture in context, still never a sermon. The failure he is guarding against is a gear review that reads like a church bulletin — not a Table Duty essay that says what he believes.
- **"Never preach" — what it means.** Preaching is saturation and sermon: scripture stacked into a piece that didn't ask for it, a lecture aimed at the reader, a verse used as a club, judging another man's walk. Stating what you believe and have lived, where the subject earns it, is *witness* — not preaching. The critic flags sermon creep (density) and lecturing (posture); it never flags a conviction for being a conviction.
- **Grace is not permissiveness.** Mercy keeps the Standard and shows the way back; soft parenting denies there is one. The soft-parenting banlist ("no judgment," "you do you," "every child is unique") stays banned — those are permissive tells, not mercy.
- **Gentle is not soft.** Gentleness is strength under control; soft is the absence of a standard. A father leads with authority and a clear bar, delivered without coercion.
- **Doubt is a subject, not a posture.** We take the reader's doubt seriously, and the author lived his own season of it (ten years of asking before the answer). It is not his current posture on the foundation — honor the reader's doubt; don't perform your own.
- **Mechanics.** Referenced naturally when it fits ("we lead our households," "what we owe our wives and kids"). No scripture dropped without context — one verse in context carrying real weight beats three sprinkled in. Language stays natural for a modern dad site: clear, direct, human; never churchy or academic. Faith content earns its own posture — warm, steady, grounded, not cynical — and the edge is OFF (below).

*Inquiry register — philosophical & moral discussion (scoped exception)*
- **What it's for:** meaning and purpose, faith and doubt, the existence of God, death and grief, duty, conscience, what a life is for, what we're handing our kids. It is the house default for **Table Duty** and **Watch Duty**, and it can be switched on for any pillar when a piece has earned it (a Health & Wellness essay on grief and faith wants it).
- **Humble in posture, decisive in substance — a witness, not a student (rewritten 2026-10-30).** Both halves are load-bearing, and the failure modes run in both directions: the abrasive verdict-first hot take on one side, the wishy-washy survey that never commits on the other. The second was the register's actual failure mode as first written, so the bullets below are weighted toward landing.
- **Witness, not student.** The author is a man who has done the thinking, reached his convictions, and is showing his work — not a student thinking out loud, and not a judge handing down a verdict. Humility governs the *tone* and how he treats the reader (show the reasoning so a reader can follow it and disagree); it never governs *whether he has an answer*. He does. The reader is free to disagree. The author is not undecided.
- **Land it, and land it as a conviction.** Make a real attempt at an answer — a position, an explanation, a way of thinking that actually helps — and close on it. A piece that circles a question and walks away has failed the reader. The closing is the position restated as something you believe, with the reason it convinced you — not a recap, not a caveat paragraph, not "ultimately it's up to each dad." A closing question is welcome *after* the answer, never instead of it.
- **Use what's already known.** Philosophy, theology, psychology, history and hard-won common sense have serious answers to most of these questions. Bring them, say where the weight of thoughtful opinion sits, and name which view convinces you. Don't reason from scratch on a question people have worked on for millennia.
- **Answer the opposing view where you raise it.** Engage the strongest version, never a strawman — then say, in the same part, specifically where it fails and why you still land where you land. Airing an objection at full strength and calling it a draw is this register's failure mode, not a sign of fairness.
- **Doubt belongs to the reader, not the performance.** Honor his objections; never shame him for them. Don't perform your own: no "I don't know" on the thesis, no closing shrug. "I don't know" is allowed once, on a *named* sub-question, attached to what you do think (§1.6 Faith — *Doubt is a subject, not a posture*).
- **Suspended here:** the four gear content pillars (Practical Win / Family Proof / Honest Assessment / Value Play) and affiliate links. Don't force a gear-style action item onto a moral question — what you owe the reader is clearer thinking.
- **Hedges (may/might/could) are tolerated here, not free.** Use them to describe a view you are not taking or a sub-question you have named as open — never on the thesis, never in the closing. The critic still counts them (the closing is held to the strict count). Vagueness is still banned.
- **Faith speaks from conviction.** Faith is lived, not preached — no sermonizing, no judging another man's walk. But when a piece touches the foundation (§1.6 *Faith — the foundation*: grace through faith), the author states it as what he believes and has lived, not as one option he's weighing. Show the reasoning that brought you there rather than letting a verse stand in for it; honor the reader who isn't there yet; don't pretend to be undecided about the thing that changed your life.
- **Weight varies with the subject** — some pieces are hard-won life lessons, others are genuinely fun thought experiments. Match it. **Humor stays on here**, including at controversial ideas, trends and cultural fashions (see *Humor calibration*). The line is persons, loss, grief and safety — not controversy.
- **A clear moral position is required; party politics is banned.** Taking a stance on a moral or cultural question is the job, not a violation — say what's right, what's wrong, and what a father should do about it at his own table. **Judge ideas, choices and culture out loud; never judge men.** *Partisan* means party: no candidates, parties, campaign framing or team-sport scorekeeping, and no personal attacks on named people. Every piece answers one question: **why does this matter at the family table?** (fathers, family, faith, the next generation).
- Warm Protector mode still auto-engages on vulnerability (loss, mental health, struggling dads); the rest of the banlist still applies.
- **Table Duty** = timeless conversation; **Watch Duty** = timely, with a freshness window (weeks, then archive or grow into a Table Duty essay). Same register for both. Scope + boundaries: `docs/pillar-taxonomy.md`.

> **How it fires (execution layer).** The register is opt-in, never ambient: `BOSS_DADDY_SYSTEM` only applies it when the user message carries a literal `INQUIRY MODE: ON` line. The guide wizard's **Inquiry mode** toggle sends it — checked by default for `table-duty`/`watch-duty` (`isInquiryCategory()` in `lib/categories.ts`), overridable in both directions. `guide-draft`, `guide-refine` and `suggest-prompt` all honor the flag; refine infers it from the article's category, since the mode isn't persisted on the row. The submit-time moderator (`MODERATOR_SYSTEM`) has the matching carve-out and judges these as essays — it derives the mode from the pillar rather than accepting it from the caller, because a compliance gate must not be steerable by what it is gating. The pipeline enforces the posture (2026-10-30): the critic's rules block a shrug in the closing (`inquiry-shrug`), count hedges in the closing, note a piece that ends on a question, and note scripture in a gear piece (`scripture-in-gear`); the editor model blocks a piece that never lands and never flags a stance for being a stance.

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
- Preach faith — it's the foundation, not the lecture. And never turn it into performance: no copy that makes a man's standing with God something he has to earn. Stating conviction where the subject earns it is witness, not preaching — "never preach" is the density rule in §1.6.
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

The site runs a **light editorial canvas**: no `data-theme` on `<html>` (`lib/canvas.ts` decides; `BD_CANVAS=dark` restores the dark page for a side-by-side). White page, near-black text, hairline borders, orange as the ONLY accent — core `#CC5500` on white. **The chrome stays near-black.** `Header` (with its 4px orange rule), `Footer`, `MobileBottomNav`, `StickyMobileCta`, the About band (the Creed's home), the `(dashboard)` layout, and the utility-lane black panels (the Tools tiles, the bench header strip) wrap themselves in `data-theme="dark"`, so the black / orange / white edge lives in the frame and in the blocks — not in the reading surface. No gold, no per-type rainbow, no cream/peach/brown, no vivid `#f97316`.

**Hard Goods (committed 2026-10-14 — §10.1).** The light page is LOUD through **solid blocks**: black panels and orange fills in the utility lane and at brand moments, never a dark canvas, never a wash. The homepage brand band is an ORANGE block with chrome-black ink (desktop only; on a phone the tagline folds into the masthead). Reference brands: STIHL (the palette twin), DeWalt (black panel + hot accent), Men's Health (loud editorial).

Why light: every comparable publication (Wirecutter, Strategist, Gear Patrol, Fatherly, Uncrate) runs light; the dark-first build (2026-06 → 2026-10) read as software, not as a magazine. Why loud: five days on the quiet light page the utility surfaces (tools, bench, author) "felt plain" — grey panels, muted eyebrows and hairline chips vanish on white. Full rationale and rollout: `docs/light-editorial-plan.md`; the commit, lock list and moratorium: §10.1.

> **Elevation = whitespace, rules, and blocks.** Content cards are **borderless** (image + type + one hairline above the footer). The utility lane is **boxed or solid**: 2px chrome-black boxes (the bench, the author card), black panels (Tools), orange blocks (the newsletter, the desktop brand band). Forms and dashboard panels keep `border-soft` + the raised tier; floating panels (Modal, Menu, search) use the overlay recipe — `border-2 border-prose` (`components/ui/overlay.ts`). No drop-shadows on content — `check:shadow` still bans `shadow-black/*` as a design rule; overlays may use bare `shadow-*`.

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
| `--bd-border-strong` / `--color-strong` | `#d4d4d8` | `#3f3f46` | Outline buttons, chips, form-field edges |
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

### Images — where AI is allowed and what it may show (content pipeline Phase 3, 2026-10-23)

Owned photography first (📷 Take Photo), then a brand kit, then an AI **scene**. AI never replicates the product; brands, logos and packaging are pinned off in every lane (`lib/images/safety.ts`). What else is allowed depends on **where the image is used**:

| Surface | AI allowed? | Text in image | People | House style |
|---|---|---|---|---|
| Review hero | A category scene only — never the product | Never | **Anonymous** by default (hands, a figure from behind, face out of frame); knob: None / Anonymous / Faces OK | Yes, stored at 16:10 |
| Guide hero | Yes | Never | Anonymous default, same knob | Yes, 16:10 |
| Body figures + galleries (reviews, guides, collections) | Yes | Never | Anonymous default; Faces OK is an explicit per-piece choice | Yes, 3:2 |
| Media library, X Studio, social | Yes | Allowed (knob) | Allowed (knob) | Off |
| OG / share cards | Rendered from the hero by code | Text set by code, never by the model | — | — |

Two rules hold in every lane: **no identifiable children, ever**, and no brands. Why anonymous: an AI *face* is the uncanny-valley tell and reads as a fake testimonial next to a first-person "I tested this" voice; a figure from behind keeps the warmth. Rendered text is the other tell, and the site composes text in code. Every editorial-lane result is checked by vision QA (`lib/images/qa.ts`) against the same rules — text, a logo or a face under None/Anonymous regenerates once automatically; a refusal is surfaced to the author, never swapped for a stock scene.

**One photographer shot the whole site:** the language models describe the *subject* only; lighting, lens and palette come from the single house-style suffix in `lib/images/style.ts`. **Publication quality is the default** (gpt-image-1.5 · high); the draft tier is for roughing out a composition.

**Credit line, not a badge.** A figure's provenance renders in the figcaption — "AI-generated scene" or "Photo: Boss Daddy" (`lib/images/credit.ts`) — and a hero gets the same line under it. Never a badge over the photo: one mark per image at most, and the hero may already carry Boss Approved. Imported images (web / Amazon) get no credit; naming a source we did not shoot would be a rights claim. **Detail-page heroes are `aspect-[16/10]`**, matching the upload cropper; body figures render through `next/image` with their stored size (`media_assets.width/height`, mig 166) and the sitewide 4px radius.

### Status colors (chips / pipeline indicators)
| Status | Color | Use |
|---|---|---|
| `testing` | `text-green-400` | Live testing pulse |
| `queued` | `text-blue-400` | Coming soon |
| `considering` | `text-amber-400` | Voting / pipeline |
| `reviewed` | `text-accent` | Done / shipped |

For bordered chips prefer the token recipe (`bg-{danger,success,warn,info}-bg` + `border-…-line` + `text-…-ink`) — it inverts correctly inside the dark zones.

### Blocks — where black and orange fills are allowed (Hard Goods, 2026-10-14)
The loudness mechanism is **solid blocks on the white page**. A black panel is a `data-theme="dark"` zone — every token inside it inverts by itself; never fake one with `bg-zinc-950` and hand-set colours. An orange block is `bg-accent` with **chrome-black ink** (`text-chrome`: 4.6:1 on `#CC5500`; the prose black is 4.1:1 and white is 4.3:1, both miss AA at body size), so an orange block is never a dark zone and never carries white body text.

**Allowed:** the masthead's 4px orange rule · the desktop brand band (orange) · section label blocks (black) · the Tools panels (black) · the newsletter block (orange) · the bench header strip (black) and its status chips (orange = testing, black = queued) · the square score chip (orange) · the "Top pick" tag (black, orange type) · the About band (black, orange top rule) · the Footer (black, orange top rule) · buttons.

**Never:** inside an editorial card, a listing row, or an article body; as a section background on an editorial surface; as a tint or wash. One orange block on a screen at a time is the ceiling.

### The section header convention — two lanes (settled 2026-07-27)

There are **two** sanctioned section-header shapes. Pick by surface, never by taste, and **never inline either pattern**:

| Lane | Component | Shape | Use on |
|---|---|---|---|
| **Editorial** | `EditorialHeader` | **black label block** (role) + uppercase Montserrat black title + 3px black rule under the lockup + optional **outline button** (Hard Goods, 2026-10-14) | public editorial surfaces — homepage, listings, editorial pages |
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
| Editorial page H1 (`PageHeader`) | `font-black uppercase text-4xl md:text-5xl leading-[1.0] tracking-[-0.01em]` under a `LabelBlock`, closed by a 3px chrome rule | Interior page band (Hard Goods, 2026-10-14) — the `EditorialHeader` lockup one size up |
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

### Corner radius (squared 2026-10-14 — Hard Goods)
The Tailwind radius scale is **overridden globally** in `app/globals.css` `@theme inline`, so every `rounded-*` call site tightens together and the ratio between tiers holds. Keep writing `rounded-xl` / `rounded-2xl`; the values are the design's:

| Class | Renders | Use |
|---|---|---|
| `rounded-sm` | 2px | square tags, status chips, thumbnails |
| `rounded-md` / `-lg` / `-xl` / `-2xl` | 4px | inputs, buttons, cards, images, panels, boxes (one radius) |
| `rounded-3xl` | 6px | hero / cover packages |
| `rounded-full` | pill | avatars in chrome, dots, the live-testing dot, the `Switch` track (the one sanctioned pill control: no text, no padding) — **not** filter chips (square since 2026-10-14) and **not** badges over photos |

Tailwind's defaults (12 / 16 / 24px) are the SaaS silhouette; the 2026-10-08 editorial pass ran 8px; the approved Hard Goods mockup ran 4px on every image, tile, panel and button, and the scale follows it **sitewide** (left flexible at the commit — the utility-only alternative is a seven-line revert in `globals.css`). Tune in one place, never per component.

### Border principle — hairlines, no boxes
- **Content cards are borderless.** `LeadCard`, `LibraryGuideCard`, `ReviewCard`, the cover story, the lead guide: the image carries `rounded-xl overflow-hidden`, the copy sits flush with the image's left edge, and the only rule is the hairline above the footer. Hover = title to `text-accent` + a 2px lift.
- **Rows separate by hairline** (`border-b border-soft`), never by card.
- **Utility surfaces keep the box — and since Hard Goods the box is heavy.** Public utility modules are `border-2 border-chrome rounded-xl` (the bench, the author card) or solid blocks (the Tools panels — §2 "Blocks"). `components/ui/Card.tsx` stays `bg-surface rounded-xl border border-soft` for forms, menus, dashboard panels. Soft panels (`bg-surface-raised`, no border) remain for Key Takeaways and similar in-article asides — not for a module that has to hold its own on the white page.
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

### Blocks, not alternating tints
Editorial sections sit on the white canvas and separate by whitespace + a hairline (`border-b border-soft`) — never by alternating grey tints (tested and dropped early as amateurish). The loud moments are **solid blocks** in the utility lane (§2 "Blocks"): the Tools panels, the orange newsletter block, the bench box, the About band. A block is a *different kind* of treatment, not the same tint turned up.

### Masthead + brand band (Hard Goods A2, the folded masthead — 2026-10-14)
- **Masthead** (`Header`): solid near-black at every scroll position, white uppercase wordmark, a **4px orange rule** beneath — the stripe. On a phone the tagline sits under the wordmark as a 9px orange signature line; on lg+ that line hides. Desktop nav = **Explore · Gear · Shop** left, **Tools** right beside the account, plus **Gifts** in season once a seasonal guide is live (nav-ia-plan I-7). Plain links, no menus — the masthead carries the places, the row beneath it carries the topics. Every surface that names a pillar uses the same word (`LABELS.*.short`).
- **Topics row** (`CategoryBar`): white, 44px, uppercase Montserrat labels, directly under the masthead at every width. A scroller on a phone, a divided strip on lg+. Active topic = 3px orange underline. Scrolls away with the page (the masthead sticks). **This row is the topics nav** — the masthead's Topics ▾ mega-menu was retired 2026-10-14 as a second topics nav stacked on it (and ~85px of a bar that was over capacity below ~1150px).
- **Brand band** (`HomeHero`, homepage, **lg+ only**): a solid orange block, 72px — the tagline in uppercase Montserrat black on the left, the in-motion ticker on the right, chrome-black ink. No photo, no subhead, no link; the cover story is the first screen.
- **No band on a phone.** The black masthead + an orange stripe stacked read as "two header nav bands" (his one objection at the Step 2 read); the fold is the fix. Don't reintroduce a mobile band. The hero photographs stay in `public/images` for `/about`. Re-raised and held the same afternoon (2026-10-14): masthead 68px + a ~40px band + the 44px row = 152px of chrome before content, ~28% of a Galaxy viewport with the bottom strip, for a line that navigates nowhere; the folded tagline delivers it at zero height. The open knob if the phone wants more orange is the tagline's SIZE (9px today), never a band.
- **Order is fixed: masthead → topics row → (homepage only) band.** The masthead and the row are chrome on every page; the band is homepage content. Putting the band between them was considered and declined 2026-10-14 — the row would sit 72px lower on the homepage than on every other page, i.e. the nav would move between pages. If the band reads detached after the white row, weight its top edge; don't relocate the nav.
- **Topics-row edge fades** (phone/tablet): the scrollbar is hidden, so each end of the row carries a 32px fade from the page background that hides at its own end of travel. The row is a lateral-browsing aid, not the primary nav (that's the strip; Explore is the door to every topic), so position bias toward the first four labels is expected.

### Section opener pattern (editorial surfaces)
Every editorial section opens with `EditorialHeader` — never inline the pattern:
```jsx
<EditorialHeader eyebrow="Tools" title="Built for the job" right={{ label: 'All tools', href: '/tools' }} />
```
Renders: a black **label block** (`LabelBlock`, the role) → uppercase Montserrat black title (26px / 34px) → a 3px chrome-black rule under the lockup, with the optional right action as the **outline button** (`buttonVariants({ variant: 'outline', size: 'sm' })`). Utility/admin surfaces use `SectionHeader` (§2, two lanes).

### Closing (homepage)
The page ends with a deliberate punctuation:
- 24px-wide centered orange hairline rule above
- `— THE BOTTOM LINE` eyebrow
- `text-3xl md:text-5xl font-black` closing tagline
- `py-24 md:py-32` generous padding

---

## 6. Component Patterns

### Card skeleton (review / guide / wishlist / shop)
Real pattern (see `LeadCard.tsx` / `LibraryGuideCard.tsx` / `ReviewCard.tsx`): semantic tokens only, **borderless**, image carries the radius, Montserrat extrabold title, quiet eyebrow, one hairline above the footer, hover = title colour. At most ONE square tag over the image (the Boss Approved tag, or a `bg-chrome text-white rounded-sm` tag). No border, no shadow, no lift transform. See §4.

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

### Filter chips (square since Hard Goods, 2026-10-14)
One primitive, never inline: `PillFilterStrip` + `PILL_BASE` / `PILL_ACTIVE` / `PILL_INACTIVE` from `components/ui/PillFilterStrip.tsx`. The chip is the outline button one size down — 2px border in the text colour, uppercase Montserrat 11px, 4px corners, 44px tall, black fill when active. The `rounded-full` pill was the SaaS tell on white; the approved mockup ran square chips, so the homepage topic chips and every listing filter strip (`/reviews`, `/guides`, `/gear`, the category pages, `CategoryFilterPills`) match.
```jsx
<PillFilterStrip className="mb-12">
  <Link href="/guides" className={`${PILL_BASE} ${PILL_ACTIVE}`}>All Guides</Link>
  <Link href={`/guides/category/${slug}`} className={`${PILL_BASE} ${PILL_INACTIVE}`}>{label}</Link>
</PillFilterStrip>
```

### Buttons (Hard Goods, 2026-10-14 — `components/ui/Button.tsx`, never by hand)
Every button is **Montserrat, uppercase, tracked `0.08em`, 4px corners** — a stamp, not a pill. Pick a variant + size; `className` is for layout only.
- **`primary`** — `bg-cta` (black on the page, hot orange inside dark zones), orange hover.
- **`outline`** — 2px border in the text colour, inverts on hover (black-on-white on the page, white-on-black in zones). The section-header action, "How I test".
- **`onBlock`** — the primary button when it sits on an ORANGE block: black, hover inverts to white (a `primary` would hover to orange and vanish). The newsletter.
- **`success`** — a confirmation state ("Added to cart"), the success token recipe; not a call to action.
- **`secondary` / `ghost` / `danger`** — forms, toolbars, destructive. Unchanged roles.
- **Tracked-caps action link** (not a button): `font-display font-extrabold text-[11px] uppercase tracking-[0.1em] text-accent-text hover:text-accent` — the bench "See the bench", "More from …".

### Blocks & utility-lane recipes (Hard Goods, 2026-10-14)
- **Label block** — `LabelBlock` (`components/ui/LabelBlock.tsx`): `bg-chrome text-white font-display font-black text-[11px] uppercase tracking-[0.16em] px-2.5 py-1.5`; `tone="accent"` inside dark bands. Names the ROLE.
- **Black panel** (Tools): `data-theme="dark" bg-chrome text-prose border-t-4 border-accent rounded-xl p-5` → orange kicker `text-accent-text`, white title, `text-prose-faint` blurb, `buttonVariants('primary')` (hot orange in the zone).
- **Orange block** (newsletter, the desktop band): `bg-accent text-chrome`; fields `bg-surface border-2 border-chrome`; button `onBlock`.
- **Bench box**: `border-2 border-chrome rounded-xl overflow-hidden` → black header strip (`data-theme="dark" bg-chrome`, live dot, uppercase label, orange link) → hairline rows → **solid status chip** `font-display font-black text-[10px] uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-sm text-white` + `bg-accent` (testing) / `bg-chrome` (queued).
- **Product tile** (`TopPicksBoard`): `aspect-square rounded-xl bg-surface-sunken border-b-[3px] border-chrome` image well; "Top pick" tag `bg-chrome text-accent` top-left; quiet eyebrow; `font-extrabold text-[15px]` name; **square score chip** `RatingScore variant="chip"` + "Paid $X" in ink.
- **Author card**: `border-2 border-chrome rounded-xl p-4` → square 52px portrait, uppercase name stamp, muted tagline, bio, tracked-caps link.
- **Utility box** — `Card tone="chrome"` (`components/ui/Card.tsx`): `bg-surface border-2 border-chrome rounded-xl`. Every public utility module (verdict, product CTA, testing log, specs, comment form, tool tiles, chat). `tone="surface"` (hairline) stays for forms, menus, dashboard panels.
- **Status chip** — `Badge` (`components/ui/Badge.tsx`): square `rounded-sm`, Montserrat 10px caps. `neutral` = the inverted stamp (black on the page, white in zones), `accent` = orange, `muted` = quiet grey; `info/success/warn/danger` keep the bg/line/ink token recipe (it inverts in zones; a solid ink fill would not). Domain files map status → tone; this file owns the look.
- **Dialog** — `Modal`: `bg-surface border-2 border-chrome`, no shadow, `backdrop:bg-chrome/80`. **Toasts / banners** (welcome, install): black panels. **Empty state** — `EmptyState variant="subtle"`: 2px chrome box.

### Index numbers (More Reviews TOC treatment)
```jsx
<span className="absolute top-3 left-3 px-2 py-0.5 bg-black/60 backdrop-blur-sm text-orange-400 text-[10px] font-bold tracking-[0.2em] tabular-nums">
  {String(i + 1).padStart(2, '0')}
</span>
```
Magazine table-of-contents detail. Used on the More Reviews grid on the homepage.

### Empty states
One primitive: `EmptyState` (`components/ui/EmptyState.tsx`). `variant="subtle"` (public listings, search) is a **2px chrome box** with a Montserrat-black title — the quiet grey tint it replaced vanished on white and read as broken. `dashed` invites creation on member surfaces; `panel` is the hairline box inside admin lists. Never hand-roll one.

### Boss Approved mark (flat since 2026-10-14)
- `size="sm" variant="card"` — the square orange tag over a review thumbnail (`bg-accent text-white rounded-sm`, 10px Montserrat caps, "✓ Approved"). It is the card's ONE image mark, top-left.
- `size="sm" variant="page"` — the inline chip in sidebars / Quick Verdict.
- `size="lg"` — the round seal on the review detail header: the one brand moment that keeps a circle. No shadow, no ring, no rotation on any variant.
- Component: `components/BossApprovedBadge.tsx`. Shown when `rating >= 8`.

---

## 6a. Continuity primitives (2026-10-14 — `docs/continuity-fix-plan.md`)
The post-Hard-Goods sweep moved every stateful / member / overlay / transactional surface onto shared primitives. Pick one; never rebuild it by hand (`npm run check:hard-goods` — part of `prebuild` and the pre-commit hook, baseline empty — fails the build on the dark-era constructions it replaced).
- **`Menu` + `useDisclosure` + `MenuTabs`** (`components/ui/Menu.tsx`, `lib/hooks/useDisclosure.ts`) — every dropdown/drawer; panel = the overlay recipe. Items close the menu on select, so a confirm dialog must live outside it.
- **`IconButton` + `CountBadge`** — 44px icon controls and the orange count dot. **`Avatar`** — round member avatar with initial fallback (author portraits stay square).
- **`Field`** (`fieldClass`) — every input/textarea/select: 16px (no iPhone zoom), 44px, label + error wiring. **`Switch`** — the on/off control; its track is the one sanctioned pill.
- **`useConfirm`** — Modal-based `confirm`/typed `prompt`; destructure as `askConfirm`/`askPrompt` (the guard's R5 flags any call spelled `confirm(`). Never native `confirm()`/`prompt()`/`alert()`.
- **`Notice`** (banner / toast / inline), **`RouteError`** (every `error.tsx`), **`ProgressBar`**, **`Segmented`**, **`QtyStepper`**, **`PageHeader size="compact"`** (LabelBlock + uppercase H1 + 3px rule in the caller's column), **`NewsletterSignup`** (all signup variants; core in `lib/newsletter/subscribe.ts`), **`ToolCard`** (tool tiles + result panels).
- **Overlay recipe** — `OVERLAY_PANEL` in `components/ui/overlay.ts`: `bg-surface border-2 border-prose rounded-xl`, no shadow. Modal, Menu and search all use it.
- **Ink rule (blocks vs chips):** a *block* (panel/band) on orange carries chrome-black ink; *chips* — score, status, count badge, avatar initial, zone primary button — are small bold and carry white ink. Only body text on orange is a defect (guard R1).

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
- Column footer: Brand · Browse (Explore · Gear · Shop · Tools, + Gifts in season) · Topics · Trust & Legal.

### Listing pages (`/reviews`, `/guides`, `/bench`, `/gear`, category + tag pages)
- `PageHeader`: black label block (the role) → uppercase Montserrat black H1 → optional deck → 3px chrome rule. No hero gradient, no count line (no vanity metrics).
- Square filter chips below the header via `PillFilterStrip` (where applicable).
- Section openers: `EditorialHeader` on editorial listings; `SectionHeader` (orange vertical rule) on `/gear` only.
- Cards are the borderless editorial card (`ReviewCard` / `LibraryGuideCard` / `LeadCard`) — reuse them; don't re-skin a bordered copy per page.

### `/gear` — unified Gear + Merch page
- "Shop" is **not** a separate top-level concept. The unified `/gear` page hosts both:
  1. **Boss Daddy Approved Gear** — the curated top-rated picks from reviews (rating ≥ 8.0). The substance.
  2. **Made by Boss Daddy** — featured panel for branded merch, sits between the category filter and the gear grid. Renders a tight coming-soon callout when no merch is live; renders a 3-up product grid when products are available.
- Hero copy: *"Boss Daddy Approved Gear"* H1 + *"Field-tested by a real dad. And, soon, made by one."* tagline.
- `/shop` 301-redirects to `/gear` for SEO + bookmark continuity.

### Detail pages (`/reviews/[slug]`, `/guides/[slug]`, comparisons, picks, stacks, bench)
- Article header with the score ring (`ScoreBlock variant="ring"` / `ScoreArc` — the sanctioned hero moment) + meta; category and bench links are square chips.
- Hero image at `rounded-xl` (4px). Title Montserrat `font-black`, body sans on bare canvas; the article prose stays clean — no blocks inside it.
- **Utility modules are chrome boxes** (`Card tone="chrome"`): the verdict, the product CTA, the testing log, specs (table frame + `bg-chrome` header row), the comment form, "Products mentioned". The sidebar verdict may be the page's one black panel. Status/state chips (`Badge`): would-rebuy, "From the bench", "Best for", roles, winners. No shadows, no tints.
- Key Takeaways and the in-page TOC stay quiet asides (`bg-surface-sunken`, hairline) — they are in-article, not modules.
- Author bio at the end is the shared `<AuthorBio />` 2px box.
- Related / More rails: `EditorialHeader` (outline button for "see all") over borderless cards or flush hairline rows. Comments are flush rows under a `SectionHeader`.

### Static / legal pages (`/about`, `/how-we-test`, `/terms`, `/privacy-policy`, etc.)
- Legal and policy pages open with `PageHeader` (eyebrow = the page's role), then prose. Text-led: no card system.
- `/about` keeps its bespoke two-line H1 (exempt from `PageHeader`); its stats sit in ONE black panel (orange numbers are legal inside it), topics are square chips, section headers are `EditorialHeader`.
- `/how-we-test`: tiles are chrome boxes; the "Boss Daddy Approved" callout is the page's one black panel.
- `prose max-w-none` for body copy — colours come from the role tokens (`.prose` in `app/globals.css`); no `prose-invert`.

---

### App-page anatomy (account · tools · commerce — 2026-10-14)
Authenticated and transactional pages share one skeleton: `PageHeader size="compact"` (with `back` to the parent) → container `max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12` (tools/commerce widen the column, never the anatomy) → sections as `Card tone="surface" p-6` led by an `Eyebrow` → `Field` inputs, `buttonVariants` actions (primary save, outline cancel, danger destroy), `EmptyState` for nothing-yet → the danger zone is the last card. Messaging bubbles follow the `BossChat` recipe (own = chrome black, theirs = surface + hairline). The dashboard/workspace/admin are an out-of-scope dark zone and inherit primitive changes only. Reference pages: `account/connections`, `account/settings`.

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
| `ReviewCard` | `components/ReviewCard.tsx` | `/reviews`, category + tag pages, `/gear` |
| `LabelBlock` | `components/ui/LabelBlock.tsx` | The black (or orange, in zones) role stamp — `PageHeader`, `EditorialHeader`, module headers |
| `PillFilterStrip` + `PILL_*` | `components/ui/PillFilterStrip.tsx` | Every square filter / selector chip strip |
| `Badge` | `components/ui/Badge.tsx` | Every status / state chip |
| `LibraryGuideCard` | `components/LibraryGuideCard.tsx` | `/guides/category/[slug]` 3-up grid. Takes `on={'background' \| 'surface'}`. Replaced `guides/_components/GuideCard.tsx` (deleted 2026-08-03). |
| `LeadCard` | `components/LeadCard.tsx` | Lead half of a "Template A" module. Takes the same `on` prop. |
| `ContentRow` | `components/ContentRow.tsx` | The compact directory row, site-wide: text left, thumbnail right. **The editorial lane.** `/gear` keeps its own image-left rows on purpose — don't convert it. |
| `TopicBlock` | `components/TopicBlock.tsx` | A category as `LeadCard` + `ContentRow`s. Behind the homepage Library, `/guides`, and `/reviews` — one pattern, three surfaces. Blocks alternate handedness by `index` (serpentine); rows mirror with them. Settled 2026-08-03 — see `home-manifesto-spec.md`. |
| `WishlistCard` | `components/wishlist/WishlistCard.tsx` | `/wishlist` |
| Continuity primitives (§6a) | `components/ui/{Menu,IconButton,CountBadge,Field,useConfirm,QtyStepper,Avatar,Segmented,RouteError,Notice,Switch,ProgressBar,overlay}`, `components/newsletter/NewsletterSignup.tsx`, `components/dad-tools/ToolCard.tsx` | Every menu, form, dialog, signup, tool tile |
| Emails | `emails/_components/EmailLayout.tsx` (`EMAIL_COLORS`, `EmailButton`) | Light shell: black masthead + 4px orange rule |
| Hard Goods guard | `scripts/check-hard-goods.mjs` (+ `hard-goods-baseline.json`, empty = strict) | `prebuild` + pre-commit |

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
| **Hard Goods — the design commit** (2026-10-14) | Five days after the light flip the operator was "unsure about our recent editorial commitment"; the utility surfaces (tools, bench, author) read as plain. A four-step process (brief → three directions on real content → comparison → recommendation) ended in **A Hard Goods** — "I really like the usage of colors and contrast"; "all three are an upgrade" — loud through SOLID BLOCKS (STIHL / DeWalt), not through type (B Newsstand) or scale (C Showroom). Mockups: `docs/mockups/directions/`. Lock list + moratorium: §10.1. |
| **A2 — the folded masthead** (2026-10-14) | His one objection to A: on a phone the black masthead + orange stripe "looks like two header nav bands". Fix borrowed from B: the tagline folds under the wordmark as a 9px orange signature and the topics row takes the band's slot; the orange band + ticker stay on desktop. Chosen over A3 (a taller fused masthead). |
| **4px radius sitewide · uppercase section titles** (2026-10-14) | Both left flexible at the commit; built to match the approved mockup. Each is a one-place revert (`globals.css` radius scale; `EditorialHeader`). |
| **Orange-block ink is chrome-black** (2026-10-14) | White on the core orange is 4.3:1 and the prose black 4.1:1 — both miss AA at body size; `#09090b` clears it at 4.6:1. So an orange block is never a dark zone and never carries white body text. |

### 10.1 Design commit — Hard Goods, folded masthead (A2) · 2026-10-14

**Process.** Four steps, 2026-10-13 → 14, pausing for the operator after each: (1) discovery brief — light stays; LOUDER; two lanes; premium / clean / rugged; likes = STIHL, DeWalt, Men's Health, AppleInsider, Brickell; cringes = GQ, PCMag, Reviewed, Ape to Gentleman; (2) three directions rendered on REAL content — A Hard Goods (loud through blocks), B Newsstand (type + density), C Showroom (scale + space) — `docs/mockups/directions/` (`node docs/mockups/directions/build.mjs` regenerates); (3) comparison table; (4) recommendation. **He picked A** with one objection (two stacked bands on the phone), fixed by folding the tagline into the masthead with B's masthead handling. **A2 chosen 2026-10-14.** Spec = `a2-hard-goods-folded.html` and the `A_CSS` / `CATROW_CSS` / `A2_CSS` strings in `build.mjs`.

**LOCKED** — not reopened inside the moratorium:
- Light canvas (white page, near-black text).
- Montserrat-only headings (Fraunces = the Creed only).
- One orange (`#CC5500` page / `#E55A1A` zones); black is the second colour.
- **Loud through blocks** is the mechanism — solid black and orange panels on the white page; never a dark canvas, never washes.
- **Two lanes + the blocks rule** (§2 "Blocks"): editorial surfaces are type- and photo-led; black panels / orange fills belong to the utility lane and brand moments ONLY — Tools, the newsletter, the bench header strip, score chips, status chips, section label blocks, the About band, the masthead rule. **Never inside editorial cards or article bodies.**
- Phone masthead = folded (wordmark + small orange tagline) + the topics row. **No band on a phone.**
- Desktop = the orange band + ticker under the masthead.
- Black Tools panels · boxed bench with a black header strip + solid status chips · grey product tiles + square orange score chip · orange newsletter block · black section label blocks · uppercase buttons at 4px.

**FLEXIBLE during the build** — settle on the phone, no process needed: 4px radius sitewide vs utility-only (built sitewide) · uppercase vs sentence-case section titles (built uppercase) · exact grey tiers · Latest-list density · author card detail · shop strip · the "best for" line · whether `SectionHeader` (utility/admin) adopts the label block · the cover story's score treatment (ring today; the mockup had a square orange block).

**MORATORIUM.** Clock starts **2026-10-14**. No change to the canvas, the heading face, the loudness mechanism, or the mobile masthead for **90 days or until 12 new pieces publish, whichever is LATER** — earliest reopen **2027-01-12**, later if fewer than 12 pieces are out by then. It reopens ONLY on (a) reader evidence — analytics, or three or more unprompted reader comments on the look — or (b) the implemented masthead failing the operator's own phone walkthrough. **"Looked at it and felt unsure" is explicitly NOT a trigger**; that doubt is what this process was for. `BD_CANVAS=dark` stays as the escape hatch (default-safe, keep the knob) but is not a reopen path.

**Built 2026-10-14** (the implementation of the lock list): `Button` (uppercase Montserrat; `outline` + `onBlock` variants), `LabelBlock`, `EditorialHeader` (label block + 3px rule + outline action), `Header` (4px orange rule, phone tagline under the wordmark, scroll-state removed), `CategoryBar` (every width), `HomeHero` (orange band, lg+), `BossToolsSection` (black panels), `BenchStrip` (box + black head + solid chips), `AuthorBio` (2px box), `EmailCaptureSection` (orange block), `RatingScore variant="chip"`, `TopPicksBoard` (square grey tiles), `AboutBand` + `Footer` (4px orange rule), radius scale 4px.

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
Chrome (zones)   data-theme="dark" + bg-chrome #09090b   (header, footer, nav, About band, Tools panels, bench head)
Masthead         solid chrome + border-b-4 border-accent · phone: 9px orange tagline under the wordmark · topics row beneath (CategoryBar)
Brand band       HomeHero — lg+ ONLY: bg-accent text-chrome, uppercase tagline + ticker · no band on a phone
Blocks           black/orange fills = utility lane + brand moments ONLY (§2) · orange-block ink = text-chrome, never white body text
Card surface     bg-surface #ffffff · raised bg-surface-raised #fafafa · hover #f4f4f5
Brand accent     text-accent / bg-accent = #CC5500 (page) · #E55A1A (zones) · hover #B85A14
Inline links     text-accent-text = #B85A14 (page) · #f48a4a (zones)
Eyebrow          text-eyebrow = muted grey (quiet by default)
Buttons          buttonVariants() — Montserrat UPPERCASE, 4px: primary (bg-cta: black on page / orange in zones) · outline (2px, inverts) · onBlock (black on an orange block)
Text             text-prose #18181b · text-prose-muted #52525b · text-prose-faint #71717a
Borders          border-soft #e4e4e7 · border-strong #d4d4d8

Content cards    borderless · image rounded-xl overflow-hidden · copy flush · one hairline footer
Cards hover      group-hover:text-accent on the title + hover:-translate-y-0.5
Utility boxes    border-2 border-chrome rounded-xl (bench, author) · black panel = data-theme="dark" bg-chrome border-t-4 border-accent (Tools)
Forms            bg-surface rounded-xl border border-soft (components/ui/Card)
Overlays         bg-surface rounded-xl border-2 border-prose (components/ui/overlay.ts)
Label block      LabelBlock — bg-chrome text-white 11px black caps (tone="accent" in dark bands) · names the ROLE
Score chip       RatingScore variant="chip" — square bg-accent text-white · status chips bg-accent (testing) / bg-chrome (queued)
Image marks      one at most — Approved badge, or rounded-sm bg-chrome text-white tag
Empty state      bg-surface-raised rounded-xl (no dashed border)

Brand-band H1    font-black uppercase text-[26px] leading-none (Montserrat) — on the orange band, lg+; sr-only twin on a phone
Page H1          font-black text-4xl md:text-5xl leading-[1.0] tracking-tight  (Montserrat)
Content H3       font-extrabold text-base leading-snug tracking-tight          (Montserrat)
Section H2       EditorialHeader: LabelBlock + UPPERCASE font-black 26/34px + 3px chrome rule + outline button · utility/admin: SectionHeader
Serif            Fraunces = the Creed ONLY · Source Serif = pull-quotes ONLY
Eyebrow          text-[11px] text-eyebrow uppercase tracking-[0.2em] font-bold

Section opener   EditorialHeader (editorial) · SectionHeader (utility/admin) · never inline either
Radius           4px everywhere (rounded-sm 2px tags/chips · rounded-full pills only) — one scale in globals.css
Icons            inline SVG (CategoryIcon) — no emoji

Container        max-w-6xl mx-auto px-6   (detail pages max-w-7xl)
Section padding  py-12 md:py-16
Card grid        gap-5
Numbers          tabular-nums
```

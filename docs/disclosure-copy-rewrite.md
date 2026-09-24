# Disclosure & Claims Copy Rewrite — Draft for Approval

> **Status:** APPLIED 2026-09-24 with defaults (house line as written · "dad-picked" · About: only the 100% tile dropped, grid → 3 cols · 8f wizard field deferred). Doctrine now lives in `docs/brand-guide.md` §1.9, which is the authority; this file is the rollout record.
> **Deviations from the draft:** Grilling metaDesc uses "chosen for real backyard cooking" (unconfirmed claim avoided). **Also fixed beyond the draft:** `/picks` title + description + detail heading ("all personally tested"), `/stacks` titles + OG, stack detail fallback title, gift price-tier metas (under $25/$50/$100, splurge), `/category/[slug]` title ("Dad-Tested Reviews & Real-Dad Guides"), `api/claude/seo-meta` prompt (no testing claims in guide metas), editorial-standards sections renumbered (new §2).
> **Left unchanged on purpose:** "Dad-Tested" on review-only surfaces (`/reviews`, review category/tag pages, WelcomeEmail "Browse Dad-Tested Reviews", WishlistStatusEmail). **7d resolved 2026-09-24:** grilling claim confirmed true (kept); outdoors "trip with my kid" + automotive "trucks and SUVs" confirmed untrue (rewritten); health softened to "reviews only cover what I've used; always trying new things". Also fixed: outdoors FAQ said "disclose when something was provided for review", which contradicted the no-free-products policy. Badge threshold unified at 8.0+ (editorial-standards had 9.0). Vehicles POV/FAQ claims (own-vehicle maintenance, "actual ownership and daily driving", "I detail my own vehicles") confirmed true — kept. Founder's saved voice profile reviewed 2026-09-24: no "every product" fact; "nutritionist" credential wording replaced with GNC/Vitamin Shoppe retail experience; testing-philosophy fact added. **Rollout complete.**
> **Goal:** Let reviews, guides, articles, and gift lists link or mention products the founder hasn't bought, tested, or reviewed, using the industry-standard approach, without any statement on the site becoming false.

## The standard we're adopting

This is how major affiliate publishers (Wirecutter, CNN Underscored, Gear Patrol, Dotdash/The Spruce, Good Housekeeping) handle it:

1. **One disclosure per page**, near the top, before the first link. Boss Daddy already does this automatically (`lib/affiliate.ts` `FTC_DISCLOSURE_HTML`). No per-product or per-mention labels.
2. **Scoped claims.** *Testing* claims ("bought it, used it, scored it") belong to **reviews**. *Selection* claims ("independently chosen", "hand-picked") cover **everything**.
3. **Honest prose.** The page disclosure covers the money relationship. The words themselves must be true, and never claim experience that didn't happen.
4. **Scores and Boss Daddy Approved stay on reviews only.** That's already how the site works.

### The four mention types (the house rule)

| Type | Example | Allowed where | The rule |
|---|---|---|---|
| **1. Firsthand** | "I ran this for three weekends" | Reviews, or any piece where it actually happened | Must have actually happened |
| **2. Secondhand** | "My brother-in-law swears by the ___" / "A buddy who does this for a living runs the ___" | Anywhere | A real person really said it. If that person has a stake (works for the brand, sells it), disclose it. |
| **3. Reputation** | "Many dads go with the ___" / "The ___ is one of the hottest picks for xyz right now" / "consistently one of the top-rated" | Anywhere | True when written (bestseller lists, ratings, what you're seeing). No exact figures that go stale ("4.8 stars, 20k reviews") unless dated. |
| **4. Selection** | "If I were buying today, this is the one I'd look at" | Anywhere | Your honest opinion |

**Never:** let secondhand drift into firsthand ("my buddy loves it" → "I love it"); invent an anecdote; invent a popularity claim; put a score or badge on anything that isn't type 1.

**New house line (proposed):** *"Every review is earned. Every pick is independently chosen."*

Risk key: **H** = becomes false (or already is) on pages where non-reviewed products will appear · **M** = site-wide or meta claim, same problem at lower visibility · **L** = true today, tighten for consistency · **?** = factual claim about you, please confirm.

---

## 1. Doctrine (authoritative source — change first)

### 1a. `docs/brand-guide.md:117` — **H**
- **Current:** "Self-purchased + field-tested is not a slogan — it's a fact-check rule. Don't review what you didn't buy and use."
- **Proposed:** "Self-purchased + field-tested is not a slogan — it's a fact-check rule **for reviews**. Don't review, score, or badge what you didn't buy and use. Any piece may *mention or link* products we haven't reviewed, using the four mention types (firsthand / secondhand / reputation / selection). Every mention must be true, and none may imply firsthand experience that didn't happen."
- Add the **four mention types** table above as a new §1.9 "Product Mentions & Claims".

### 1b. `docs/brand-guide.md` §1.8 "What we never do" — add bullets
- "Imply firsthand testing of a product we haven't used — in copy, meta descriptions, or AI drafts."
- "Invent an endorsement — a made-up friend's recommendation or an unsourced 'best-seller' claim."

---

## 2. Disclosure & standards pages (legal-facing)

### 2a. `app/(public)/affiliate-disclosure/page.tsx:12` (meta description) — **H**
- **Current:** "…and why commissions never influence our recommendations. We buy everything ourselves first."
- **Proposed:** "…and why commissions never influence our recommendations. Every product we review, we bought and used ourselves."

### 2b. `app/(public)/affiliate-disclosure/page.tsx:60-61` — **L**
- **Current:** "Affiliate links appear in reviews and guides. Where they appear, you'll see a disclosure at the top of that page."
- **Proposed:** "Affiliate links appear in reviews, guides, and gift lists — including links to products we mention or recommend but haven't formally reviewed. Wherever they appear, you'll see a disclosure at the top of that page."

### 2c. `app/(public)/affiliate-disclosure/page.tsx:72` — **H**
- **Current:** "The review came first. The affiliate link came second. Not the other way around."
- **Proposed:** "The recommendation comes first. The affiliate link comes second. Not the other way around."

### 2d. `app/(public)/affiliate-disclosure/page.tsx` — new section after "Our Review Standard" (after line 99) — **H**
- **Heading:** "Mentions, Guides & Gift Lists"
- **Body:** "Not every product we link has a full Boss Daddy review behind it. Guides, articles, and gift lists sometimes mention products we've researched, ones recommended by people we trust, or ones that are popular for the job at hand. Those mentions don't carry a score or the Boss Daddy Approved badge, and we won't claim hands-on experience we don't have. If we say we used it, we did. If a friend swears by it, a friend really does. If it's scored, we tested it. Either way, nobody paid to be there."

### 2e. "We have a team" claims — **H (confirmed untrue 2026-09-24: the founder is the sole owner/admin/editor)**
The same false claim appears in four places. Fix: say "founder-led" and write contributor rules in the future tense ("anyone who joins"), so they stay ready without claiming staff that doesn't exist.

- **`app/(public)/affiliate-disclosure/page.tsx:127-131`** "Human Contributors"
  - **Current:** "Boss Daddy Life works with human editors, writers, and content managers in addition to the founder. Everyone is held to the same rules: …"
  - **Proposed heading:** "Contributors" · **Body:** "Boss Daddy Life is written and edited by its founder. If editors, writers, or contributors join, they'll be held to the same rules: firsthand knowledge, honest opinions, no paid placements. Anyone with a material connection to a product, brand, or company they write about will be required to disclose it — to us, and to you, on the page where it matters."
- **`app/(public)/affiliate-disclosure/page.tsx:93-94`**
  - "The founder does not accept free products in exchange for reviews. Neither do our contributors." → **"The founder does not accept free products in exchange for reviews, and neither will any future contributor."**
- **`app/(public)/editorial-standards/page.tsx:85-90`** "Contributor Standards"
  - **Current:** "Boss Daddy Life is founder-led, but it's not a one-man operation. We work with human editors, writers, and content managers. Every contributor is held to the same standards as the founder:"
  - **Proposed:** "Boss Daddy Life is founder-led — every piece is written, edited, and approved by the founder today. Any editor, writer, or contributor who joins will be held to the same standards:" (list at lines 92-95 unchanged).
- **`app/(public)/how-we-test/page.tsx:128-131`**
  - **Current:** "Our human editors and contributors are held to the same bar. If they're writing an editorial review, … Not for the founder, not for anybody on the team."
  - **Proposed:** "Anyone who writes for Boss Daddy in the future will be held to the same bar. If they're writing an editorial review, they've used the product or have direct firsthand knowledge of it. That's not a nice-to-have. It's the rule. **No gifted-product editorial reviews. Not for the founder, not for anybody.**"
- **"Boss Daddy team" approval lines** — **M**
  - `affiliate-disclosure/page.tsx:117` "…reviewed and approved by a human on the Boss Daddy team…" → **"…reviewed and approved by the founder before it's published."**
  - `editorial-standards/page.tsx:75` "…reviewed and approved by a human on the Boss Daddy team…" → **"…reviewed and approved by the founder before it goes live."**
  - `about/page.tsx:142-143` "…still gets personally approved by the Boss Daddy team." → **"…still gets personally approved by me."**
  - (Editorial "we" elsewhere is standard publisher voice and fine. It's "team", "editors", "contributors" as present-tense facts that are false.)

### 2f. `app/(public)/editorial-standards/page.tsx` — new section (near lines 93 / 136) — **M**
- Lines 47-48, 93, and 136 are scoped to *editorial reviews*. They're true, so keep them.
- **Add:** "Mentions Outside of Reviews" with the same body as 2d, plus the four-type list in plain English:
  - "**Firsthand** — we used it. Reviews only, or wherever it actually happened."
  - "**Secondhand** — someone we know uses it, and we say so."
  - "**Reputation** — it's widely rated or popular for the job, and we say that, not more."
  - "**Our pick** — our honest opinion of what's worth a look."

### 2g. `lib/affiliate.ts:21-24` — inline page disclosure — **L (optional)**
- **Current:** "This article contains affiliate links. As an Amazon Associate I earn from qualifying purchases. We may earn a small commission at no extra cost to you. Learn more"
- **Proposed:** "This page contains affiliate links — if you buy through them, Boss Daddy may earn a small commission at no extra cost to you. As an Amazon Associate I earn from qualifying purchases. Learn more"
- **Note:** The current wording works. The only fixes are "article" → "page" and a cleaner order. If the disclosure is baked into stored HTML at publish time, the change only affects new content; older pieces keep the old (still valid) wording.

---

## 3. Gift guides — highest exposure (mentions will land here first)

### 3a. `lib/gift-occasions.ts` — Father's Day (lines 42-45) — **H**
- shortBlurb: "Real-tested gifts for the dad who actually shows up." → **"Hand-picked gifts for the dad who actually shows up."**
- longBlurb: "…Here's the list — every item personally bought, used, and earned its place…" → **"…Here's the list — every pick chosen by a dad, not a marketing department. The ones I've tested carry a score. No corporate fluff, just stuff he'll actually pick up again after opening day."**
- metaTitle: "Dad-Tested Picks" → **"Dad-Picked Gifts"**
- metaDesc: "…Every pick personally tested by a real dad…" → **"…Every pick chosen by a real dad…"**

### 3b. Christmas (57, 59) — **H**
- longBlurb: "…every item personally tested across multiple seasons…" → **"…picks chosen to earn permanent garage space, not closet exile. Tools, gear, grilling, and lifestyle picks."**
- metaDesc: "Every pick personally tested by a real dad." → **"Every pick chosen by a real dad."**

### 3c. Valentine's (64, 66) — **H**
- "…and honestly tested." → **"…and honestly chosen."**
- "Dad-tested picks…" → **"Dad-picked gifts…"**

### 3d. Mother's Day (50) — **H**
- "…dad-tested-on-mom-approved." → **"…picked by a dad, approved by mom."**

### 3e. "Dad-tested" in metaDescs — New Year (73), Thanksgiving (85, 87), 4th of July (92, 94), Halloween (101), Memorial Day (108) — **M**
- Swap **"dad-tested" → "dad-picked"** everywhere. 4th of July's "Tested across multiple summers of backyard cookouts." → **"Built for backyard cookouts."**

### 3f. Birthday (117) — **H**
- "Every pick personally tested." → **"Every pick hand-chosen."**

### 3g. Wedding (130-131) — **H (already untrue)**
- metaTitle: "Tested by Real Couples" → **"Picks That Last"**
- metaDesc: "…dad-tested for actual home life." → **"…chosen for actual home life."**

### 3h. Baby Shower (143-144) — **H**
- longBlurb: "…every pick here got pulled out of the box and used in actual life." → **"…every pick here is something a new parent will actually reach for."**
- metaTitle: "Real Dad-Tested" → **"From a Real First-Time Dad"**

### 3i. Grilling / Camping / Workshop (173-189) — **H**
- **Grilling:**
  - longBlurb "…tested across multiple summers… every item earned its spot…" → **"From entry-level upgrades to splurge gear — picks that earn their spot at the grill."**
  - metaTitle "Dad-Tested Picks" → **"Dad-Picked Gear"**
  - metaDesc "dad-tested across multiple seasons" → **"chosen by a dad who grills every weekend"** *(?, confirm)*
- **Camping:**
  - shortBlurb "field-tested by a real dad" → **"picked by a real dad"**
  - longBlurb "…from real family camping trips… that survived kids, weather…" → **"Tents, gear, and essentials chosen to survive kids, weather, and weekend chaos."**
  - metaTitle "Family-Tested" → **"Family-Ready"**
  - metaDesc "dad-tested with real family trips" → **"chosen for real family trips"**
- **Workshop:**
  - metaDesc "dad-tested in real projects" → **"from a dad who builds and fixes for real"**

### 3j. `app/(public)/gifts/page.tsx:15-16` — **H**
- title: "Dad-Tested Picks" → **"Dad-Picked Gifts"**
- description: "…Every pick personally tested by a real dad." → **"…Every pick chosen by a real dad — no paid placements."**

### 3k. `app/(public)/gifts/[occasion]/page.tsx:371` — **H**
- "{n} dad-tested gifts, all personally bought…" → **"{n} dad-picked gifts…"** (drop "all personally bought"; full sentence shown at implementation).

### 3l. `app/(public)/gifts/[occasion]/page.tsx:529` (empty-state) — **H**
- "…every pick personally tested, no corporate gift-list filler." → **"…every pick hand-chosen, no corporate gift-list filler."**

---

## 4. Site-wide chrome (every page)

### 4a. `components/Footer.tsx:124` — **H**
- **Current:** "Real-world reviews. No PR samples. No paid placements. Just an honest verdict from a dad who bought the thing and used it."
- **Proposed:** "Real-world reviews and independently chosen picks. No PR samples. No paid placements. If I scored it, I bought it and used it."

### 4b. `components/AuthorBio.tsx:13` — **H** (shows on every review and guide)
- **Current:** "I'm a first-time dad in the trenches — testing every piece of gear on my own kid, my own grill, and my own weekend projects. If I wouldn't buy it again, I'll tell you. If it changed the game, I'll tell you that too. Every review is earned, never sponsored."
- **Proposed:** "I'm a first-time dad in the trenches — testing gear on my own kid, my own grill, and my own weekend projects. If I wouldn't buy it again, I'll tell you. If it changed the game, I'll tell you that too. Every review is earned. Every pick is independently chosen. Nothing here is sponsored."

### 4c. `app/layout.tsx:78` (default meta description) — **L**
- "…Honest reviews, smart tools, and real-dad wisdom… — zero paid placements, zero fluff." Already true. **Keep.**

---

## 5. Homepage

### 5a. `components/home/HomeHero.tsx:93` — **H**
- **Current:** "Every pick is bought, broken, and earned."
- **Proposed:** **"Every review is earned. Every pick is independently chosen."** (Or keep the edge: "Every score is bought, broken, and earned.")

### 5b. `components/home/HomeHero.tsx:15` (subhead) — **L**
- "…If it can't survive my house, it doesn't get a score." Already scoped to scores. **Keep.**

### 5c. `app/(public)/page.tsx:67` (home meta) — **L**
- "Field-tested reviews, real-dad guides…" Scoped to reviews. **Keep.**

### 5d. `app/(public)/page.tsx:378` — **L**
- "Field-tested, bought with my own money." Confirm this sits on a *reviews* element and keep it if so. Otherwise change to "Reviews: field-tested, bought with my own money."

---

## 6. About page

### 6a. `app/(public)/about/page.tsx:38` — **H**
- **Current stat:** "100% / Firsthand tested"
- **Proposed:** remove this tile (it's also a vanity metric). If the grid needs 4 tiles, use "$0 / Sponsors".
- **Side note:** the "Products reviewed" / "Guides written" count tiles (36-37) also break the no-vanity-metrics rule. Consider dropping the whole row. That's a separate decision.

### 6b. `about/page.tsx:126-129` — **L**
- "Every single product I review I've bought with my own money…" Scoped to reviews. **Keep**, and add after it: **"When a guide mentions something I haven't reviewed, I'll tell you where the recommendation comes from — a buddy who swears by it, a product that's popular for the job, or my own research. Nobody pays for the spot."**

### 6c. `about/page.tsx:134` — **L**
- "…buying the stuff, testing it in our own backyards…" This describes what you do, not a promise about every item. **Keep.**

---

## 7. Section/category copy

### 7a. `lib/categories.ts:20` (category FAQ answer) — **H**
- **Current:** "Some links pay me a small commission at no cost to you. I only link to things I personally bought and used. The FTC disclosure on each review explains the specifics."
- **Proposed:** "Some links pay me a small commission at no cost to you. Reviews only cover things I personally bought and used; guides may also mention picks I've researched, that people I trust swear by, or that are popular for the job. Nobody pays for placement. The disclosure at the top of each page explains the specifics."

### 7b. `lib/categories.ts:6` — **M**
- "…everything tested by real kids with zero mercy." → **"…reviewed on a real kid with zero mercy."**

### 7c. `lib/categories.ts:12` — **L**
- "…If it can't survive a toddler…, I'm not recommending it." → change "recommending" to **"scoring"**.

### 7d. `lib/categories.ts:88, 118, 189, 232` — **?**
- Factual claims about you ("I've tested all three [grill] types", "most reviews involve at least one trip with my kid", vehicles "tested on", "I review what I personally use"). Confirm each is true.

### 7e. `lib/labels.ts:117` (Guides hub tagline) — **M**
- "…gift guides — built from tested gear." → **"…gift guides — built around tested gear and hand-picked finds."**

### 7f. `app/(public)/guides/page.tsx:19, 73` — **M**
- meta: "…practical advice from a dad who actually tested it." → **"…practical advice from a dad who's actually done it."**
- deck: "…tested by a dad, written without the fluff." → **"…from a dad who's done it, written without the fluff."**

### 7g. `app/(public)/guides/[slug]/page.tsx:353` — **L**
- "Plus dad-tested stuff before they go up." True (it's the review pipeline). **Keep.**

### 7h. Boss concierge copy (`lib/labels.ts:348,350`, `components/home/BossToolsSection.tsx:30-33`, `app/(public)/tools/the-boss/page.tsx:36`) — **L**
- True: the concierge leads with tested reviews and labels research picks separately. **Keep.**

---

## 8. AI drafting — the actual FTC exposure

The drafter currently assumes every product in a piece was tested. Told to write a guide with linked products, it will invent firsthand experience. Given the new mention types, it would also happily invent a "buddy who swears by it" or a "best-seller" claim. Both are fabricated endorsements.

### 8a. `lib/claude/client.ts:33` `BOSS_DADDY_SYSTEM` — **H**
- **Current:** `- First-person always: "I ran this for three weekends...", "My 6-year-old immediately grabbed it..."`
- **Proposed:** `- First-person always. When the author's notes or voice profile supply real testing details, lead with them ("I ran this for three weekends...", "My daughter immediately grabbed it..."). NEVER invent firsthand experience — no usage claims, durations, test results, or family reactions that aren't in the notes.`
- (Also fixes "6-year-old", which doesn't match the founder's real family and invites made-up details.)

### 8b. `lib/claude/client.ts:72` — **H**
- **Current:** `- Every claim needs specifics: "lasted 4 hours of continuous use" not "long battery life"`
- **Proposed:** `- Every claim needs specifics: "rated for 4 hours of continuous use" not "long battery life". Specifics come from the author's notes, manufacturer specs, or research. Never make up a measured result.`

### 8c. `lib/claude/client.ts` — new block after PRODUCT LINKS (after line 90) — **H**
```
PRODUCT MENTIONS — four honest ways to talk about a product; use only what's true:
1. FIRSTHAND ("I used it") — ONLY when the author's notes describe using that product.
2. SECONDHAND ("my brother-in-law swears by it") — ONLY when the author's notes supply that person and recommendation. Never invent a friend, family member, or anecdote.
3. REPUTATION ("many dads go with", "one of the most popular picks for X right now", "consistently well-rated") — general phrasing is fine. Specific claims ("#1 best-seller", "4.8 stars", "20,000 reviews") ONLY when the notes or research supply them.
4. SELECTION ("if I were buying today, this is the one I'd look at", "worth a look if you need X") — your honest pick, fine anywhere.
- Unless the notes say otherwise, treat every linked product in a GUIDE as type 3 or 4, never type 1.
- Never let a type-2 or type-3 mention drift into a firsthand claim later in the piece.
- Don't add per-product disclaimers — the page-level disclosure covers affiliate links.
```
- **Also line 85:** "(a real test result, expert validation, or concrete data point)" → "(a real test result **from the author's notes**, expert validation, or concrete data point)".

### 8d. `lib/claude/client.ts:99-104` `MODERATOR_SYSTEM` — **H**
- **Add checks:**
```
- Firsthand-experience claims ("I used", "I tested", "after three weekends", a family member's reaction) about a product with no supporting detail in the submission — flag for the author to confirm. Implied testing that didn't happen is a deceptive endorsement (FTC 16 CFR 255).
- Secondhand endorsements ("a buddy swears by it") — flag for the author to confirm the person and recommendation are real.
- Specific popularity or rating claims ("#1 best-seller", star ratings, review counts) — flag for the author to confirm the source and date.
- Do NOT flag general reputation phrasing ("popular", "many dads prefer", "well-rated") or honest selection language ("the one I'd look at").
```

### 8e. `app/(dashboard)/dashboard/profile/voice/_components/VoiceProfileForm.tsx:221` (placeholder) — **M**
- **Current:** "Fact — e.g. I test every product for at least two weekends before writing the review."
- **Proposed:** "Fact — e.g. Every product I review gets at least two weekends of real use first."
- **Your action:** check whether your *saved* voice-profile facts (boss@ account) contain an "every product" line. It goes into every AI call. Scope it to reviews the same way.

### 8f. Draft-input field (follow-up, optional) — **L**
- Types 1 and 2 depend on the author's notes, so the guide wizard would benefit from an optional per-product note: "How do you know this one? (used it / friend recommends / popular / my pick)". The drafter then writes the right mention type for each product. This is a small UI addition, not needed for launch; the prompt rules above are safe without it (they default to types 3/4).

---

## Summary

| Bucket | Items | Where |
|---|---|---|
| Doctrine | 2 | brand-guide §1 (+ new §1.9) |
| Legal pages | 7 | affiliate-disclosure, editorial-standards, `lib/affiliate.ts` |
| Gift guides | 12 | `gift-occasions.ts`, gifts pages |
| Chrome / home / about | 9 | footer, author bio, hero, about |
| Category / section | 8 | categories, labels, guides |
| AI prompts | 6 | system + moderator prompts, voice form, optional wizard field |

**Open questions:**
1. House line: "Every review is earned. Every pick is independently chosen." Yes, or your own wording?
2. Replacement for "dad-tested" in gift copy: "dad-picked", "hand-picked", or other? (Avoid "dad-approved", which collides with the Boss Daddy Approved badge.)
3. ~~Item 2e: do you currently work with other editors/writers?~~ **Answered 2026-09-24: no — founder is sole owner/admin/editor.** 2e rewritten accordingly.
4. Items marked **?** (3i grilling, 7d): confirm they're true.
5. About stats row: drop the whole row, or only the "100%" tile?
6. Item 8f (per-product "how do you know it" note in the wizard): build now, later, or skip?

*General information, not legal advice. The four-type rule tracks the FTC Endorsement Guides (16 CFR 255, 2023 revision) and the Amazon Associates operating agreement.*

# Boss Daddy — Project Brief

> **Purpose of this file.** A single, self-contained briefing you can upload to a Claude Project (works on the phone app) so any conversation about Boss Daddy starts fully grounded — strategy, brand voice, and technical context in one place. No codebase access required.
>
> **How to use it.** In the Claude app → create a Project called "Boss Daddy" → add this file to the Project knowledge → set the custom instructions (see the block at the very bottom). Then chat from anywhere.
>
> **Keep it current.** This is a snapshot. When direction changes, update this file (it lives at `docs/boss-daddy-claude-project.md` in the repo) and re-upload. Treat the repo's `docs/brand-guide.md` and `CLAUDE.md` as the deeper source of truth for design and engineering.

---

## 1. What Boss Daddy Is

Boss Daddy is a brand and website for fathers — a trusted hub of honest product reviews, practical guides, tools, and community for men committed to being great dads ("Boss Dads"). It's built and run by a real first-time dad, not a faceless review farm.

**Mission:** Establish Boss Daddy as the gold-standard, trusted hub for men of all ages who are committed to being the ultimate dads — strong, present, proud fathers. Rooted in duty to God, Family, and Faith, standing for honesty, loyalty, and brotherhood. Leverage smart tools to deliver the most comprehensive reviews, practical guides, authentic community, and real support.

**Essence (one-liner):** *Boss Daddy — the gold standard and trusted hub for men who Dad like a BOSS.*

**Founder context (the "why"):** A first-time dad who once thought he'd never have kids. After separating from an ex-wife he found a new partner who changed his life; now has a baby girl and is soon to be married. Practices faith daily and works on self-improvement to be the best husband and father he can be. Boss Daddy is the vehicle for sharing that journey and helping other dads who show up every day.

**Core values:**
1. **Faith-First Leadership** — duty to God, family, and faith as the foundation.
2. **Honesty** — transparent reviews, real talk, no fluff, no sponsored BS.
3. **Loyalty & Brotherhood** — a tight community of men who support and challenge each other.
4. **Present & Proud** — strong, fully present, proud fathers every day.
5. **Pursuit of Excellence** — highest standards in everything.

**Audience:**
- **Primary:** fathers 25–55 — new dads through seasoned ones — who want to level up as leaders.
- **Secondary:** aspiring fathers, young men seeking mentorship, grandfathers passing down wisdom.
- **Psychographics:** value faith, family, competence, wisdom, traditional masculine virtues; want practical tools, smart tech, community, accountability; frustrated with "soft" masculinity and mediocrity but want *balanced* strength — the protector who provides and nurtures.

---

## 2. Brand Voice (the heart of the product)

**Archetype: The Wise Warrior / Protector King** — the older, wiser brother who's seen it all, leads by example, tells it straight, and still has your back. Authoritative yet approachable. Confident, disciplined, no-nonsense. Tough-loving humor with a playfully cynical edge aimed at *mediocrity* — never at struggling dads.

**Taglines:**
- **"Dad like a BOSS"** — primary. Hero, marketing, merch.
- **"Real dads, Real reviews, Smart tech"** — secondary (review/tech pillar).
- **"Boss Stuff for Boss Dads"** — merch/shop voice.

**Voice mechanics (how copy should read):**
- First-person, always: *"I used this for 3 weekends," "I built a fence with it."*
- Active voice. No hedging (may/might/could). No vague time refs ("recently," "lately").
- Sentences 15–25 words; paragraphs 3–5 sentences. Lead with the useful info.
- Address the reader as a peer: *"Fellow bosses," "Brother,"* direct *"you."* `BOSS` as a noun of address, sparingly.
- Direct openers welcome: *"Here's the deal:", "Bottom line:", "Real talk:".*
- Every claim has specifics — durations, conditions, outcomes. Reviews require a real-testing reference. Only review what was actually bought and used.

**Banlist — never use:**
- Hype: "game-changer," "revolutionary," "must-have," "life-changing," "next-level."
- Corporate jargon: "leverage" (verb), "synergy," "circle back," "stakeholder," "deep-dive," "ecosystem."
- Sponsored phrasing: "in partnership with," "thanks to our friends at," "brought to you by."
- Soft-parenting tells: "every child is unique," "no judgment," "you do you."

**Humor:** one dad joke per piece, max — earned. The cynical edge targets soft culture, weak excuses, participation-trophy parenting. Never individual dads who are struggling.

**Faith:** referenced naturally when it fits ("we lead our households," "what we owe our wives and kids"). Never preach, never drop scripture without context, never moralize about other men's choices. Faith content stays warm and grounded — not cynical.

**Where the edge is OFF → switch to warm Protector mode:**
- First-time dads who are genuinely struggling or overwhelmed.
- Loss, mental health, marriage strain, fatherhood grief.
- Faith content where someone is wrestling, not coasting.
- Safety-critical guidance — car seats, infant sleep, water safety, firearms in the home.
- Any reader who came in vulnerable. Meet them where they are.
> The edge exists to call up men who are *coasting*. It is never aimed at men in the trenches.

**Trust & legal (non-negotiable):**
- Zero sponsors. Affiliate is fine, disclosed, and earned. Sponsored-as-honest-review is forbidden.
- FTC affiliate disclosure is auto-injected on reviews with affiliate links and must never be bypassed (it's a legal compliance gate).

**Brand vocabulary — "Stuff":** the casual word for things a dad wants/needs/uses. *"The good stuff"* (recommendations), *"Boss stuff"* (merch/curated picks), *"Dad stuff"* (categories). Use formal terms (products, items, merch) in legal/admin contexts.

**Wordmark:** ALL-CAPS `BOSS DADDY` when *announcing* (logo, hero, taglines, merch, OG cards). Title-case `Boss Daddy` when *referencing* in editorial body. Never lowercase, never camel-case except in code.

---

## 3. The Product (what's on the site)

Primary domain: **bossdaddylife.com**. Content types and key surfaces:

- **Reviews** — honest, field-tested product reviews with a 4-axis rating (plus an AI "Specs Grade" axis). Affiliate links disclosed.
- **Guides** — all long-form editorial: how-tos, skills, advice, essays. (Never call it a "blog.")
- **Gear** (`/gear`) — unified page: "Boss Daddy Approved Gear" (curated top-rated picks, rating ≥ 8.0) **+** "Made by Boss Daddy" (branded merch). `/shop` redirects here.
- **The Bench** (internal `wishlist`) — the public pipeline of products being considered/tested; members vote on what gets tested next.
- **Collections** — curated multi-product lists ("best of" style) with spec-comparison tables.
- **The Boss** (`/tools/the-boss`) — a member AI concierge: a tool-using assistant that searches the site's gear/guides and helps with dad-life questions; can do member-gated web research for products not yet tested ("Researched, not tested").
- **Dad Tools** — free utilities (e.g. a savings tracker, "weekends-until" countdown) to drive habit and signups.
- **Merch Shop** — print-on-demand via Printful, payments via Stripe. End-to-end fulfillment is working.
- **Community/account** — member accounts, comments, likes, direct messages, notifications (in-app + email digest + web push).

**Content standards:** only reviews products personally bought/used or with direct firsthand knowledge. Promotional content (contests, giveaways, wishlist items) must be labeled. AI (Claude) assists drafting; human editors/creators review. Affiliate marketing is active.

---

## 4. Design System (so on-phone ideas stay on-brand)

**Dark-first, everywhere.** Near-black canvas, elevated charcoal surfaces, off-white text, a single warm-orange accent. No gold, no per-category rainbow, no cream/peach/brown.

- **Accent — Hot orange `#E55A1A`** on dark (primary CTAs, active nav). Hover = core `#CC5500`. Inline links/eyebrows = `#f48a4a`. **Never** use the default vivid Tailwind orange `#f97316`.
- **Surfaces:** chrome/canvas `#09090b`, surface `#18181b`, raised `#27272a`, hover `#3f3f46`. Elevation comes from **borders + raised surfaces, not shadows** (black shadows vanish on near-black).
- **Text:** body `#f4f4f5`, muted `#d4d4d8`, faint `#71717a`.
- **Type:** Montserrat for display/headings (`font-black` for heroes), Geist Sans for body/UI, a serif reserved for blockquotes/pull-quotes only.
- **Shape:** `rounded-2xl` (16px) on cards/panels/buttons; pills are `rounded-full`.
- **Section headers:** a 3px vertical orange rule + uppercase tracked eyebrow (em-dash prefix, e.g. `— THE GEAR`). Section headings are `font-black`.
- **Mobile-first** is the rule, not an afterthought — min 44px tap targets, test mobile before desktop.

Full reference lives in `docs/brand-guide.md` (deeper than this summary, and authoritative when they disagree).

---

## 5. Technical Context (for engineering decisions)

**Stack:**
- **Framework:** Next.js 16 (App Router), TypeScript strict.
- **Auth + DB:** Supabase (`@supabase/ssr`) with Row-Level Security (RLS) enforced at the DB level.
- **AI:** Anthropic Claude API (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`; prompt caching on system prompts.
- **Email:** Resend (templates in `emails/`).
- **Rate limiting:** Upstash Redis.
- **Payments:** Stripe. **Merch fulfillment:** Printful (POD).
- **Styling:** Tailwind CSS v4 (no config file — tokens in `app/globals.css` via `@theme inline`).
- **Deploy:** Vercel, auto-deploys from `master`. DNS in Cloudflare.

**Hard rules / gotchas (these have caused outages — respect them):**
- **Middleware file is `proxy.ts`** at the project root (Next.js 16 convention) — *never* rename it to `middleware.ts`. The exported function is `proxy`.
- **RLS doctrine:** public-content tables must be readable `to anon, authenticated`, or logged-out visitors silently break while admins see everything. Use the `is_admin()` helper for write gates.
- **Naming doctrine:** internal names (DB tables, routes, enums) stay stable forever; display labels change via `lib/labels.ts`. Don't rename tables to fix a wording change.
- **Migrations** go in `supabase/migrations/` with sequential filenames, started from `_TEMPLATE.sql`; applied via `supabase db push`.
- **Security:** never put `ANTHROPIC_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in client code or `NEXT_PUBLIC_*`. Use `getUser()` (not `getSession()`) for auth checks. Always sanitize user HTML before DB writes. Never bypass the affiliate-disclosure gate.
- **Claude routes** expect raw JSON responses — strip markdown fences before parsing. Draft generation is rate-limited (10/user/hr).

**Review status state machine:** `draft → pending → approved`, with `rejected → draft` for author edits. Only admins approve/reject; `approved` reviews are immutable.

---

## 6. Where Things Stand (roadmap snapshot — update as it moves)

**Shipped / working:**
- Dark-first brand redesign, homepage, navigation + PWA install.
- Reviews + Guides editorial pipeline with AI drafting, content blocks, tags, categories.
- Collections with spec-comparison tables; AI Specs Grade (5th rating axis).
- The Bench (product pipeline) → Vault loop; member voting.
- Member AI concierge "The Boss" v1, including member-gated web research fallback for untested gear.
- Dad Tools (savings tracker shipped).
- Notifications + direct messaging (in-app, email digest, web push).
- **Merch shop end-to-end:** Stripe checkout → Printful fulfillment validated on a real order.

**Open / in flight (representative — confirm current state before acting):**
- Merch: refund the remaining test charges; verify the shipped-order tracking/email path; add Sentry on swallowed webhook errors.
- Gear "provenance spine" rebuild: an `adopt` admin UI for researched candidates; reconcile admin/wishlist vs admin/products overlap.
- The Boss: commit + E2E, Tier-3 action tools, Stripe `plus` tier; "we tested it" follow-up emails.
- Voice-learning system Phase 2 (pgvector exemplar few-shot).
- Sentry DSN env var still needs to be set in Vercel to capture prod errors.
- A pending naming decision for the "Tools" / "Vault" area (collides with collections `/vault`).

> Detailed, living status is tracked in the repo's memory index and `docs/` plan files — this section is the high-level read for strategy conversations.

---

## 7. Good Conversations to Have From Your Phone

- **Strategy/brainstorm:** monetization (affiliate → merch → membership tiers), content calendar and pillars, community features, growth/SEO ideas, partnership/sponsorship boundaries (remember: zero sponsors-as-reviews).
- **Brand/content:** draft headlines, taglines, newsletter hooks, review angles, social copy — all in the voice above. Sanity-check whether copy is on-voice or drifting into hype/corporate/soft-parenting tells.
- **Technical decisions:** reason about architecture trade-offs, feature scoping, sequencing, and whether an idea respects the hard rules in §5 — then bring the decision back to the keyboard to implement.

---

## Suggested Claude Project custom instructions (paste into the Project)

> You are my strategist and brand partner for **Boss Daddy**, a website and brand for fathers ("Boss Dads"). Use the attached project brief as your source of truth for mission, brand voice, design system, and technical context.
>
> When I ask for copy, write in the Boss Daddy voice: first-person, direct, specific, tough-loving older-brother tone with a light playfully-cynical edge aimed at mediocrity — never at struggling dads. Switch to warm Protector mode for vulnerable/safety/faith/loss topics. Obey the banlist (no hype words, no corporate jargon, no sponsored phrasing, no soft-parenting tells). Faith is the foundation, never a lecture.
>
> When I brainstorm strategy, give me a clear recommendation, not an exhaustive survey. When I ask technical questions, respect the hard rules in the brief (proxy.ts, RLS doctrine, naming doctrine, security gates) and flag if an idea would violate them. I'm usually on my phone — keep answers tight and skimmable unless I ask to go deep.

# Boss Daddy — Project Brief

> **Version 3.5 — Updated 2026-07-24.** This is the single source of truth for mission, messaging, brand voice, design system, and technical context. It supersedes all prior briefs and brand summaries.
>
> **Purpose of this file.** A single, self-contained briefing you can upload to a Claude Project (works on the phone app) so any conversation about Boss Daddy starts fully grounded — strategy, brand voice, and technical context in one place. No codebase access required.
>
> **How to use it.** In the Claude app → create a Project called "Boss Daddy" → add this file to the Project knowledge → set the custom instructions (see the block at the very bottom). Then chat from anywhere.
>
> **Keep it current.** This is a snapshot. When direction changes, update this file (it lives at `docs/boss-daddy-claude-project.md` in the repo) and re-upload. Treat the repo's `docs/brand-guide.md` and `CLAUDE.md` as the deeper source of truth for design and engineering.

---

## 1. What Boss Daddy Is

Boss Daddy is a brand and trusted hub for fathers and dad life — honest product reviews, practical guides, tools, and community for men committed to being great dads ("Boss Dads"). Built and run by a real first-time dad, not a faceless review farm.

**Mission:** Establish Boss Daddy as the gold-standard, trusted hub for men of all ages committed to being the ultimate dads — strong, present, and proud fathers. Rooted in an uncompromising duty to God, Family, and Country, we stand for honesty, loyalty, and brotherhood. By leveraging advanced tools and real-world testing, we deliver the most comprehensive product reviews, practical guides, authentic community, and real support.

**Essence (one-liner):** *Boss Daddy — the gold standard and trusted hub for men who Dad Like a Boss.*

**Founder context (the "why"):** A first-time dad who once thought he'd never have kids. After separating from an ex-wife, he found faith, did serious work on himself, and met the woman who became the mother of his first child. Now a father to a baby girl and soon to be married, he's committed to showing up every day as the strongest version of himself. Boss Daddy was born from that transformation — not in a boardroom, but in real life, real struggle, and real redemption.

**Core values:**
1. **Faith-First Leadership** — uncompromising duty to God, family, and faith as the foundation for leadership and purpose.
2. **Honesty** — transparent reviews, real talk, no fluff, no sponsored BS.
3. **Loyalty & Brotherhood** — a tight community of men who support and challenge each other like brothers.
4. **Present & Proud** — strong, fully present, and proud fathers every day.
5. **Pursuit of Excellence** — always pursuing the highest standards in everything we do.

**Audience:**
- **Primary:** fathers 25–55 — new dads through seasoned ones — who want to level up as leaders at home.
- **Secondary:** aspiring fathers, young men seeking mentorship, and grandfathers passing down wisdom.
- **Psychographics:** value faith, family, competence, traditional masculine virtues, and balanced strength. Want practical tools, smart tech, community, and accountability. Frustrated with soft masculinity and mediocrity.

---

## 2. Brand Voice & Messaging System

**Archetype: The Wise Warrior / Protector King** — the older, wiser brother who's seen it all, leads by example, tells it straight, and still has your back. Authoritative yet approachable. Confident, disciplined, and no-nonsense. Tough-loving humor aimed at *mediocrity* — never at struggling dads.

**Messaging hierarchy (locked v3.5).** Five levels plus a merch voice — each line has its own job. Full spec + usage lockups live in `docs/brand-guide.md` §1.7:

| Level | Line | Role | Primary usage |
|---|---|---|---|
| **Positioning** | **The Boss Dad Standard** | Identity + authority | Hero, logo lockup, major branding, bios |
| **Primary tagline** | **Dad Like a Boss.** | Rallying cry | Campaigns, CTAs, merch, article sign-offs |
| **Action line** | **Boss Up.** | Motivational CTA | Community, emails, buttons, challenges |
| **Credibility** | **Real Dads. Smart Tools. Better Decisions.** | Trust & value proof | Reviews, guides, product pages, footer |
| **Philosophy** | *(full manifesto below)* | Core belief | About page, founder story, welcome emails |
| **Merch voice** | **Boss Stuff for Boss Dads** | Shop-specific | Store / product / merch only |

**Philosophy / Manifesto (canonical wording — do not paraphrase in hero/about placements):**
> Boss Daddy isn't just another men's fashion, fitness, or lifestyle brand. It is the gold standard and trusted hub for men living The Boss Dad Standard — men who believe being a proud and present father who shows up every day isn't a compromise of strength, but the ultimate expression of it.

*(The "fashion, fitness, or lifestyle" phrasing is contrast/positioning framing — it elevates us above generic lifestyle brands. It is **not** a commitment to ship fashion or fitness content pillars.)*

**Capitalization:** the core lines use **Title Case with periods** (lowercase articles — "Dad Like a Boss."). All-caps `BOSS DADDY` is reserved strictly for the wordmark/logo; use title-case *Boss Daddy* everywhere else. `BOSS` may be used sparingly as a noun of address ("Stay locked in, BOSS").

**Voice mechanics (how copy should read):**
- First-person, always: *"I used this for three weekends…"*
- Active voice. No hedging (may/might/could). Specific and concrete.
- Sentences 15–25 words; paragraphs 3–5 sentences. Lead with the useful info.
- Address the reader as a peer: *"Brother," "Friends," "Fellow Dads,"* direct *"you."* `BOSS` as a noun of address, sparingly. *(Note: "Boss Dads" stays a third-person identity term — "the hub for Boss Dads" — never a greeting like "hey boss dads.")*
- Direct openers welcome: *"Here's the deal:", "Bottom line:", "Real talk:".*
- Every claim has specifics. Reviews require a real-testing reference. Only review what was actually bought and used.

**Banlist — never use:**
- Hype: "revolutionary."
- Corporate jargon: "leverage" (verb), "synergy," "circle back," "stakeholder," "deep-dive," "ecosystem."
- Sponsored phrasing: "in partnership with," "thanks to our friends at," "brought to you by."
- Soft-parenting tells: "every child is unique," "no judgment," "you do you."

**Humor:** one dad joke per piece, max. The cynical edge targets soft culture and mediocrity — never individual dads who are struggling.

**Faith:** referenced naturally when it fits. Never preachy, never moralizing.

**Where the edge is OFF → switch to warm Protector mode:**
- First-time dads who are overwhelmed.
- Loss, mental health, marriage strain, fatherhood grief.
- Safety-critical topics — car seats, infant sleep, water safety, firearms in the home.
- Anyone who arrives vulnerable. Meet them where they are.
> The edge exists to call up men who are *coasting*. It is never aimed at men in the trenches.

**Trust & legal (non-negotiable):**
- Zero sponsors. Affiliate is fine, disclosed, and earned. Sponsored-as-honest-review is forbidden.
- FTC affiliate disclosure is auto-injected on reviews with affiliate links and must never be bypassed (legal compliance gate).

---

## 3. The Product (what's on the site)

Primary domain: **bossdaddylife.com**. Core surfaces:

- **Reviews** — honest, field-tested product reviews (4-axis rating plus an AI "Specs Grade" axis). Affiliate links disclosed.
- **Guides** — all long-form editorial: how-tos, skills, advice, essays. (Never call it a "blog.")
- **Gear** (`/gear`) — curated "Boss Daddy Approved" picks (rating ≥ 8.0) **+** branded merch ("Made by Boss Daddy"). `/shop` 301-redirects here.
- **The Bench** (internal `wishlist`) — the public product-testing pipeline; members vote on what gets tested next.
- **Collections** — curated multi-product lists with spec-comparison tables.
- **The Boss** (`/tools/the-boss`) — the member AI concierge: a tool-using assistant that searches the site's gear/guides and helps with dad-life questions; can do member-gated web research for products not yet tested ("Researched, not tested").
- **Dad Tools** — free utilities (savings tracker, "weekends-until" countdown) to drive habit and signups.
- **Merch Shop** — print-on-demand via Printful, payments via Stripe. End-to-end fulfillment is working.
- **Community/account** — member accounts, comments, likes, direct messages, notifications (in-app + email digest + web push).

**Content standards:** only review products personally bought/used or with direct firsthand knowledge. Zero sponsored reviews. Affiliate links disclosed. AI (Claude) assists drafting; human editors review.

---

## 4. Design System (so on-phone ideas stay on-brand)

**Dark-first, everywhere** (`data-theme="dark"` on `<html>`). Near-black canvas, elevated charcoal surfaces, off-white text, a single warm-orange accent. No gold, no per-category rainbow, no cream/peach/brown.

- **Accent — Hot orange `#E55A1A`** on dark (primary CTAs, active nav). Hover = core `#CC5500`. Inline links/eyebrows = `#f48a4a`. **Never** the default vivid Tailwind orange `#f97316`.
- **Surfaces:** chrome/canvas `#09090b`, surface `#18181b`, raised `#27272a`, hover `#3f3f46`. **Elevation comes from borders + raised surfaces**, with only a *soft* shadow (`shadow-black/5`–`black/10`) — black drop-shadows vanish on near-black.
- **Text:** body `#f4f4f5`, muted `#d4d4d8`, faint `#a1a1aa`.
- **Type:** Montserrat for display/headings (`font-black` for heroes); Geist Sans for body/UI; Fraunces (serif) scoped to editorial headings (Manifesto v2); Source Serif 4 for pull-quotes only.
- **Shape:** cards/panels/buttons are `rounded-xl` (12px); pills are `rounded-full`.
- **Tokens over raw shades:** components consume semantic role tokens (`bg-surface`, `text-prose`, `text-accent`, `border-soft`), enforced by an ESLint rule. Icons are inline SVGs (no emoji on web).
- **Mobile-first** — min 44px tap targets; test mobile before desktop.

Full reference lives in `docs/brand-guide.md` (deeper than this summary, and authoritative when they disagree).

---

## 5. Technical Context (for engineering decisions)

**Stack:**
- **Framework:** Next.js 16 (App Router), TypeScript strict.
- **Auth + DB:** Supabase (`@supabase/ssr`) with Row-Level Security enforced at the DB level.
- **AI:** the **Vercel AI Gateway via the AI SDK v6** (`ai` package). Generation goes through `lib/ai/*` (`aiGenerateObject`/`aiGenerateText`, and `streamText` for the concierge); models are addressed as gateway slugs (`anthropic/claude-sonnet-4.6`, `anthropic/claude-haiku-4.5`, `anthropic/claude-opus-4.8`, `xai/grok-4.5`). Per-bucket model overrides via `AI_MODEL_*` env vars; auth via `AI_GATEWAY_API_KEY`/`VERCEL_OIDC_TOKEN`. (`@anthropic-ai/sdk` + `lib/claude/client.ts` remain only as legacy: the exported system-prompt strings like `BOSS_DADDY_SYSTEM` are still consumed by the new stack.)
- **Email:** Resend (templates in `emails/`).
- **Rate limiting:** Upstash Redis.
- **Payments:** Stripe. **Merch fulfillment:** Printful (POD).
- **Styling:** Tailwind CSS v4 (no config file — tokens in `app/globals.css` via `@theme inline`).
- **Deploy:** Vercel, auto-deploys from `master`. DNS in Cloudflare.

**Hard rules / gotchas (these have caused outages — respect them):**
- **Middleware file is `proxy.ts`** at the project root (Next.js 16 convention) — *never* rename it to `middleware.ts`. The exported function is `proxy`.
- **RLS doctrine:** public-content tables must be readable `to anon, authenticated`, or logged-out visitors silently break while admins see everything. `is_admin()` only gates writes on public/moderated/admin tables — never on private user data.
- **Naming doctrine:** internal names (DB tables, routes, enums) stay stable forever; display labels change via `lib/labels.ts`. Don't rename tables to fix wording.
- **Migrations** go in `supabase/migrations/` with sequential filenames, started from `_TEMPLATE.sql`.
- **Security:** never put `ANTHROPIC_API_KEY` / `AI_GATEWAY_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` in client code or `NEXT_PUBLIC_*`. Use `getUser()` (not `getSession()`) for auth checks. Always sanitize user HTML before DB writes. Never bypass the affiliate-disclosure gate.
- **Draft generation** is rate-limited (10/user/hr).

**Review status state machine:** `draft → pending → approved`, with `rejected → draft` for author edits. Only admins approve/reject; `approved` reviews are immutable.

---

## 6. Where Things Stand (roadmap snapshot — update as it moves)

**Shipped / working:**
- Dark-first brand redesign, homepage, navigation + PWA install.
- Reviews + Guides editorial pipeline with AI drafting, content blocks, tags, categories.
- Collections with spec-comparison tables; AI Specs Grade (5th rating axis).
- The Bench (product pipeline) → member voting.
- Member AI concierge "The Boss" — fully migrated to the AI Gateway with hybrid semantic + full-text retrieval, thumbs feedback, and a crisis-only sensitive router.
- Dad Tools (savings tracker shipped).
- Notifications + direct messaging (in-app, email digest, web push).
- **Merch shop end-to-end:** Stripe checkout → Printful fulfillment validated on a real order.
- **Full AI provider layer migrated** to the Vercel AI Gateway + AI SDK v6 across every bucket (content, utility, moderation, research, concierge).

**Open / in flight (confirm current state before acting):**
- **v3.5 messaging** (2026-07-24): "The Boss Dad Standard" positioning replaces the retired "Built Different"; roll the lines across interior pages, emails, and merch.
- Merch polish: verify shipped-order tracking/email path; Sentry on swallowed webhook errors.
- Gear "provenance spine" rebuild: an `adopt` admin UI for researched candidates; reconcile admin overlap.
- The Boss: Tier-3 action tools (read/write with confirm-before-commit); Grok pilot.
- Voice-learning system (pgvector exemplar few-shot).
- Monitoring: set `CRON_SECRET` (embed cron) and confirm Sentry DSN in Vercel.
- Pending naming decision for the "Tools" / "Vault" area.

> Detailed, living status is tracked in the repo's memory index and `docs/` plan files — this section is the high-level read for strategy conversations.

---

## 7. Good Conversations to Have From Your Phone

- **Strategy/brainstorm:** monetization (affiliate → merch → membership tiers), content calendar and pillars, community features, growth/SEO, partnership boundaries (zero sponsors-as-reviews).
- **Brand/content:** draft headlines, taglines, newsletter hooks, review angles, social copy — all in the voice above. Sanity-check whether copy is on-voice or drifting into hype/corporate/soft-parenting tells.
- **Technical decisions:** reason about architecture trade-offs, feature scoping, sequencing, and whether an idea respects the hard rules in §5 — then bring the decision back to the keyboard to implement.

---

## Suggested Claude Project custom instructions (paste into the Project)

> You are my strategist and brand partner for **Boss Daddy**, a website and brand for fathers living The Boss Dad Standard. Use the attached project brief as your single source of truth for mission, messaging hierarchy, brand voice, design system, and technical context.
>
> When writing copy, stay in the Boss Daddy voice: first-person, direct, specific, tough-loving older-brother tone. Aim the edge at mediocrity — never at struggling dads. Switch to warm Protector mode for vulnerable or safety-related topics. Obey the banlist. Faith is foundational but never preached.
>
> When I brainstorm strategy, give me a clear recommendation, not an exhaustive survey. When I ask technical questions, respect the hard rules in the brief (proxy.ts, RLS doctrine, naming doctrine, security gates) and flag if an idea would violate them.

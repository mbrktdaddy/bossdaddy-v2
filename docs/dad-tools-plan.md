# Boss Daddy — Dad Tools Suite: Build Plan

> **Status**: PLANNING (REVISED 2026-05-26, fifth pass — Weekends Until depth + Log/moment vocab locked). No code shipped yet.
> **Owner**: Michael. **Last revised**: 2026-05-26, after detailed pass on Weekends Until tool surface and the moments/Log capture system.
> **Posture**: Primary focus stays on reviews + guides + merch. Tools are a small bounded experiment to collect foundational data and check engagement — NOT a brand pivot, NOT a flagship build. Big-vision thinking (Provider OS, fuller Rituals suite, AI advisor) is preserved in the appendix as future possibilities — earned via demonstrated v1 engagement, not assumed.

---

## 1. TL;DR

A **small bounded experiment** added to the existing Boss Daddy dashboard, plus one rich public tool. **Not a brand pivot.** ~2 weeks of focused work. Captures foundational data (kid profiles, moments captured, intent events) that compounds for future possibilities.

**v1 scope, total:**
1. **"My Kids" section in the existing `/dashboard`** — per-kid cards with name, birthdate, optional photo, passive display of age + weekends until 18 + weekends until next birthday, plus the kid's Log of captured moments.
2. **`/tools/weekends-until`** — a single public tool, anonymous-friendly. Multiple milestone tabs + unit toggle + multi-kid stack + share mechanics + yearly check-in email + "Capture this weekend" affordance for logged-in users.
3. **Kid Moments Log** — capture text + optional photo, stored in `kid_moments`. Accessible from the kid card, the Weekends Until result page, and an optional Sunday-night opt-in email.

**Primary product focus stays on**: reviews, guides, merch.

**Vocabulary** (locked):
- Container: **"[Kid]'s Log"** (the dashboard section, the keepsake future)
- Unit: **"moment"** (an individual captured entry)
- Verb: **"capture"** (the action of adding a moment)

---

## 2. Locked Decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Storage | Anonymous Supabase rows + claim-on-signup. Cookie-keyed `anonymous_id`. |
| 2 | URLs | `/tools/weekends-until` single public page. Kid profiles + Log live inside existing `/dashboard`. No `/tools/*` section. No `/dashboard/tools` workspace. |
| 3 | Multi-kid | From the start. Schema supports N kids per dad. Dashboard stacks; Weekends Until offers per-kid + combined view. |
| 4 | Architecture | Single route group folder `app/(tools)/tools/weekends-until/`. Kid profile + Log UI within existing `(dashboard)` route group. |
| 5 | Branding | Boss Daddy stays a content/reviews/guides/merch brand. Tools are an experimental add-on. NO new "Tools (Beta)" product launch. NO new nav item. |
| 6 | Scope discipline | NO Provider OS / fuller Rituals suite in v1. Schema is forward-compatible; do not build them now. |
| 7 | Chores | NOT built. Greenlight owns the category. |
| 8 | Voice | Per `lib/claude/client.ts` + `docs/brand-guide.md` §1. Same Boss Daddy voice across the surface. |
| 9 | **Weekends Until depth** | **Multi-layer single page**: milestone tabs (Until 18 / next birthday / starts school / gets license / summer / custom), unit toggle (weekends / bedtimes / Saturday mornings / birthdays), multi-kid stack view, three share options (OG image, copy link, send to spouse), inline "Capture this weekend" CTA for logged-in users. |
| 10 | **Yearly check-in email** | Ship in v1. Opt-in at Weekends Until result. Vercel Cron sends one email/year on anniversary with updated number. |
| 11 | **Sunday-night moments email** | Ship in v1 (opt-in only). One quiet email Sunday evening with "How was this weekend with [Kid]?" link back to capture. |
| 12 | **Moments schema** | `kid_moments` table (NOT `kid_snapshots`). Discriminator column `moment_kind` supports future ritual types without re-migration. |
| 13 | **Photo on capture** | Optional. Uses existing MediaPicker. EXIF/GPS stripped per project standard. |
| 14 | **Logged-in stat on Weekends Until result** | Show "X captured / Y weekends remaining" ONLY for logged-in users with at least one moment for the active kid. Anonymous users see pure number + capture CTA below. |
| 15 | **Vocabulary** | Container: "[Kid]'s Log". Unit: "moment". Verb: "capture". This vocab is load-bearing — use consistently across UI, email, share copy. |
| 16 | **Unit toggle scope** | Weekends + bedtimes only. Saturday mornings and birthdays dropped for v1 (too narrow / too sparse). Revisit in v1.5. |
| 17 | **Voice copy templates** | Six hand-written headline templates locked in §4.2. Voice pattern: declarative for heaviest moments, reflective questions for milestones needing emotional space. |
| 18 | **Engagement framework** | Three-checkpoint structure (30/60/90 days) with metric thresholds locked in §11. 90-day clock starts when traffic-driving effort formally begins — not on initial deploy. |

---

## 3. Strategic Frame

Boss Daddy is a **content brand** (reviews + guides + merch). Tools are a small experiment.

Why this posture:
- Reviews/guides inventory is still thin — investment there compounds faster than tools.
- Merch shop has clear monetization. Tools (at this scope) do not.
- Solo dev capacity is finite.
- A small tool experiment lets you collect engagement data without committing to a multi-year build.
- The bigger vision (Provider OS, fuller Rituals suite, AI advisor) remains aspirational. Earn the right to build via demonstrated engagement first.

**Brand identity stays unchanged**:
- Wise Warrior / Protector King voice per `lib/claude/client.ts`
- Brand orange `#CC5500` on zinc-light
- Same wordmark, nav, footer

---

## 4. v1 Scope — Detailed

### 4.1 Kid Profiles in the Existing Dashboard

**Where**: a new "My Kids" section in `/dashboard`. Not a separate workspace.

**Per-kid card content**:
- Kid name (optional — first name or nickname)
- Birthdate (required)
- Optional photo via existing MediaPicker
- Passive display (computed): current age (years + months), weekends until 18, weekends until next birthday
- "[Kid]'s Log" section below: capture affordance + recent moments feed
- Edit / delete affordances on the card itself

**Add Kid**: small "Add a kid" button below the list. Modal or inline form. Birthdate required.

**Layout**: stacked cards, mobile-first. No kid switcher needed at this surface — each kid renders as its own card.

### 4.2 `/tools/weekends-until` — One Rich Public Tool

A single URL, anonymous-friendly, with five layers of richness on the same page.

**Layer 1 — Milestone tabs** (one row of pills at the top of the input area):
- Until 18 (default)
- Next birthday
- Starts school
- Gets license
- Summer
- Custom date

Same calc against different targets. Tabs cycle the framing. Mobile: `overflow-x-auto scrollbar-hide` per project pattern.

**Layer 2 — Unit toggle** (secondary toggle below the milestone):
- Weekends (default)
- Bedtimes

One discreet toggle. Same data, different emotional cut. (Saturday mornings and birthdays were considered and dropped for v1 — too narrow / too sparse. Revisit in v1.5 if engagement justifies.)

**Layer 3 — Multi-kid display** (logged-in users with 2+ kids):
- Stacks results per kid in the saved order
- Adds a "combined" line where meaningful (e.g., overlap weekends where both kids are still under roof)
- Anonymous users see the single-kid version

**Layer 4 — Result CTA** (always shown, in priority order):
1. **Primary**: "Save this kid to your Boss Daddy dashboard" (anonymous → signup with claim-on-signup; logged-in → adds to dashboard).
2. **Capture (logged-in only)**: "Capture this weekend" inline button → quick form → saves to `kid_moments` with `moment_kind = 'weekend'`.
3. **Yearly check-in**: email opt-in for an annual touch — one email per year on the anniversary, with the updated number.
4. **Tertiary**: ONE editorial pointer ONLY IF a relevant review/guide exists. No filler.

**Layer 5 — Share mechanics**:
- OG image via `next/og` — number, kid first-initial default (full name opt-in), Boss Daddy wordmark
- Copy link — pre-filled Boss Daddy voice share text
- Send to spouse — email mode with the number pre-loaded

**Logged-in stat**: when logged in with at least one captured moment, show "X captured / Y weekends remaining" alongside the number.

**Math** (constants in code):
- `BIRTH_TO_18_WEEKENDS = 940` (named constant)
- Weeks remaining = whole weeks between today and milestone date
- Weekends remaining ≈ weeks remaining
- % elapsed = (today − birthdate) ÷ (milestone − birthdate)
- Bedtimes ≈ days remaining
- Saturday mornings ≈ weekends remaining
- Birthdays = whole years remaining

**Voice rule**: pure doom doesn't convert. Pair every result with a forward action in the same view.

**Locked headline copy templates** (hand-written for v1, not Claude-generated):

| Milestone | Template (with `{name}` if present, else `"your kid"`) |
|---|---|
| Until 18 | `{N} weekends. That's what you've got before {name} is out of the house. Make them count.` |
| Next birthday | `{N} weekends. Then {name} turns {age+1}. Plan something they'll remember.` |
| Starts school | `{N} weekends. Then your time with {name} will be very limited. What should you do before then?` |
| Gets license | `{N} weekends. Then {name} drives themselves wherever they want. What will you miss most?` |
| Summer | `{N} weekends. What plans should you make for this summer with {name}?` |
| Custom date | `{N} weekends until {custom label}. What needs to happen before then?` |

**Voice pattern (locked for future copy work)**:
- Declarative weight for the heaviest moments (Until 18, Next birthday)
- Reflective question form for milestones that need emotional space rather than cool detachment (Starts school, Gets license, Summer, Custom)
- Always pair the number with a forward verb call or question
- Use the kid's name where available; fall back to "your kid"

**Edge case copy**:
- Kid already past the milestone age: `"{name} crossed that line already. Here's what's left until {next viable milestone}."` Auto-switches tab to a viable milestone.
- Kid is brand new (0–30 days): `"940 weekends ahead. Welcome to the deep end."`

### 4.3 Kid Moments — The Log

**Where**: lives inside each kid card on the dashboard ("[Kid]'s Log" section). Also accessible from the Weekends Until result via the inline capture button.

**Capture form** (quick, 30 seconds):
- Text field: "What happened?" (free-form, no character limit)
- Optional photo upload (existing MediaPicker pattern, EXIF/GPS stripped on upload)
- Optional date (defaults to today; for Weekends Until capture, defaults to most recent Saturday)
- `moment_kind` derived by entry point: `'weekend'` from Weekends Until, `'general'` from kid card

**Log display on kid card**:
- Section header: "Mason's Log"
- Empty state: "Log is empty. Start with something small."
- Feed: most recent 3–5 moments visible inline; "See all" expands the full archive for that kid
- Each moment: date, text, optional thumbnail
- Edit/delete affordances on each moment

**Sunday-night opt-in email** (one quiet email per week):
- Opt-in at signup or in profile settings
- Subject: "How was this weekend with [Kid]?"
- Body: link back to the kid card with capture pre-opened
- No streaks. No nags. One email per week. Easy to turn off.

**Privacy posture** (load-bearing):
- Dad reads only his own moments. No admin read except consented support.
- No social sharing by default. "Send to spouse" is the explicit exception.
- No AI training on entry content.
- Aggregate analytics count entries (frequency, length distribution) — never read content.

---

## 5. Schema

```sql
-- kid profiles
create table kid_profiles (
  id uuid primary key default gen_random_uuid(),
  anonymous_id uuid,
  user_id uuid references profiles(id) on delete cascade,
  name text,
  birthdate date not null,
  photo_url text,
  schema_version int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (anonymous_id is not null or user_id is not null)
);
create index on kid_profiles(anonymous_id);
create index on kid_profiles(user_id);
alter table kid_profiles enable row level security;

-- intent events — captures Weekends Until usage; future-compatible
create table tool_intent_events (
  id uuid primary key default gen_random_uuid(),
  anonymous_id uuid,
  user_id uuid references profiles(id) on delete cascade,
  kid_profile_id uuid references kid_profiles(id) on delete cascade,
  tool text not null check (tool in ('weekends', 'moment')),
  payload jsonb not null,
  created_at timestamptz default now()
);
create index on tool_intent_events(tool, created_at desc);
create index on tool_intent_events(user_id, created_at desc);
alter table tool_intent_events enable row level security;

-- kid moments — the Log
create table kid_moments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  kid_profile_id uuid references kid_profiles(id) on delete cascade,
  moment_kind text not null default 'general' check (
    moment_kind in ('general', 'weekend', 'monthly_interest', 'quote', 'milestone')
  ),
  occurred_on date,
  response text not null,
  photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index on kid_moments(kid_profile_id, occurred_on desc nulls last, created_at desc);
alter table kid_moments enable row level security;
-- HIGHEST sensitivity table. Strict access. No admin read except consented support.

-- email subscriptions for yearly check-in + Sunday-night moments
create table tool_email_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  anonymous_id uuid,
  user_id uuid references profiles(id) on delete cascade,
  kind text not null check (kind in ('yearly_weekends_checkin', 'sunday_moments')),
  kid_profile_id uuid references kid_profiles(id) on delete cascade,
  anchor_date date,                   -- yearly_weekends_checkin: the original opt-in date
  unsubscribe_token uuid default gen_random_uuid() unique,
  created_at timestamptz default now()
);
create index on tool_email_subscriptions(kind, anchor_date);
create index on tool_email_subscriptions(user_id);
alter table tool_email_subscriptions enable row level security;
```

**RLS policies** follow project doctrine:
- `kid_profiles`, `kid_moments`, `tool_email_subscriptions`: authenticated read/write own rows; anonymous via Server Action layer reading cookie.
- `tool_intent_events`: authenticated read own; admin reads aggregate.

**After migration**: `npm run db:types`.

**Tables NOT built in v1** (appendix only): `provider_os_plans`, `ritual_entries` (full suite), `chore_lists`.

---

## 6. Build Order

1. **Migration** — `kid_profiles`, `tool_intent_events`, `kid_moments`, `tool_email_subscriptions` with RLS policies.
2. **Server Actions** — `getKids`, `addKid`, `updateKid`, `deleteKid`, `recordWeekendsRun`, `addMoment`, `listMomentsForKid`, `deleteMoment`, `subscribeToToolEmail`, `unsubscribeToolEmail`. Anonymous cookie handler. Claim-on-signup migration helper.
3. **Labels** — `lib/labels.ts` entries for tools, milestones, units, vocab (Log / moment / capture).
4. **Shared components** — `<KidProfileForm />`, `<CaptureMomentForm />`, `<MomentsFeed />`, `<KidCard />`.
5. **Dashboard "My Kids" section** — card grid, Add Kid form, edit/delete, computed age/weekends display, embedded Log section per card.
6. **`/tools/weekends-until` page** — Server Component shell + client calc island. Milestone tabs, unit toggle, multi-kid stack (logged-in), result CTA, inline capture button (logged-in), yearly check-in opt-in.
7. **OG image route** — `app/(tools)/tools/weekends-until/opengraph-image.tsx` via `next/og`.
8. **Share mechanics** — copy-link with pre-filled text, send-to-spouse email mode.
9. **Sunday-night moments email** — Resend template + Vercel Cron job scheduled weekly. Unsubscribe via `unsubscribe_token` link.
10. **Yearly check-in email** — Resend template + Vercel Cron job scheduled daily, picks up anniversaries due that day. Unsubscribe via token.

Total scope: ~2 weeks of focused work.

---

## 7. Open Decisions — RESOLVED

All 7 open decisions from the prior pass have been resolved. Final answers:

1. **Milestone tabs**: 6 default tabs — `Until 18 / Next birthday / Starts school / Gets license / Summer / Custom date`. Locked.
2. **Unit toggle**: weekends + bedtimes only. One discreet toggle between two units. (Saturday mornings and birthdays dropped for v1 — feel forced; revisit in v1.5 if engagement justifies.)
3. **OG image visual treatment**: number-only in v1. Photo overlay deferred to v1.5.
4. **Voice copy templates**: hand-written for v1 (predictable, easy to QA, free). See §4.2 for the locked templates.
5. **Sunday-night email default state**: visible at signup as a soft opt-in option.
6. **Engagement signal criteria**: framework locked (see §11). 90-day clock starts when traffic-driving effort formally begins — not on initial deploy.
7. **"For kids around [Kid]'s age" reviews/guides filter**: deferred. Revisit in v1.5 if v1 engagement warrants.

Remaining items are implementation-time micro-decisions that come up during build (specific component choices, error states, etc.) — not strategic blockers.

---

## 11. Engagement Signal Framework (Locked)

The 90-day evaluation clock starts when traffic-driving effort formally begins — not on initial deploy. Until then, metrics accumulate as baseline data without triggering decisions.

### Three checkpoints

| Checkpoint | What we measure | Decision it informs |
|---|---|---|
| 30 days into traffic push | Acquisition — did anyone find this? | Continue, fix marketing, or shelve |
| 60 days into traffic push | Retention — are moments accumulating? | Invest in richer rituals, or rethink |
| 90 days into traffic push | Multi-feature signal — what do engaged users actually do? | Commit to v1.5 build, or hold |

### Metric thresholds (proposed; revisit with real traffic data)

| Metric | Threshold for "yes, invest more" |
|---|---|
| Weekends Until uses (first 30 days) | 200+ |
| Anonymous → signup conversion | 10%+ of unique users save a kid |
| Kid dashboards with ≥1 moment captured (30 days) | 30%+ of kid profiles |
| Dashboards with ≥3 moments at 60 days | 40%+ of saved profiles |
| Yearly check-in opt-in rate | 15%+ of result-page viewers |
| Sunday-night email engagement | 20%+ open, 8%+ click |
| Share action usage | 5%+ of users use any share |
| Multi-kid adoption | 15%+ of dashboards have 2+ kids |

### Signal interpretation

- Strong acquisition + weak conversion → fix result CTA, don't build new features
- Strong conversion + weak retention → rethink capture mechanic before adding rituals
- Strong retention + strong yearly opt-in → build fuller Rituals suite (Annual Dad Letters first)
- Strong everything → earn the right to build Provider OS Phase 1
- Weak everything by 90 days → shelve tools, refocus on reviews/guides/merch

### Honest caveat

Thresholds assume baseline traffic is meaningful. If the site is doing <50 visits/day during the evaluation window, even strong conversion rates produce too small a sample to read clearly. Confirm baseline before declaring signal strong or weak.

---

## 12. Stack Mapping

| Concept | This project |
|---|---|
| Framework | Next.js 16 App Router. Strict TypeScript. |
| Middleware | `proxy.ts` at project root. Never rename. |
| Single tool location | `app/(tools)/tools/weekends-until/` |
| Kid profile + Log UI | `app/(dashboard)/dashboard/` — existing route, new section |
| Auth + DB | Supabase (`@supabase/ssr`) with RLS. |
| Forms | Server Actions. |
| OG images | `next/og` `ImageResponse`. |
| Email | Resend, templates in `emails/`. |
| Cron | Vercel Cron (Sunday-night moments, daily yearly-check-in picker). |
| Cookies | `Secure`, `HttpOnly`, `SameSite=Lax`, 1-year TTL for `anonymous_id`. |
| Photo uploads | Existing MediaPicker. EXIF/GPS stripped. |
| Styling | Tailwind v4. Brand orange `#CC5500`. Role tokens preferred. |
| Voice | `lib/claude/client.ts` + `docs/brand-guide.md` §1. |

---

## 13. Quick Summary

**What we're building**:
- Kid profiles in existing `/dashboard` with a per-kid "Log" of captured moments
- One rich public tool at `/tools/weekends-until` with milestone tabs + unit toggle + multi-kid view + share + inline capture
- Yearly check-in email + Sunday-night opt-in moments email (both opt-in, both via Vercel Cron + Resend)
- All UI uses the locked vocabulary: container = "[Kid]'s Log", unit = "moment", verb = "capture"

Total: ~2 weeks of work.

**What we're explicitly NOT building**:
- Provider OS, fuller Rituals suite, AI advisor (appendix only)
- Chores (deferred indefinitely — Greenlight owns category)
- "Boss Daddy Tools (Beta)" product line (no new brand surface)
- A `/tools/*` section (just one tool page)
- A `/dashboard/tools` workspace

**Primary brand focus stays on**: reviews + guides + merch.

**Data captured**:
- Kid profiles (foundational identity data)
- Weekends Until usage events (which milestones, which units, repeat usage)
- Moments captured (frequency, length distribution — never content)
- Email opt-in rates (signal for retention mechanics)

**What this preserves**: foundational data and forward-compatible schema. If engagement justifies, individual pieces of the appendix vision can be added incrementally as earned.

---

# APPENDIX — Future Possibilities (Do Not Build Without Validation)

> **Status**: aspirational thinking preserved from earlier planning. NONE approved for build. Do NOT begin work without explicit user direction and demonstrated engagement signal from v1.

## A1. Provider OS (the "Dad Math" reframe)

Not a calculator. A staged financial operating system for dads. Multi-account "Net Worth for [Kid]" view, scenario sandbox, 529 vs UTMA vs custodial Roth decision frameworks, spouse coordination, actuals vs targets via Plaid, estate gateway with affiliate paths, AI Dad CFO advisor, generational handoff, family-structure modes.

5 phases over ~18 months:
- Phase 1: "The Honest Calculator" — forward + reverse + catch-up + multi-kid + multi-account manual entry + spouse send
- Phase 2: "The Sandbox" — scenarios, stress tests, decision frameworks, spouse co-edit
- Phase 3: "The System" — Plaid integration, tax prompts, estate gateway, annual report
- Phase 4: "The Coach" — Claude-powered Dad CFO advisor
- Phase 5: "The Handoff" — generational handoff product, family-structure modes, advisor concierge

Revenue potential: highest lifetime-revenue-per-dad surface possible — fintech affiliates, Plaid-enabled Pro tier, advisor referrals.

Critical constraints: "estimate, not financial advice" required, Phase 3+ needs legal/compliance review, Phase 4 AI must not give specific buy/sell advice.

## A2. Fuller Rituals Suite

The v1 Log captures any-time moments. The fuller suite adds purpose-built rituals:

| Ritual | Cadence | Job |
|---|---|---|
| Presence Check-In | Weekly | "Did I show up?" rate 1–5 + one moment |
| Kid Snapshot | Monthly | "What's [Kid] into right now?" top 3 things |
| Annual Dad Letter | Yearly (birthday week) | Long-form letter — compounds into 18-year keepsake |
| Decision Archive | As-needed | "We chose X because Y" — spouse coordination + future-kid value |
| Daily Dad Prayer | Daily, opt-in | Scripture + dad-specific prayer for kid by name |

v1 schema already supports these via `moment_kind` discriminator. UI to be built later.

## A3. Artifact Features

- **Spouse Loop**: read-only plan share + cosign for Provider OS plans
- **Dad-to-Dad Recommend**: "Mike sent this" personalized referral sharing
- **Milestone Reflection**: anniversary prompts on saved plans surfaced via Log
- **Gift Mode**: spouse pre-loads Dad Math as Father's Day gift
- **Generational Handoff**: at kid's 18th birthday, full Log + plan export as keepsake
- **Annual Recap**: auto-generated yearbook from a year of moments
- **AI Dad Advisor**: Claude pattern recognition over intent + Log history

## A4. Tools as Content Engine

Aggregate data publishes as original editorial — quarterly at most. Trigger: 500+ active tool users. Example pieces: "What 5,000 Boss Daddy dads target for college," "Average chore allowance by kid age."

## A5. Architecture Promotion Path

If tools take off, the route group can promote to `tools.bossdaddylife.com` in a ~1-day refactor. NOT pre-optimized for.

## A6. Boss Daddy Crew (paid patronage tier)

NOT a paywall. An opt-in patronage tier. Premium printables, ad-free, dad-only community. Build only if demand pulls.

## A7. Anti-Content-Farm Rules

When editorial integration grows:
1. Tool slots link to editorial. Editorial does the buy.
2. Tool-adjacent editorial = first-person, specific. No listicles.
3. No editorial? Slot points to brand action.
4. Aggregate data publishes quarterly max.
5. No tool gates content. No content gates tool.
6. Log entries never used for content or training beyond consented aggregate stats.

---

# Decision History

- **Pass 1**: copied external spec (three calculators, content-led). Caught brand mismatches. Locked 4 initial decisions.
- **Pass 2**: tools-first reorientation, route group decision, Beta framing, multi-kid confirmed. Locked 8 decisions.
- **Pass 3**: reframed Dad Math as Provider OS (5 phases) and Dad Journal as Rituals Suite (5 rituals). Locked 10 decisions.
- **Pass 4 (scope discipline)**: pulled back from brand pivot and flagship ambition. v1 became small bounded experiment.
- **Pass 5 (THIS REVISION)**: deep pass on Weekends Until tool surface (milestone tabs, unit toggle, multi-kid, share, yearly check-in). Renamed `kid_snapshots` → `kid_moments`. Added Sunday-night opt-in email. Locked vocab: Log / moment / capture. Locked 15 decisions total.

The current v1 is small, honest, reversible, and rich enough at the public-tool surface to actually do acquisition work. The bigger vision remains available if earned.

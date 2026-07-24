# Boss Daddy v2 — Claude Code Rules

> **PRIMARY PROJECT** (as of 2026-04-15)
> This is the active Boss Daddy rebuild. All new feature work, design, and content happens here.
> The legacy WordPress site is at `~/boss-daddy/` — maintenance-only archive.

> **Brand & Design System**: see [`docs/brand-guide.md`](docs/brand-guide.md) — authoritative source for colors, typography, components, layout, and design decisions. Update that file when design changes; this file covers engineering rules.

> **Project Brief (living doc)**: see [`docs/boss-daddy-claude-project.md`](docs/boss-daddy-claude-project.md) — the high-level mission, brand voice, roadmap snapshot, and strategy context. Doubles as the Claude Project knowledge file used from the phone app. Consult it for strategy/voice/positioning questions; keep its §6 roadmap snapshot current as work ships.

## Source-of-Truth Map

One owner per domain. Everything else **points** here — never re-states. If two sources disagree, the authority below wins; fix the copy, don't fork it.

| Domain | Authority | Notes |
|---|---|---|
| Brand voice / messaging / positioning | `docs/brand-guide.md` §1 | canonical taglines + manifesto live here; the Brief & canva-kit only summarize + point |
| Design system (colors, type, components) | `docs/brand-guide.md` §2–12 (human-readable) + `app/globals.css` (exact token values **win**) | |
| Strategy / mission / roadmap | `docs/boss-daddy-claude-project.md` (the Brief) | summary + the portable phone Claude Project file |
| Runtime AI voice | `lib/claude/client.ts` `BOSS_DADDY_SYSTEM`, `lib/boss/prompt.ts`, `lib/merch/sayings.ts` | must match brand-guide §1 (execution layer) |
| Display labels | `lib/labels.ts` | see Naming Doctrine below |

Historical/shipped design + brand docs live in `docs/archive/` — recall-able, not authoritative.

## Stack
- **Framework**: Next.js 16 App Router, TypeScript strict
- **Auth + DB**: Supabase (`@supabase/ssr`) with Row-Level Security
- **AI**: Vercel AI Gateway via the AI SDK v6 (`ai` package); call wrappers in `lib/ai/` (`aiGenerateObject`/`aiGenerateText`, `streamText` for the concierge). Models addressed as gateway slugs (e.g. `anthropic/claude-sonnet-4.6`)
- **Email**: Resend (templates in `emails/`)
- **Rate limiting**: Upstash Redis
- **Styling**: Tailwind CSS v4
- **Deployment**: Vercel (auto-deploys from `master`)

---

## Naming Doctrine — Internal Names ≠ Display Labels

Internal names (DB tables, route segments, status enum values, variable names) stay **stable forever**. Display labels can change freely via `lib/labels.ts`.

| Layer | Stability | Example |
|---|---|---|
| DB table / column | Never rename | `wishlist_items.status = 'wishlist'` |
| Route URL | Rename only with `legacy_slugs[]` + `proxy.ts` 301 | `/bench` (was `/wishlist`) |
| Display label | Free to change in `lib/labels.ts` | `LABELS.bench.short` → "Bench" |

**Rules:**
- Adding a top-level domain concept? Define its display labels in `lib/labels.ts`.
- Tempted to rename a DB table? Don't. Add a label override and move on.
- Tempted to rename a route URL? Only if the user-facing URL is wrong. Add to `legacy_slugs[]` and 301 in `proxy.ts`.
- Page H1s, nav links, footer links, email templates → **always** use `LABELS.*`.
- Body copy, article content, one-off page strings → free text is fine.
- Brand name "Boss Daddy" is stable — do **not** centralize it.

If a rename leaks (someone hardcoded "Wishlist" instead of using `LABELS.bench.short`), fix the leak by routing through `lib/labels.ts`. Never rename the underlying internal name to match the display.

---

## Supabase Client Rules

| Context | Import from |
|---|---|
| Client Component (`'use client'`) | `@/lib/supabase/client` |
| Server Component / Route Handler | `@/lib/supabase/server` |
| Admin ops (bypass RLS) | `@/lib/supabase/admin` — server-only |

**Never** use the service-role key in client components.  
**Never** call `supabase.auth.getSession()` for auth checks — always use `getUser()`.

---

## Security Rules

1. **RLS is enforced at DB level** — do not assume application-layer checks are sufficient.
2. **Always sanitize HTML** with `sanitizeHtml()` from `@/lib/sanitize` before any DB write of user-generated content.
3. **Affiliate disclosure is legally required** — the `disclosure_acknowledged` check in `/api/reviews/route.ts` must not be bypassed. Never remove this gate.
4. **API keys stay server-side** — `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` must never appear in client code or `NEXT_PUBLIC_*` vars.
5. **Middleware enforces auth** — `middleware.ts` at root protects `/dashboard` routes and redirects unauthenticated users to `/login`.

---

## AI Usage (Vercel AI Gateway + AI SDK v6)

- **All generation routes through `lib/ai/`** — one-shot `aiGenerateObject`/`aiGenerateText` (`lib/ai/client.ts`), `streamText` for the Boss concierge (`lib/boss/agent.ts`), web-search research via `lib/ai/research.ts`. Do not call a provider SDK (`@anthropic-ai/sdk`) directly for generation — that path is legacy.
- **Model selection is centralized** in `lib/flags.ts` `resolveModel(bucket)` — buckets: `content`, `utility`, `moderation`, `research`, `concierge` (+ concierge sensitive/fast lanes). Override per bucket via `AI_MODEL_*` env vars; models are gateway slugs (`anthropic/claude-sonnet-4.6`, `anthropic/claude-haiku-4.5`, `anthropic/claude-opus-4.8`, `xai/grok-4.5`). `moderation` is compliance-pinned to Claude (no override).
- **Auth** via `VERCEL_OIDC_TOKEN` (auto on Vercel; `vercel env pull` locally) or `AI_GATEWAY_API_KEY`. No provider API keys in the gateway path.
- **Prompt caching is automatic** — `lib/ai/client.ts` wraps the system prompt in an Anthropic ephemeral cache breakpoint (`cachedSystem()`). Don't hand-roll `cache_control`.
- **No manual JSON parsing / fence-stripping** — `aiGenerateObject` enforces a schema and returns a typed, validated object. Only raw `aiGenerateText` paths return plain text.
- **Gateway failover:** the chosen provider falls back to Claude on error/budget; each call carries a `surface:<tag>` cost-attribution tag for the Gateway dashboard.
- Rate limit is **10 draft generations per user per hour** — do not remove or increase without operator approval.
- **System-prompt strings** (`BOSS_DADDY_SYSTEM`, `MODERATOR_SYSTEM`, `COMMENT_MODERATOR_SYSTEM`) still live in `lib/claude/client.ts` and are consumed by the gateway wrappers; that file is otherwise legacy (`getClaudeClient`/`createStructured` have no live callers).

---

## Review Status State Machine

```
draft → pending → approved
              ↘ rejected → draft (author edits) → pending
```

- Only `draft` and `rejected` reviews can be edited by authors.
- Only `draft` and `rejected` reviews can be submitted (→ `pending`).
- Only admins can transition `pending` → `approved` or `rejected`.
- `approved` reviews are immutable (no further status changes via API).

---

## DB Migration Workflow

- All schema changes go in `supabase/migrations/` with sequential filenames (`NNN_description.sql`).
- Never run raw `ALTER TABLE` or `CREATE TABLE` directly in application code.
- Apply via `supabase db push` or paste into the Supabase SQL editor.
- **Start every new migration from `supabase/migrations/_TEMPLATE.sql`** — it encodes the RLS doctrine below. The underscore prefix excludes it from the runner.
- After applying, regenerate types: `npm run db:types`.

### RLS doctrine (read this before authoring a migration)

Forgetting the right read role on a public table silently breaks logged-out visitors but works fine for admins — that's how migrations 042 (products) and 043 (profiles) shipped broken. Avoid the same trap:

| Table type | Read role | Write gate |
|---|---|---|
| Public content (reviews, guides, products, collections, etc.) | `to anon, authenticated` | `is_admin()` |
| Private user data (savings, DMs, family/kids, AI chat, notifications, voice, drafts) | `to authenticated` + `using (user_id = auth.uid())` — **NO `is_admin()`** | same (owner only) |
| Moderated user content (comments) | `to anon, authenticated` (approved) | `user_id = auth.uid() or is_admin()` |
| Admin-only (moderation, audit logs) | `to authenticated` + `using (is_admin())` | `is_admin()` |

- **Admin is moderation-only — `is_admin()` must NEVER appear in a policy on PRIVATE user data.** It belongs only on public-content tables, moderated-content tables, and admin-only tables. Admins reach private data (support/cron) via the service-role client (`createAdminClient`), which bypasses RLS and is auditable. Baking `is_admin()` into private tables gives the admin silent read/write of every user's data and leaks other users' rows into the admin's own UI — fixed in migs 106 (savings) + 107 (all other private tables). See [[project_admin_moderation_only_rls]] in memory.
- **Always** use the `is_admin()` helper (migration 002) — never inline the `EXISTS (SELECT 1 FROM profiles ...)` check.
- **Always** `enable row level security` on new tables.
- `UNIQUE` constraints already index — don't add a redundant B-tree on the same column.

---

## Design System

Tailwind v4 — no `tailwind.config.ts`. All tokens defined in `app/globals.css` via `@theme inline`.

> **Manifesto v2 (2026-07-06)** — the site-wide editorial redesign. The homepage (`app/(public)/page.tsx`) is the reference implementation; interior pages inherit its primitives (`EditorialHeader`, `PageHeader`, `ScoreBlock variant="ring"`) for uniformity. Full spec: [`docs/home-manifesto-spec.md`](docs/home-manifesto-spec.md). Rolling out on branch `design-v2`. Note: `@theme inline` does **not** emit `--color-*` as runtime CSS vars — in inline `style={{}}` use the raw `--bd-*` vars (e.g. `var(--bd-orange)`), not `var(--color-accent)`.

**Dark-first** (`data-theme="dark"` on `<html>`): near-black canvas, charcoal surfaces, off-white text, Hot-orange accent. Prefer the semantic role tokens (`bg-surface`, `text-prose`, `text-accent`, `border-soft`…) over raw shades. Elevation comes from **borders + raised surfaces, not shadows** (black shadows vanish on near-black). Full reference: `docs/brand-guide.md` §2.

### Color Palette (accent)
| Token | Value | Use |
|---|---|---|
| `--color-accent` / `bg-accent` | `#E55A1A` | **Primary brand accent — Hot, on dark** (CTAs, active nav, buttons) |
| `--color-accent-hover` | `#CC5500` | Button hover (core orange) |
| `--color-accent-text` / `--color-eyebrow` | `#f48a4a` | Inline links / eyebrows on dark (orange-400) |
| `orange-600 … 950` | earthy scale | Decorative tints/gradients only — prefer tokens for UI |

Surface/text/border tokens: `--color-chrome` (masthead/footer, `#09090b`), `--color-surface` (`#18181b`), `--color-surface-raised` (`#27272a`), `--color-surface-hover` (`#3f3f46`), `--color-soft`/`--color-strong` (borders), `--color-prose`/`-muted`/`-faint` (text).

### Rules
- **No vivid orange.** Never use Tailwind's default `#f97316`. The accent is `#E55A1A` (Hot, on dark) / `#CC5500` (core) — route through `text-accent`/`bg-accent`, not raw `orange-*`.
- **No per-category rainbow colors.** All categories use one unified treatment. Source of truth: `lib/categories.ts`.
- **Section headings:** default `font-black` (Montserrat). **Manifesto v2 exception:** editorial section titles use `font-editorial-display font-semibold` (Fraunces) via `EditorialHeader` — scoped to editorial surfaces only (Cover Story, section headers, `PageHeader` H1s, guide titles, Creed). Never blanket-apply serif to cards/nav/UI. See `docs/brand-guide.md` §3.
- **Card titles** in pillar/feature grids: `text-orange-500` — **except** the homepage Manifesto pillars ("In this issue"), which use `text-prose` (white) editorial titles by design.
- **Eyebrow labels:** `text-xs text-orange-500 uppercase tracking-widest`.
- **Mobile tap targets:** minimum 44px. Use `py-2.5` on pills, `py-3` on buttons/pagination/nav links.
- **Filter tabs** on listing pages: `overflow-x-auto scrollbar-hide` — never `flex-wrap`.
- **Horizontal scroll sections:** Never use `overflow-x-auto` inside a padded container — it bleeds to page level and breaks the layout. Always split into `sm:hidden` scroll strip (with `overflow-x-auto` + padding inside the scrollable div) and `hidden sm:grid` desktop grid. If inside a padded parent, use `-mx-{n}` to break out and restore padding inside.

---

## Brand Voice

All Claude draft generation uses the Boss Daddy system prompt defined in `lib/claude/client.ts`. Source of truth for voice: `docs/brand-guide.md` §1.

Archetype: **Wise Warrior / Protector King** — older, wiser brother voice. Tough-loving humor, playfully cynical toward mediocrity, warm and present with struggling dads. Grounded in faith without preaching.

Key rules:
- First-person dad voice with real-testing specifics ("I used this for 3 weekends...")
- Confident, direct — no corporate speak, no hype phrases
- Edge OFF for safety, struggle, loss, and vulnerability topics — see brand guide §1.6
- FTC disclosure auto-injected for all reviews with affiliate links

---

## Brand Assets

Logo and placeholder images live in `public/images/`:
- `bd-logo-icon.png` — **the only runtime logo.** Used by Header, Footer, every layout, the not-found page, and all email templates. Pick this when you need a logo anywhere in the app — never use a different filename, never re-introduce a "badge" or "nav" variant.
- `bd-logo-final.png` — full primary mark. Source asset used only by `scripts/generate-brand-kit-pdf.py`. Don't render in app code.
- `bd-placeholder.png` / `bd-placeholder.svg` — article image placeholder.

Favicons are served via Next.js's App Router file convention from `app/icon.png` and `app/apple-icon.png` — not from `public/images/`. Update those two files directly if the favicon ever changes.

---

## Middleware — NEVER Rename proxy.ts

**This has broken the site 4 times. Do not repeat it.**

Next.js 16 changed the middleware filename convention from `middleware.ts` to **`proxy.ts`**. This project uses `proxy.ts` at the project root — that is the correct and required filename for Next.js 16. If both `middleware.ts` and `proxy.ts` exist, the build fails with an explicit error. If only `middleware.ts` exists, the build fails the same way.

- `proxy.ts` — **must exist at the project root with this exact name**. Contains auth protection, Supabase session refresh, and legacy URL redirects. If renamed to `middleware.ts`, the build breaks.
- The function inside is named `proxy` and must be exported as `proxy` — do not rename it to `middleware`.

**Never rename `proxy.ts` to `middleware.ts`.** Never create a `middleware.ts` file alongside it.

---

## What NOT to Do

- Do not add `'use client'` to Server Components — keep data fetching on the server.
- Do not call Supabase admin client from the browser.
- Do not skip the affiliate disclosure gate — it's a legal compliance requirement.
- Do not hardcode product slugs or IDs — always derive from DB.
- Do not commit `.env.local` — use `.env.local.example` as the reference.
- Do not rename `proxy.ts` or create `middleware.ts` — see the Middleware section above.

# Boss Daddy v2 — Claude Code Rules

> **PRIMARY PROJECT** (as of 2026-04-15)
> This is the active Boss Daddy rebuild. All new feature work, design, and content happens here.
> The legacy WordPress site is at `~/boss-daddy/` — maintenance-only archive.

> **Brand & Design System**: see [`docs/brand-guide.md`](docs/brand-guide.md) — authoritative source for colors, typography, components, layout, and design decisions. Update that file when design changes; this file covers engineering rules.

## Stack
- **Framework**: Next.js 16 App Router, TypeScript strict
- **Auth + DB**: Supabase (`@supabase/ssr`) with Row-Level Security
- **AI**: Anthropic Claude API via `@anthropic-ai/sdk` (`claude-sonnet-4-6`)
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

## Claude API Usage

- Model: `claude-sonnet-4-6` (defined in `lib/claude/client.ts`)
- **Use prompt caching** on the system prompt for all Claude calls (pass `cache_control: { type: 'ephemeral' }` on the system text block).
- Rate limit is 10 draft generations per user per hour — do not remove or increase without operator approval.
- Both the draft and moderation endpoints expect **raw JSON responses** — strip markdown code fences before parsing.

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
| Public content (reviews, guides, products, pick_lists, etc.) | `to anon, authenticated` | `is_admin()` |
| User-owned data (wishlists, drafts, comments) | `to authenticated` + `using (user_id = auth.uid() or is_admin())` | same |
| Admin-only (moderation, audit logs) | `to authenticated` + `using (is_admin())` | `is_admin()` |

- **Always** use the `is_admin()` helper (migration 002) — never inline the `EXISTS (SELECT 1 FROM profiles ...)` check.
- **Always** `enable row level security` on new tables.
- `UNIQUE` constraints already index — don't add a redundant B-tree on the same column.

---

## Design System

Tailwind v4 — no `tailwind.config.ts`. All tokens defined in `app/globals.css` via `@theme inline`.

### Color Palette
| Token | Value | Use |
|---|---|---|
| `orange-600` | `#CC5500` | Primary brand — CTAs, active nav, buttons |
| `orange-500` | `#d96200` | Hover states |
| `orange-400` | `#e87030` | Accent text on dark backgrounds |
| `orange-700–950` | earthy scale | Borders, bg tints (`border-orange-700/60`, `bg-orange-950/40`) |

CSS vars also available: `--bd-orange`, `--bd-surface`, `--bd-border`, `--bd-text`, `--bd-text-muted`, `--bd-text-faint`.

### Rules
- **No vivid orange.** Never use Tailwind's default `#f97316` — our `orange-600` overrides it to `#CC5500`.
- **No per-category rainbow colors.** All categories use one unified treatment. Source of truth: `lib/categories.ts`.
- **Section headings:** always `font-black`.
- **Card titles** in pillar/feature grids: `text-orange-500`.
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
- `bd-logo-final.png` — primary logo (full)
- `bd-logo-nav.png` — compact nav logo
- `bd-logo-final-favicon.png` — favicon source
- `bd-placeholder.png` / `bd-placeholder.svg` — article image placeholder

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

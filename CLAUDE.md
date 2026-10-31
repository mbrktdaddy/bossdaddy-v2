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
| Brand voice / messaging **doctrine** | `docs/brand-guide.md` §1 | voice, capitalization, when-to-use; the Brief & canva-kit only summarize + point |
| Brand messaging **strings** (rendered) | `lib/brand.ts` | the literal taglines + manifesto the UI/metadata import; mirrors brand-guide §1.7 |
| Design system (colors, type, components) | `docs/brand-guide.md` §2–12 (human-readable) + `app/globals.css` (exact token values **win**) | |
| Strategy / mission / roadmap | `docs/boss-daddy-claude-project.md` (the Brief) | summary + the portable phone Claude Project file |
| Runtime AI voice | `lib/claude/client.ts` `BOSS_DADDY_SYSTEM`, `lib/boss/prompt.ts`, `lib/merch/sayings.ts` | must match brand-guide §1 (execution layer) |
| Display labels | `lib/labels.ts` | see Naming Doctrine below |

Historical/shipped design + brand docs live in `docs/archive/` — recall-able, not authoritative.

## Stack
- **Framework**: Next.js 16 App Router, TypeScript strict
- **Auth + DB**: Supabase (`@supabase/ssr`) with Row-Level Security
- **AI**: Vercel AI Gateway via the AI SDK v6 (`ai` package); call wrappers in `lib/ai/` (`aiGenerateObject`/`aiGenerateText`, `streamText` for the concierge). Models addressed as gateway slugs (e.g. `anthropic/claude-sonnet-5`)
- **Email**: Resend (templates in `emails/`)
- **Rate limiting**: Upstash Redis
- **Styling**: Tailwind CSS v4
- **Deployment**: Vercel (auto-deploys from `master`)

> **`vercel.json` `"regions": ["pdx1"]` is load-bearing — do not remove it.** `pdx1` is us-west-2, the same region as the Supabase project (West US / Oregon), so functions sit next to the database. The Vercel *dashboard* shows `iad1` as the project default; the `vercel.json` pin overrides it, and `x-vercel-id` confirms functions execute in `pdx1`. Deleting the key as "unnecessary config" would move every server-side query cross-country — roughly 1–3ms → 65ms, paid 1–2× per request in `proxy.ts` alone, on every page of the site. JSON can't carry a comment, which is why this note lives here.

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
- **Model selection is centralized** in `lib/flags.ts` `resolveModel(bucket)` — buckets: `content`, `utility`, `moderation`, `research`, `concierge`. Override per bucket via `AI_MODEL_*` env vars; models are gateway slugs (`anthropic/claude-sonnet-5`, `anthropic/claude-haiku-4.5`, `anthropic/claude-fable-5`, `anthropic/claude-opus-5`, `xai/grok-4.7`). `moderation` is compliance-pinned to Claude (no override). `concierge` (the Boss) defaults to Grok for xAI's live web + X search — see `docs/ai-provider-layer.md`.
- **Model slugs are pinned by hand — the Gateway has no "latest" alias.** The registry is `lib/ai/models.ts`; never invent a slug. `npm run ai:drift` reports when a pin is retired or a generation behind (weekly in CI). Bumping the registry also moves the moderation compliance gate and the content bucket's brand voice — eval, don't bump blind. Details: `docs/ai-provider-layer.md` §Model slugs.
- **Set `temperature` explicitly on new AI call sites** — unset inherits the provider default (~1.0). Deterministic lanes (moderation, extraction) are `0`; see the per-lane table in `docs/ai-provider-layer.md`.
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

> **Manifesto v2 (2026-07-06)** — the site-wide editorial redesign. The homepage (`app/(public)/page.tsx`) is the reference implementation; interior pages inherit its primitives (`EditorialHeader`, `PageHeader`, `ScoreBlock variant="ring"`) for uniformity. Full spec: [`docs/home-manifesto-spec.md`](docs/home-manifesto-spec.md). Rolling out incrementally on `master` (the old `design-v2` branch was absorbed 2026-07-06 — there is no unmerged design branch). Phases 1–2.5 done (homepage + every public listing + `/how-we-test`); Phase 3 = detail pages. Note: `@theme inline` does **not** emit `--color-*` as runtime CSS vars — in inline `style={{}}` use the raw `--bd-*` vars (e.g. `var(--bd-orange)`), not `var(--color-accent)`.

**Light editorial canvas** (flipped 2026-10-08; `lib/canvas.ts` decides, `BD_CANVAS=dark` restores the dark page): white page, near-black text, hairline borders, orange as the only accent, **black primary CTAs**. The chrome — `Header` (with its 4px orange rule), `Footer`, `MobileBottomNav`, `StickyMobileCta`, `AboutBand` (the Creed), the `(dashboard)` layout, and the utility-lane black panels (the Tools tiles, the bench header strip) — carries `data-theme="dark"` **on purpose**: those are zones, not drift. The homepage brand band (`HomeHero`) is an ORANGE block, desktop-only, not a zone. Prefer the semantic role tokens (`bg-surface`, `text-prose`, `text-accent`, `border-soft`…) over raw shades. **Content cards are borderless** (image + type + one hairline); utility modules are heavy (2px chrome-black boxes or solid blocks); no drop-shadows on content. Full reference: `docs/brand-guide.md` §2; rationale + rollout: `docs/light-editorial-plan.md`.

> **Hard Goods — the design commit (2026-10-14, brand-guide §10.1; locked until at least 2027-01-12).** The light page is LOUD through **solid blocks**: black panels and orange fills in the utility lane and at brand moments ONLY — Tools, the newsletter, the bench header strip, score + status chips, section label blocks, the About band, the masthead rule. **Never inside editorial cards or article bodies; never a dark canvas; never a wash.** Orange-block ink is `text-chrome` (white body text on the core orange misses AA). Phone masthead = the tagline folded under the wordmark + a topics scroller (`CategoryBar`, every width); desktop = the orange band + ticker. **No brand band on a phone** — two stacked bands was his one objection. Buttons are uppercase Montserrat at 4px via `buttonVariants` (`primary` / `outline` / `onBlock`); the radius scale is 4px sitewide; section headers are `EditorialHeader` = `LabelBlock` + uppercase title + 3px rule. Don't reopen the canvas / heading face / mechanism / mobile masthead inside the moratorium on a gut feeling — reader evidence or a failed walkthrough only.

> **Mechanics.** `buttonVariants('primary')` uses the `cta` tokens (black on light, hot orange inside dark zones). `--color-eyebrow` is muted grey by default; opt into orange per element with `text-accent-text` (dark bands only). `.prose` follows the role tokens in both directions, so `prose-invert` is a no-op on public pages (the old guard is retired). The radius scale is overridden globally in `@theme inline` (4px sitewide since 2026-10-14) — don't add per-component radius overrides. The homepage poster hero is retired: `HomeHero` is the desktop-only orange brand band (Hard Goods A2); on a phone the tagline folds into the masthead, the topics row takes the slot, and the cover story is the first screen. Palette, rationale, phases: `docs/light-editorial-plan.md`.

> **App-page anatomy + guard (2026-10-14).** Account/tools/commerce pages share one skeleton (compact `PageHeader` → `max-w-2xl` container → `Card tone="surface"` sections → `Field` + `buttonVariants`); use the continuity primitives in `components/ui/` (brand-guide §6a, §8), never hand-built menus/fields/pills/native `confirm()`. `npm run check:hard-goods` (prebuild + pre-commit, baseline empty = strict) fails the build on dark-era constructions — fix the code, never re-baseline.

### Color Palette (accent)
| Token | Light page | Dark zones | Use |
|---|---|---|---|
| `--color-accent` / `bg-accent` | `#CC5500` | `#E55A1A` | **The brand accent** — orange fills, rules, score rings, active nav |
| `--color-accent-hover` | `#B85A14` | `#CC5500` | Hover on orange fills |
| `--color-accent-text` | `#B85A14` | `#f48a4a` | Inline links; the opt-in orange kicker (AA on white) |
| `--color-eyebrow` | muted grey | muted grey | Eyebrows are quiet by default |
| `bg-cta text-cta-ink` | black / white | `#E55A1A` / white | **Primary button** — via `buttonVariants('primary')` only |
| `orange-600 … 950` | earthy scale | | Decorative tints/gradients only — prefer tokens for UI |

Surface/text/border tokens (light page): `--color-chrome` (masthead/footer, always `#09090b`), `--color-surface` (`#ffffff`), `--color-surface-raised` (`#fafafa`), `--color-surface-hover` (`#f4f4f5`), `--color-soft` (`#e4e4e7`) / `--color-strong` (`#d4d4d8`) borders, `--color-prose` (`#18181b`) / `-muted` (`#52525b`) / `-faint` (`#71717a`) text. Dark-zone values live beside them in `app/globals.css`.

### Rules
- **No vivid orange.** Never use Tailwind's default `#f97316`. The accent is `#CC5500` (core, on the light page) / `#E55A1A` (Hot, inside dark zones) — route through `text-accent`/`bg-accent`, not raw `orange-*`.
- **No per-category rainbow colors.** All categories use one unified treatment. Source of truth: `lib/categories.ts`.
- **Headings — one voice:** every heading is Montserrat. `font-black` for the brand-band tagline, section titles (`EditorialHeader`), page H1s (`PageHeader`), review/guide titles, cover story and lead cards; `font-extrabold` for card, row, and list titles. Fraunces (`font-editorial-display`) is the mission Creed **only**; pull-quotes use the body serif. Serif headlines were tried 2026-10-08 and rejected as a mismatch with the heavy brand — don't re-propose them. See `docs/brand-guide.md` §3.
- **Two section-header lanes (settled 2026-07-27):** `EditorialHeader` on editorial surfaces (since 2026-10-14: black `LabelBlock` + uppercase title + 3px chrome rule + outline button — light surfaces only), `SectionHeader` (3px orange rule) on utility surfaces. **`/gear` is deliberately utility-styled** — don't convert it. **`/about` is exempt from `PageHeader`** — it's a story page with a bespoke two-line H1, a second reference impl like the homepage. Both are decisions, not drift.
- **Blocks rule (Hard Goods):** black panels and orange fills live in the utility lane and at brand moments only — never inside an editorial card, a listing row, or an article body; never as an editorial section background. One orange block per screen. See brand-guide §2 "Blocks".
- **Card titles:** `text-prose`, `group-hover:text-accent`. Never orange at rest.
- **Eyebrow labels:** `text-xs text-eyebrow uppercase tracking-widest` — muted grey by default; orange only via `text-accent-text` on dark bands.
- **Mobile tap targets:** minimum 44px. Use `py-2.5` on pills, `py-3` on buttons/pagination/nav links.
- **Filter tabs** on listing pages: `overflow-x-auto scrollbar-hide` — never `flex-wrap`.
- **Horizontal scroll sections:** Never use `overflow-x-auto` inside a padded container — it bleeds to page level and breaks the layout. Always split into `sm:hidden` scroll strip (with `overflow-x-auto` + padding inside the scrollable div) and `hidden sm:grid` desktop grid. If inside a padded parent, use `-mx-{n}` to break out and restore padding inside.
- **Article bodies never get a scroll wrapper.** Wide elements scroll themselves (`.bd-editorial pre`, `.bd-image-grid`), the sanitizer strips `<table>`, and `html`/`body` + the page container (`overflow-x-clip`) clip overflow. A wrapper around the body clipped affiliate links on reviews (removed `9cde395`) and trapped the body-image lightbox on guides (removed 2026-10-25).

---

## Brand Voice

All Claude draft generation uses the Boss Daddy system prompt defined in `lib/claude/client.ts`. Source of truth for voice: `docs/brand-guide.md` §1.

Archetype: **Wise Warrior / Protector King** — older, wiser brother voice. Tough-loving humor, playfully cynical toward mediocrity, warm and present with struggling dads. Grounded in faith without preaching — the foundation is grace through faith (a gift received, not standing earned); it undergirds copy quietly and surfaces only when the subject earns it. Doctrine: brand guide §1.6 *Faith — the foundation*.

Key rules:
- First-person dad voice with real-testing specifics ("I used this for 3 weekends...")
- Confident, direct — no corporate speak, no hype phrases
- Edge OFF for safety, struggle, loss, and vulnerability topics — see brand guide §1.6
- Discussion pieces (Table Duty / Watch Duty) run the inquiry register: a witness, not a student — a clear moral position is required, party politics banned, humor stays on. "Never preach" is a density rule (gear content: faith as undertone only). See brand guide §1.6
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

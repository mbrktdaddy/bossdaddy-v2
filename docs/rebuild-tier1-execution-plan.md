# Boss Daddy v2 — Tier 1 Rebuild: Sequenced Execution Plan

> Turns the three Tier-1 items from [`memory: project_architecture_rebuild_analysis`] into an ordered, dependency-aware execution plan. Grounded in a fresh 3-agent codebase audit (2026-07-17): surface/flags, data-access layer, observability/tests. This supersedes the abstract ranking in the memory note where current state differs.

## The three Tier-1 items (from the analysis)
1. **Cut surface area to the money path** — separate revenue core from experiments behind a feature-flag module.
2. **Introduce a data-access layer** (`lib/data/<domain>.ts`) — kill the 229-file `.from()` sprawl.
3. **Wire observability + a real test net** — Sentry live, money-path smoke tests, pgTAP RLS gates.

## Key re-ordering vs. the memory note
The memory ranked these 1→2→3. **Execution order should be 3a → 1 → 3b → 2 → 3c**, because:
- **Observability is a safety net, not a feature** — it must exist *before* any refactoring so regressions are visible. It's also nearly free (Sentry is already code-wired).
- **Tests must precede the data-layer refactor**, not follow it — you can't safely rewrite 229 files' worth of DB access without a smoke net proving the money path still works.
- Feature-flag work is cheap, independent, and delivers an immediate kill-switch around revenue — good early win.

---

## Grounded current state (2026-07-17 audit)

| Area | Reality |
|---|---|
| **Sentry** | Fully code-wired: `@sentry/nextjs ^10.50`, `instrumentation.ts`, 3 runtime configs, 13 error boundaries — all gated on `SENTRY_DSN` presence. **Inert unless DSN set in Vercel prod.** History of disable/re-enable (2026-05-12) → must *verify* it's live, not assume. |
| **Tests** | **Zero.** No framework installed (no Playwright/Vitest/Jest in `package.json`). Only artifact: `scripts/smoke-test.mjs`, a ~10-URL status-code curl-loop (no DOM, no checkout). |
| **CI** | One workflow: `check-migrations.yml` (replays all migrations on vanilla Postgres). No test/lint/RLS jobs. Guard-script pattern exists (`check-middleware-convention.mjs`, `check-og-coverage.mjs` on `prebuild`). |
| **pgTAP / RLS tests** | **Absent.** No `supabase/tests/`. RLS recursion has bitten prod ≥3× (migs 002, 024, 079). |
| **Feature flags** | **None exist.** Clean slate. Nearest primitive: `lib/boss/entitlements.ts` (tier resolver for The Boss only) — good *shape* reference, not to be merged. |
| **Data-access layer** | No `lib/data/`. **229 files, 770 `.from()` sites** (routes 394 / pages 176 / lib 169 / components 17). Partial thin modules exist for products & reviews; **guides has none**. 151 files use the admin (RLS-bypass) client. |
| **Money path** | Two mechanics, both prod-complete, both un-flagged: (A) affiliate click `[[BUY:slug]]` → `/go/[slug]/route.ts` → Amazon; (B) merch: cart → `api/checkout` → `api/webhooks/stripe` → Printful → `order-emails`. |
| **Core vs experiments** | **Core:** reviews, guides, gear, category, cart/checkout/order, comparisons/picks/stacks/gifts, search, RSS/OG. **Experiments (maintenance tax):** Dad Tools (savings, weekends-until, dad-math, family), The Boss AI, Bench voting pipeline, X Studio / radar cron, member social (DMs, comments, likes, notifications, push). |

---

## Phase 0 — Observability live (safety net first)
**Goal:** every error in prod is visible before we touch anything. **Effort: ~1 hr, near-zero code.**

1. Set in Vercel **Production** env: `SENTRY_DSN` (or `NEXT_PUBLIC_SENTRY_DSN`), plus `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (source maps). *Operator task — user runs this in Vercel.*
2. Confirm `next.config.ts` wraps with `withSentryConfig` (source-map upload); add if missing.
3. Deploy, then throw a deliberate test error on a prod route and confirm it lands in Sentry. **Do not assume — verify** (given the 2026-05-12 disable history).
4. Add a `prebuild` guard script (`check-sentry-dsn.mjs`, mirroring `check-middleware-convention.mjs`) that fails a **production** build if no DSN is set — so it can never silently go inert again.

**Exit criteria:** a real thrown error appears in the Sentry dashboard from a prod deploy; build fails if DSN missing.

---

## Phase 1 — Feature-flag module + cut surface to the money path
**Goal:** a kill-switch/gating layer, revenue wrapped, experiments demotable without migration/redirect archaeology. **Effort: ~1–2 days.**

1. **Build `lib/flags.ts`** — clean slate. Env-driven, typed, no external SDK. Shape modeled on `entitlements.ts` (typed presets + single resolver), e.g. `isEnabled('dad-tools') → boolean` reading `process.env.BD_FLAG_*` with safe defaults (core = on, experiments = on-but-flaggable). Server-readable; expose a client-safe subset via a `NEXT_PUBLIC_` mirror only for nav rendering.
2. **Wrap the money path as kill-switches** (not internal edits): `/go/[slug]`, `/api/checkout`, `/api/webhooks/stripe`. A flag flip should degrade gracefully (e.g. checkout disabled → friendly message), never 500. These stay **on**; the value is the switch existing.
3. **Gate experiment surfaces behind flags** at three seams:
   - **Nav** (`components/Header.tsx` `NAV_LINKS`, `components/Footer.tsx`, `MobileBottomNav.tsx`) — conditionally render Tools/Bench/etc.
   - **Route** — flagged-off routes `notFound()` or redirect (via `proxy.ts` or page-level).
   - **Cron** — flag-guard the experiment crons (radar, savings nudges, sunday-moments) so they no-op when disabled.
4. **Decide the cut** (product call, not code — needs your input): which experiments go *dark* (flag off in prod, kept in code) vs *stay*. Candidates to dark-launch off: X Studio/radar, Bench voting, parts of Dad Tools. Default recommendation: keep core + savings + The Boss visible; flag the rest off until each earns its nav slot.
5. Document the flag registry + current prod values in this doc / a `docs/flags.md`.

**Exit criteria:** flipping `BD_FLAG_x_studio=off` removes it from nav + 404s its routes + no-ops its cron, with zero DB/redirect changes. Money-path kill-switches tested to degrade gracefully.

> Note: nav today is clean (nothing badly half-built is linked; The Boss uses a soft-wall, social icons self-disable on empty URL). So this phase is mostly *pre-emptive* infrastructure + deciding what to hide, not damage control.

---

## Phase 2 — Money-path test net (before any refactor)
**Goal:** an automated safety net over revenue so Phase 4 refactoring is safe. **Effort: ~2–3 days.**

1. **Install Playwright** (`@playwright/test` devDep, `playwright.config.ts`). Starting from zero — no framework exists.
2. **Write money-path smoke specs** against the audited files:
   - Render `/reviews/[slug]` + `/gear/[slug]`; assert an affiliate link points at `/go/[slug]`.
   - Hit `/go/[slug]`; assert 301 → Amazon URL with associate tag appended (`lib/amazon-tag.ts`).
   - Cart add via `api/cart/add` → `api/checkout`; assert a Stripe session URL returns.
   - **Webhook**: integration-test `handleCheckoutComplete` in `api/webhooks/stripe/route.ts` directly (mock Stripe event) — assert order insert + Printful call + `sendOrderConfirmationEmail` invoked. (Full live-Stripe e2e is out of scope; unit the handler.)
3. **Add a `ci.yml` workflow** running typecheck + the Playwright smoke on PR + push-to-master. Extend, don't replace, the existing single-workflow setup.
4. Keep `scripts/smoke-test.mjs` as the post-deploy ping; its URL list is a useful reference, not a foundation.

**Exit criteria:** `npm run e2e` green locally + in CI; a deliberately broken affiliate/checkout path turns the suite red.

---

## Phase 3 — Data-access layer (`lib/data/<domain>.ts`)
**Goal:** one typed module per domain; collapse 770 scattered `.from()` calls to a testable chokepoint. **Effort: ~1–2 weeks, incremental.** Guarded by Phase 2's tests.

**Convention (decide once, up front):**
- Repos **receive a client instance** (`createClient()` or `createAdminClient()`) as a param — the calling convention is already uniform, so this is a clean fit. Repo functions never create their own client (keeps user-scoped vs. privileged explicit at the call site).
- Return typed rows from `database.types.ts`; validate writes with existing `lib/*/schema.ts` zod schemas.
- Each new repo ships with unit tests (now possible since Phase 2 added the test runner).

**Sequence (cheapest/cleanest first, to build momentum + prove the pattern):**
1. **`lib/data/guides.ts`** — 61 calls / 38 files, **zero existing centralization** → clean unencumbered first build; proves the pattern end-to-end.
2. **`lib/data/collections.ts`** — 46 calls / 18 files, already ~30% done in `lib/collection-listings.ts` → cheapest to *finish*; fold the old module in.
3. **`lib/data/products.ts`** — 51 calls / 32 files; absorb the existing thin `lib/products.ts` (keep `/go` + affiliate helpers). **Money-path adjacent → Phase 2 tests protect this migration.**
4. **`lib/data/reviews.ts`** — 84 calls / 51 files; absorb thin `lib/reviews.ts`. Largest content table.
5. **`lib/data/profiles.ts`** — 106 calls / 87 files (highest volume) but mostly trivial `get by id/username` reads → knock out fast; reconcile with `auth-cache.ts` (`getCurrentProfile` stays the current-user chokepoint).
6. **Extract the 12 leaky `components/*`** direct queries into the new repos as you touch each domain (they're untestable UI/data hybrids today).
7. **Audit the 151 admin-client files as you go** — each repo call site must justify RLS-bypass; flag any private-data reads that should be user-scoped (ties to the RLS doctrine).

Migrate call-site-by-call-site per domain; run the Phase 2 suite after each domain. Defer phase-2 tables (savings_goals, media_assets, kid_profiles, merch, comments) — many belong to experiment surfaces that may be flagged off.

**Exit criteria:** the 5 top tables are accessed **only** through `lib/data/*`; an ESLint rule bans raw `.from('<migrated-table>')` outside `lib/data/`; money-path suite still green.

---

## Phase 4 — RLS gates in CI
**Goal:** make RLS correctness structural, closing the gap that caused ≥3 prod incidents. **Effort: ~2–3 days.**

1. **Add `supabase/tests/*.sql` pgTAP suite** asserting the read/write matrix from the CLAUDE.md doctrine: anon can read public content, anon **cannot** read private tables, user A cannot see user B's rows, `is_admin()` never appears on private-data policies.
2. **Extend `check-migrations.yml`** (or a sibling job) — it already spins a Postgres service container + replays migrations; add pgTAP extension install + `pg_prove` step after the replay. Direct reuse of the existing pattern.
3. **Add a policy linter** (`prebuild` guard, mirroring existing guard scripts): fail if a private-data table's policy contains `is_admin()`, or a public-content table lacks `to anon, authenticated`.

**Exit criteria:** a migration that grants anon read on a private table fails CI; the doctrine table is enforced, not just documented.

---

## Dependency graph (summary)
```
Phase 0 (Sentry live) ─────────────┐  (safety net, do first, ~1hr)
                                    ▼
Phase 1 (flags + cut) ──┐   independent of tests
                        ▼
Phase 2 (money-path tests) ──► REQUIRED BEFORE ──► Phase 3 (data layer)
                                                        │
Phase 4 (RLS gates) ── can run parallel to Phase 3 ─────┘
```

## What needs an operator/product decision (not code)
- **Phase 0**: set Sentry env vars in Vercel prod (only you can).
- **Phase 1 step 4**: which experiment surfaces to flag *off* in prod. Recommendation: keep core + savings + The Boss; dark-launch X Studio/radar, Bench, weekends-until/dad-math until each earns its slot.
- **Phase 3 convention**: sign off on "repos receive a client param" before building repo #1 (changing it later is expensive).

## Effort snapshot
| Phase | Effort | Blocking? |
|---|---|---|
| 0 — Sentry live | ~1 hr | Do first |
| 1 — Flags + cut | 1–2 days | — |
| 2 — Money-path tests | 2–3 days | **Blocks Phase 3** |
| 3 — Data layer | 1–2 weeks (incremental) | Needs Phase 2 |
| 4 — RLS gates | 2–3 days | Parallel to 3 |

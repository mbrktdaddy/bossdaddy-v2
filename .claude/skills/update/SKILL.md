---
name: update
description: Verify and search for software, dependency, platform, and AI-model updates across Boss Daddy v2 — npm packages, security advisories, AI model slugs, Vercel/Supabase/Stripe/Resend/Upstash/Printful/Cloudflare service changes, GitHub Actions, local tooling. Ranks findings Critical / Important / Beneficial / Hold. Report-only unless `--apply`.
argument-hint: "[all|deps|security|ai|services|ci|tools] [--apply] [--save]"
---

# /update — what should we update, and does it matter?

You are the project's update auditor. Produce ONE ranked report of updates that are **critical** (security or imminent breakage), **important** (deprecation with a date, a fix we need, drift from our own pins), or **beneficial** (features/perf we'd actually use). Everything else is noise — leave it out.

**Operator mode is on** (memory `project_operator_mode_90_day`): an update is only worth doing if it protects the site, keeps a service working, or costs nothing. Never turn this into a refactor or a build.

## Arguments

| Arg | Scope |
|---|---|
| *(none)* / `all` | every lane below |
| `deps` | npm outdated only |
| `security` | npm audit + vendor security notices |
| `ai` | model registry drift + provider model deprecations |
| `services` | Vercel, Supabase, Stripe, Resend, Upstash, Printful, Cloudflare, Sentry |
| `ci` | GitHub Actions + CI Node version |
| `tools` | local Node/npm/Claude Code/Supabase CLI |
| `--apply` | after reporting, apply the **Safe set** (defined below). Never applies majors or Hold items. |
| `--save` | write the report to `docs/updates/YYYY-MM-DD.md` |

## Step 1 — collect (one command)

Run the scanner first. It covers `deps`, `security`, `ci`, the Stripe API pin, the model slugs, and local versions in a single call. Run it from PowerShell (the Bash guardrail hook flags any command containing `.env`):

```powershell
npm run update:scan
```

Read the whole output. Do **not** re-run `npm outdated` / `npm audit` separately.

For the `ai` lane also run `npm run ai:drift` (PowerShell; it loads `.env.local` for gateway access — use `ai:drift:ci` if no local env). It reports retired or generation-behind slugs against the Gateway catalog. Also run `npm run images:check` — the OpenAI image-model pins in `lib/images/tiers.ts` are not on the Gateway, so `ai:drift` cannot see them.

## Step 2 — judge against the project's standing decisions

These are decisions, not drift. Report them under **Hold** with the reason; never recommend reversing them without new evidence:

| Item | Status | Source |
|---|---|---|
| `ai` → v7 (+ `@ai-sdk/*` majors) | **HOLD** — whole `lib/ai` layer is v6; v7 is its own task after content migration | memory `project_ai_provider_layer` |
| `eslint` → v10 | **DEFERRED** — own task; the 20-ish eslint/minimatch audit rows resolve with it | memory `project_eslint_v10_followup` |
| npm audit accepted set (26, dev/build-only) | **BASELINE** — only new rows or rows that become runtime-reachable matter | memory `project_npm_audit_triage_2026_10_31` |
| `vercel.json` `regions: ["pdx1"]` | never remove; do **not** migrate to `vercel.ts` casually — the pin must survive | CLAUDE.md |
| `proxy.ts` | never rename to `middleware.ts` | CLAUDE.md |
| AI model slugs | pinned by hand in `lib/ai/models.ts`; content lane = top tier (Opus 5); moderation is compliance-pinned to Claude | CLAUDE.md, memory `feedback_production_content_top_model` |
| `react` / `react-dom` | exact-pinned; move together, run the prebuild guards | package.json |
| `@sentry/nextjs` v11 | available major; not required for any current fix — config migration, own task | audit-triage memory |
| Playwright / e2e | never a commit gate; don't bump to "get new test features" | memory `feedback_e2e_not_a_commit_gate` |

**Reachability beats severity.** For every audit row, check whether the vulnerable feature is in *our* path (grep the option, the import, the route) before calling it Critical. Build-time tools on trusted input are not runtime exposure.

**Next.js**: any `next` bump beyond patch goes through the `vercel:next-upgrade` skill, then `npm run check` + the prebuild guards (`check:middleware`, `check:hard-goods`, etc.). Patch bumps with a security advisory are Critical.

## Step 3 — services lane (web + MCP, batched)

Only when scope includes `services` or `all`. Send every search in the **same turn**, `mode: "standard"` first; escalate to `extended` only for a thin result. Use `WebFetch` on the vendor changelog when a search result is ambiguous. One query per vendor, dated to the last ~90 days:

- **Vercel** — Node runtime deprecations (Node 20 was deprecated 2026-10-01; confirm the project's runtime setting via `mcp__plugin_vercel_vercel__get_project` → `nodeVersion`), Next.js advisories, Cron / Fluid Compute changes, AI Gateway model catalog changes.
- **Supabase** — `@supabase/ssr` + `supabase-js` breaking notes, Postgres version + upgrade prompt (`mcp__plugin_supabase_supabase__get_project`), **security + performance advisors** (`mcp__plugin_supabase_supabase__get_advisors`, both types) — any new advisor row is at least Important. CLI version vs `supabase/setup-cli` in CI.
- **Stripe** — is `lib/stripe.ts` `apiVersion` still current? New API version = Beneficial unless a webhook payload we parse changed (memory `feedback_stripe_api_shipping_details` is the precedent). `stripe` npm major = check the pinned apiVersion it defaults to.
- **Resend** — SDK breaking changes, sending-domain / DMARC policy changes.
- **Upstash** — `@upstash/redis` / `ratelimit` breaking changes.
- **Printful** — webhook / API v2 deadlines (memory `project_printful_webhook_v2_followup`).
- **Cloudflare** — only if a DNS / zone policy change affects us (memory `project_cloudflare_social_checklist`).
- **Sentry** — v10 EOL date, if announced, moves the v11 Hold to Important.
- **Anthropic / xAI models** — deprecation or retirement notices for every slug in `lib/ai/models.ts`. A retirement date within 60 days is Critical. Verify a replacement slug exists in the Gateway catalog before proposing it — never invent a slug (memory `feedback_verify_model_against_sdk`).

Cite the vendor page for anything dated. If a search returns nothing, say "no notice found", not "no change".

## Step 4 — report

Lead with the verdict, then one table, then the Safe set. Keep it under ~40 lines unless the findings demand more.

```
## /update — YYYY-MM-DD  ·  verdict: <nothing urgent | N critical | ...>

| Rank | What | Now → Target | Why it matters | Action | Risk |
|---|---|---|---|---|---|
| CRITICAL | ... | ... | advisory / retirement date / breakage | exact command or task | what to test |
| IMPORTANT | ... | ... | ... | ... | ... |
| BENEFICIAL | ... | ... | ... | ... | ... |
| HOLD | ... | ... | standing decision + source | — | — |

**Safe set** (patch/minor, non-load-bearing, prod + dev): <list, or "none">
**Needs his call**: <majors and load-bearing minors, one line each>
**Skipped as noise**: <count only>
```

Rules for the table:
- One row per decision, not per package — group a family (`@tiptap/*`, `@types/*`) into one row.
- "Now → Target" uses the `wanted` column for a safe bump and `latest` only when recommending the major.
- Never list the 26 accepted audit rows individually; say "baseline unchanged" or list only the new ones.
- Clickable paths for anything he has to open (`lib/stripe.ts:10`).

## Step 5 — `--apply` (only when asked)

The **Safe set** is: patch and minor bumps, **not** in the load-bearing column of the scanner, **not** in the Hold table. Apply it as one step:

```powershell
npm install <pkg>@<wanted> <pkg>@<wanted> ...   # explicit versions, never `npm update` blind
npm run check
npm test
```

**Family gotcha:** `@tiptap/*` siblings pin each other with exact peers, so a plain `npm install` of the five direct packages ERESOLVEs against the old tree. Do it as `npm uninstall <the five>` then `npm install <the five>@<version>` in one step, then verify a single version across the lockfile (the 2026-11-01 run needed this).

Then `npm run build` once if anything in the set touches rendering (`@tiptap/*`, `react-easy-crop`, `sharp`). Report the gate output verbatim on failure and stop — do not retry with a different version. On success, commit direct to master (no PR ceremony — memory `feedback_lightweight_process_no_pr_ceremony`):

```
chore(deps): safe-set bump YYYY-MM-DD (<n> packages)
```

Load-bearing minors (`@supabase/*`, `resend`, `stripe` minor, `react` minor, `supabase` CLI) and every major are **never** auto-applied — list them under "Needs his call" with the test he should run. If he accepts a new audit advisory as baseline, update memory `project_npm_audit_triage_*` (new dated file + index line) so the next run diffs against it.

## Budget

- The whole `all` run should fit in ~8 tool calls: 1 scanner, 1 drift, 1–2 MCP, 1 batched web-search turn, 1 optional fetch, and the report. No subagents unless a single vendor needs a multi-page changelog read — then `model: haiku`, scope one vendor.
- Don't Read `package.json` or the workflows; the scanner already summarised them.
- Don't open `node_modules`.

# AI Provider Layer (`lib/ai/` + `lib/flags.ts`)

> **Status:** COMPLETE — all buckets migrated to the Gateway (content, utility, moderation, research, concierge/streaming). `@anthropic-ai/sdk` + `lib/claude/client.ts` remain only as legacy (shared system-prompt strings; `createStructured` is dead code).
> Target architecture for **multi-provider by design** — not a one-off Grok pilot.

## Why this exists

Every LLM call used to go straight through `lib/claude/client.ts` (`getClaudeClient()` → raw `@anthropic-ai/sdk`). That hard-codes one vendor's request/response shape everywhere and gives nothing for a second (or third) provider. The goal is to switch providers **per purpose** — for preference, cost, or availability — so the app routes through the **Vercel AI Gateway** via the **AI SDK v6** (`ai@^6`): one interface, `provider/model` strings, built-in failover, cost tracking, and observability.

Decision supersedes the earlier "Anthropic-compat `baseURL`" brainstorm: that only reaches Anthropic-shaped providers (xAI) and needs a full rewrite the moment a non-Anthropic provider (OpenAI/Gemini) is wanted. The Gateway is the real N-provider seam.

## Two mechanisms, kept separate

| Concern | Trigger | Mechanism | Human action |
|---|---|---|---|
| Provider **outage** | provider down / 503 | Gateway `providerOptions.gateway.models` fallback chain | none — automatic |
| **Cost** cap hit | 402 budget | same fallback chain | none — automatic |
| **Preference** switch | operator choice | per-bucket env var (`lib/flags.ts`) | set env + redeploy |

The scary two (outage, cost) are automatic. The manual toggle only serves deliberate preference.

## Purpose buckets

AI calls are grouped into **buckets**, not toggled per-endpoint. Each bucket has one default model + an automatic Claude fallback.

| Bucket | Covers | Toggle env var |
|---|---|---|
| `content` | drafts, guides, refines, collections, social copy, repurpose | `AI_MODEL_CONTENT` |
| `research` | the 3 web-search surfaces (specs-grade, radar, boss research) | `AI_MODEL_RESEARCH` |
| `utility` | seo-meta, alt-text, suggest-links/prompt, product-facts | `AI_MODEL_UTILITY` |
| `concierge` | the Boss streaming agent | `AI_MODEL_CONCIERGE` (+ `AI_MODEL_CONCIERGE_SENSITIVE`) |
| `moderation` | review + comment moderation | **none — pinned** |

Set any toggle to a gateway slug, e.g. `AI_MODEL_CONTENT=xai/grok-4.5`. Invalid / non-`provider/model` values are ignored (stay on default). Takes effect next deploy.

### Two safety rules baked into config (not left to discipline)

1. **`moderation` is pinned to Claude and ignores its overrides.** It's the FTC/affiliate compliance gate (CLAUDE.md §3); it must not be swapped to an unevaluated provider by a stray env var. Un-pin only by editing `PINNED` in `lib/flags.ts` deliberately.
2. **The concierge sensitive lane** (edge-off / vulnerable-topic turns — loss, mental health, safety-critical) resolves via `AI_MODEL_CONCIERGE_SENSITIVE`, **defaulting to Claude** even when the everyday concierge model is something else. It is still operator-overridable — the operator owns the brand-tone call — it just defaults safe.

## Model slugs

Gateway slugs use **dots** for versions, not hyphens: `anthropic/claude-sonnet-5`. Registry: `lib/ai/models.ts`. Verified live 2026-07-27 via `gateway.getAvailableModels()` (`npm run ai:smoke` — 300 models). **Before pointing production at a new slug, confirm it live** — do not trust a doc or memory.

### Staying current: pin the decision, automate the detection

The Gateway has **no floating "latest" alias.** There is no `anthropic/claude-sonnet-latest`, and no routing option resolves "newest of a family" (the options are only `order`, `only`, `models`, `user`, `tags`). So a generation jump is always a deliberate edit to `lib/ai/models.ts`.

The slugs do carry **no date**, though — `anthropic/claude-sonnet-5`, not `...-5-20260214`. So the Gateway already abstracts snapshot-level refreshes: what we pin is a **generation, not a snapshot.**

Auto-floating would be wrong here even if it existed:
- `moderation` is a legal/compliance gate — it must not move without review.
- 19 surfaces depend on `generateObject` schema adherence, which shifts across generations.
- The `content` bucket's brand voice is tuned per model; a silent swap is a voice regression discovered in published copy.
- Prompt-cache breakpoints re-warm and per-token prices change with no signal but the invoice.

Old versions stay served for a long time (`claude-3-haiku`, `opus-4`, `sonnet-4` are all still listed), so pinning carries no sudden-breakage risk.

**Therefore:** `npm run ai:drift` (`scripts/ai-model-drift.mjs`) compares the registry against the live gateway and reports two things — **RETIRED** (a pinned slug no longer served → will 400 at runtime, fix now) and **DRIFT** (a newer generation exists → advisory, eval then bump). It runs weekly in CI (`.github/workflows/check-ai-model-drift.yml`) plus on any change to the registry. It never auto-upgrades. Requires the `AI_GATEWAY_API_KEY` repo secret.

Version ordering is a heuristic across xAI's scheme (`4.20` sorts above `4.5`), which is another reason the script only advises.

### Sampling temperature per lane

Temperature is set per call site, not per bucket, because it tracks the *task* rather than the provider:

| Lane | Temp | Why |
|---|---|---|
| moderation (review + comment) | `0` | A compliance gate must be reproducible — the same submission has to score the same way twice or the audit trail is meaningless. |
| seo-meta, product-facts, suggest-links, alt-text | `0` | Mechanical extraction/selection; invention is the failure mode. |
| refine-selection | `0.3` | Rewriting the operator's prose to an instruction — faithfulness first, but flat-0 editing reads mechanical. |
| suggest-prompt | `0.7` | Ideation the operator re-clicks for fresh angles; identical output would be the bug. |
| drafts, guides, repurpose | `0.8` | Brand-voice long-form. |
| merch sayings | `1.0` | Deliberately widest — short, punchy, high-variance output. |

Anything left unset inherits the provider default (~1.0), which is why the deterministic lanes above are now explicit.

## AI SDK v7 upgrade — assessed 2026-07-27, deliberately deferred

**The three packages are interlocked and must move as one PR.** `ai`,
`@ai-sdk/anthropic` and `@ai-sdk/xai` share a transitive `@ai-sdk/provider-utils`.
Bumping any one alone splits that tree and breaks `lib/ai/research.ts` with the
SharedV4-vs-V3 type errors documented under *Research bucket* below:

| | `@ai-sdk/provider` | `provider-utils` |
|---|---|---|
| current (`ai@6.0.230`, anthropic 3.x, xai 3.x) | 3.0.14 | 4.0.40 |
| v7 (`ai@7`, anthropic 4.x, xai 4.x) | 4.0.3 | 5.0.12 |

Dependabot's default is one PR per major, which produced three individually
unmergeable PRs (#68/#69/#70, then #76/#77/#78). Fixed at the source: the
`ai-sdk` group in `.github/dependabot.yml` batches them **including majors**, with
the packages listed by name — the `@ai-sdk/*` wildcard did **not** match the
scoped packages.

**Assessment result — it looked clean.** Installed together
(`ai@7.0.38` / `@ai-sdk/anthropic@4.0.22` / `@ai-sdk/xai@4.0.19`) the tree
resolved on `provider-utils@5.0.13` and:

- `tsc --noEmit` — 0 errors
- `next build` — compiled (the check that matters; bare `tsc` resolves export
  conditions differently and has passed on a build that then failed)
- 135 unit tests, eslint — green
- `npm run ai:smoke` — live `generateObject` through the gateway ✓
- `npm run ai:research-smoke` — provider-native web search + `Output.object` ✓
- `npm run embed:smoke`, `npm run hybrid:smoke` ✓
- `npm run boss:eval` — **10/11**, one failure not diagnosed

**Deferred anyway.** Not because of that failure — the golden eval has known
run-to-run variance (10/11 at PR #52, 11/11 on identical code the same day), so it
is probably noise. Deferred because a major bump across `lib/ai`, the concierge and
the content money path buys **nothing user-facing**, and it landed at the end of a
churn-heavy day. No feature, no fix, no speed — just currency.

**When the grouped PR arrives, this is the checklist:**

1. `npm ci && npm run check && npm run build` — build, not just `tsc`.
2. `npm run boss:eval` **twice** — confirm any failure is variance, not a regression.
3. `npm run ai:research-smoke` — the highest-risk path; v7 is precisely where the
   provider-executed web-search tool typings changed.
4. Check whether the two `as unknown as Tool` casts in `lib/ai/research.ts` are
   still needed. They exist only to bridge the v6/v7 declaration skew, so v7 may
   let them be deleted — verify with `next build`, not `tsc`.

## Auth

Gateway auth resolves in order: `AI_GATEWAY_API_KEY` (static, for CI/local) → `VERCEL_OIDC_TOKEN` (default on Vercel; `vercel env pull` locally, ~24h TTL). No provider keys are handled in `lib/ai/`. The legacy `ANTHROPIC_API_KEY` is only used by not-yet-migrated call sites still on `lib/claude/client.ts`.

## Public API (`lib/ai/client.ts`)

- `aiGenerateObject({ bucket, tag, schema, system?, prompt|messages, maxOutputTokens, ... })` — one-shot structured output (schema-validated). Replaces the tool-forcing `createStructured` + manual JSON parsing.
- `aiGenerateText({ bucket, tag, system?, prompt|messages, maxOutputTokens, ... })` — one-shot plain text.

Both auto-apply: Gateway failover to Claude, a `surface:<tag>` cost tag, and an Anthropic ephemeral cache breakpoint on the system block.

## Migration phases

1. **Foundation + seam** — `ai@6`, `lib/ai/models.ts`, `lib/flags.ts` resolver, `lib/ai/client.ts` wrappers, unit tests. Everything still resolves to Claude; existing call sites untouched. ✅ **done**
2. **`content` + `utility` one-shot sites** — ✅ **done.** All `createStructured` callers + plain-text sites moved to the wrappers (`aiGenerateObject`/`aiGenerateText`); `createStructured` is now dead code.
3. **`research` (web_search)** — ✅ **done.** One helper `lib/ai/research.ts` (`aiResearch()`) backs all three surfaces (specs-grade, `research_gear`, radar). See **Research bucket** below.
4. **`concierge` streaming agent** — ✅ **done.** `lib/boss/agent.ts` runs on `streamText` through the Gateway (`resolveModel('concierge', …)`), preserving the sensitive-lane split. Hybrid semantic + full-text retrieval, thumbs feedback, and a crisis-only sensitive router shipped on top.

## Research bucket (`lib/ai/research.ts`)

The only bucket that does live web search. Web search is **provider-native, not portable**: each provider ships its own search tool with its own data + freshness (Anthropic web search vs **xAI / Grok Live Search** over the real-time X firehose). So `aiResearch()` dispatches the search tool by the **resolved provider** — `researchProviderFor(model)`: `xai/*` → `xai.tools.webSearch()`, everything else → `anthropic.tools.webSearch_20260209()`. Flip `AI_MODEL_RESEARCH=xai/grok-4.5` and the whole bucket (including the Boss's `research_gear` search) switches to Grok Live Search with **no code change**.

Design decisions:
- **Provider-native, not Gateway-native.** The Gateway also offers portable search tools (`gateway.tools.parallelSearch/exaSearch/perplexitySearch`), which would be one code path for any model — but they route to Perplexity/Exa/Parallel, **not** Grok. Since the operator specifically wants Grok's real-time search when the bucket is on Grok, provider-native is the only path that delivers it.
- **App-level failover, not the Gateway `models` chain.** The in-call `providerOptions.gateway.models` failover would swap the model but not the matching search tool. So this bucket does an app-level retry instead: on a *transient* provider error (`timeout`/`overload`/`rate_limit`/`budget` per `classifyClaudeError`), `aiResearch` retries once on Claude + Anthropic search. Format errors (`no_object`/`truncated`) rethrow — they'd fail identically on Claude.
- **SDK multi-step + `Output.object`** replace the three hand-rolled `pause_turn` continuation loops and each surface's `submit_*` output tool + prose-JSON salvage. `stopWhen: stepCountIs(maxUses + buffer)` bounds the search loop; the model emits one schema-validated object. Each surface reuses its existing JSON schema via `jsonSchema()` and keeps all its normalization/clamping.
- Requires `@ai-sdk/anthropic` + `@ai-sdk/xai` (pinned to the **3.x** line — 4.x pulls `@ai-sdk/provider-utils@5`, which mismatches `ai@6.0.230`'s `4.0.40`).
5. **Pilot Grok** — flip `content` (guides) to `xai/grok-4.5` behind the flag, eval voice + JSON reliability, expand only where it wins. Moderation stays Claude.

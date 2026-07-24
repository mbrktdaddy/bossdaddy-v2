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

Gateway slugs use **dots** for versions, not hyphens: `anthropic/claude-sonnet-4.6`. Registry: `lib/ai/models.ts`. Verified 2026-07-20 — Anthropic from `https://ai-gateway.vercel.sh/v1/models`, Grok (`xai/grok-4.5`) from the Vercel changelog. **Before pointing production at a new slug, confirm it live via `gateway.getAvailableModels()`.**

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

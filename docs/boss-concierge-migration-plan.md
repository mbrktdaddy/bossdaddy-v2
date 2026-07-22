# Boss Concierge → AI Gateway migration plan

> Status: **IN PROGRESS** (branch `refactor/phase4-ai-concierge`). Started 2026-07-21.
> Design authority: memory `project_boss_concierge_northstar` + `project_ai_provider_layer`. This doc is the execution tracker.

The "Ask the Boss" concierge (`lib/boss/agent.ts`) is the **last raw `getClaudeClient` caller**. This migrates it onto the Vercel AI Gateway (AI SDK v6, `streamText`) as the final Phase-4 bucket, and — per the locked north star — reshapes the display protocol to accept action tools and content-first grounding.

## North star (locked)
The Boss = a **chief of staff for dads**: knows you / does things for you / answers you. **Useful-first, not product-first.** Local-content-grounded with a useful fallback and a return path. See memory `project_boss_concierge_northstar` for the full spec, query-handling flow, and display decisions.

## Sequencing
Ship the **read-only** concierge on the gateway first, built to **accept** action tools (reminders/goals) as a later chapter. Do not change transport + add write-capability at once.

## Guiding constraints (hard-won gotchas)
- `ai@6.0.230`; `@ai-sdk/anthropic` + `@ai-sdk/xai` pinned **3.x** (4.x pulls provider-utils@5, mismatches ai@6).
- **Verify with `next build`, not `tsc`** — `rm -f tsconfig.tsbuildinfo` first (stale buildinfo + tsc's export-condition resolution both lie about `lib/ai` types).
- Default model resolution stays **Claude** = behavioral parity with prod today.
- `lib/boss/entitlements.ts` seam **untouched**: everything stays free; the `plus` preset stays dormant (paid tier is a later decision — keep it possible, don't build it).

---

## The spine: split behavior from transport
Changing transport **and** the brand voice at once is the risk we've been avoiding all along. Two PRs, guarded by a shared eval net built first.

### Step 0 — Golden-prompt eval set (folds in gap B)
A small fixed set of representative prompts + expected behavior, run against the SSE endpoint (anon, no personalization needed for voice/routing/deflect checks) with heuristic assertions + human-readable output. Guards **parity** in PR 1 and **improvement** in PR 2.

Covers: a gear rec (tested pick exists), a how-to *with* a matching guide, a how-to *without* one, all **four deflect lanes** (medical / crisis / legal / financial), a mixed/vague query. Heuristic checks that survive on prose: no emoji, no markdown (`**`/`#`/`- `), third-person (no "I tested/I used"), deflect language present for deflect lanes, a grounded block present for gear queries.

Deliverables: `tests/eval/boss-eval.ts` + `vitest.eval.config.ts`, `npm run boss:eval` (invokes `runBossAgent` directly — no HTTP/rate-limit/auth/Redis; anon so research_gear is gated off and calls stay cheap). Tolerant of BOTH the old `citations` event and the new `blocks` event so it runs before and after PR 1.

**Baseline (2026-07-21, pre-migration):** 6/8 objective pass; deflects (medical/crisis/legal/financial) and routing (`search_gear`/`search_guides`) all correct. **Real finding:** ~25% of structured answers emit `**bold**`/`#`/`- ` **markdown** despite the prompt forbidding it — and the chat is `whitespace-pre-wrap`, so it renders as literal asterisks on the live site today. **Actions:** PR 1 adds render-time markdown normalization (strip `**`/`#`, convert `- ` → `• `) as a backstop in the shared renderer; PR 2 hardens the prompt's no-markdown rule. This is the parity bar PR 1 must not regress past.

### PR 1 — Faithful transport + display migration (mechanical + structural)
Keeps **today's prompt semantics** — parity, not reframe.

> **Progress (2026-07-21):** Steps 1–5 **code-complete, `next build` green, parity VERIFIED.** Step 1 shipped the strict `Block` discriminated union (`ReviewBlock|GuideBlock|ProductBlock`, `Citation` kept as a deprecated alias) + the `blocks` event. Steps 2–5 co-landed (the agent's signature change forces it): `lib/boss/agent.ts` now runs on `streamText` + `stopWhen: stepCountIs` + `prepareStep`; the `BossTool` registry converts to an AI SDK `ToolSet` centrally in the agent, with `toModelOutput` keeping blocks out of the model's context; `buildBossConciergeSystemBlocks` returns `SystemModelMessage[]`; the route passes `ModelMessage[]`/`SystemModelMessage[]`, relays `blocks`, persists blocks to the existing `citations` jsonb column. **`getClaudeClient` is no longer imported by the concierge — the migration's core goal is met.**
>
> **Model tiering** now routes ALL choices through `resolveModel('concierge', …)` lanes: everyday (Sonnet default, `AI_MODEL_CONCIERGE`), sensitive (`AI_MODEL_CONCIERGE_SENSITIVE`), and a NEW **fast lane** (Haiku default, `AI_MODEL_CONCIERGE_FAST`) for the cheap opening turn — replacing the hardcoded Haiku constant. `sensitive` is checked before `fast` so a vulnerable turn is never downgraded.
>
> **Eval: 8/8 (`npm run boss:eval`).** ⚠️ Caveat: the local key is a **free Vercel account** that gates Haiku 4.5 (403), so the run set `AI_MODEL_CONCIERGE_FAST=anthropic/claude-sonnet-4.6` locally → the opening turns ran on Sonnet. Transport/voice/routing/deflect parity is genuinely confirmed, BUT the two `**markdown**` cases pass only because Sonnet (not Haiku) served them — the markdown-emission quirk is **Haiku-specific**, and prod's first turn is Haiku, so **Step 6's render-time markdown backstop is still required.** Do NOT set `AI_MODEL_CONCIERGE_FAST` in prod (keep the Haiku cost optimization; prod's pro-team credential reaches Haiku fine).
>
> **Follow-up noted:** `SENSITIVE_HINTS` substring matching is coarse (e.g. "hurting myself" ≠ "hurt myself") so some crisis turns run the cheap lane; the 988 deflect still fires (prompt-driven). Pre-existing (old `ESCALATE_HINTS` had the same list) → PR 2 / gap G.
>
> **Step 6 (front-end) DONE (2026-07-21).** `lib/boss/normalizeText.ts` `normalizeBossText` = the markdown backstop (strip `**`/`#`, `- `/`* `→`• `; narrow, render-time only, persisted content stays raw) + **6/6 unit tests** (`tests/unit/boss-normalize.test.ts` — proves the backstop model-independently, sidestepping the free-key Haiku gate). New `BossBlocks` = the ONE shared renderer mapping the Block union → cards (grounded in tool-result order, researched grouped last; future confirm/result cards slot in here). New first-class `GuideCard` (category eyebrow + "why this helps" excerpt + read-time; `search_guides` now selects `category, reading_time_minutes`). `RecommendationCard` → review-only. `BossChat`: assistant prose normalized at render; partial-stream failure keeps streamed text + shows a separate `errorNote` line (never wipes) via `failed`/`errorNote` fields. Eval `assertVoice` now checks the NORMALIZED text (validates the backstop end-to-end). NOTE: FAB (`AskBossFab`) + embed (`AskTheBoss`) are just entry LINKS to /tools/the-boss — no chat rendering, so "consolidate across 3 surfaces" was extraction (one renderer), not de-duplication. `next build` clean · unit 6/6 · golden eval 8/8 (1 transient 180s gateway-latency timeout on medical, passed on isolated re-run).
>
> **Grounded-retrieval fix (2026-07-21, SEPARATE commit from PR 1's transport diff):** two live grounding failures surfaced by the user (both PRE-EXISTING in the tools, not migration-caused): a `category` hard-filter hid the 9.0 Gorilla swing-set (filed outdoors) behind a kids-family guess → only the 4.75 FUNLIO shown; and `websearch_to_tsquery`'s AND-semantics dropped the "Razor Rash…" guide for "how do I *prevent* razor rash" ("prevent" absent). Fix (minimal, no migration — catalog is tiny, 24 reviews/23 guides): dropped the `category` filter + param in both `search_gear`/`search_guides`; added `lib/boss/searchQuery.ts::orTsQuery` for a strict→OR-of-terms fallback. Proven via SQL against prod. +2 golden-eval regression cases (swing-set cross-category ranking, razor guide-match). `next build` clean, unit 103/103. Semantic/RPC = deferred (triggers in [[project_boss_concierge_northstar]] retrieval doctrine).
>
> **PR 1 = COMMITTED + Step 7 VERIFIED LIVE (2026-07-22).** Two commits on `refactor/phase4-ai-concierge`: `249263c` (transport + display) and `d4cb044` (grounded-retrieval fix). Live click-through on `/tools/the-boss` (local `AI_MODEL_CONCIERGE_FAST=…sonnet` override, since the free local key 403s on Haiku) confirmed: **gear** ("swing set" → Gorilla 9.0 ranked first over FUNLIO 4.75, both as `RecommendationCard`s w/ score rings + affiliate disclosure — proves the category-filter-drop live), **guide** ("razor burn" → "Razor Rash?" `GuideCard` w/ Health & Wellness eyebrow + excerpt + 5-min read — proves `orTsQuery` OR-fallback + the new card), **crisis deflect** (988 + 911, edge off, no product push, routed through the sensitive lane), streaming transport, and the `normalizeBossText` markdown backstop (• bullets, no `**`/`#`). Branch base includes current `origin/master` → **direct PR to `master`, no retarget needed.** **Then PR 2** (north-star prompt reframe + feedback loop; also folds in the coarse `SENSITIVE_HINTS` matching / gap G + the interim action-request handling).
>
> **Live UX finding for PR 2 (2026-07-22):** in grounded answers the model emits the review/buy/guide links as **raw text paths in prose** (`Review: /reviews/…`, `Buy link: /go/…`, guide URL) **and** the cards re-render the same links ("See it →" / "Read guide →"). Redundant. Canonical pattern: **prose = the conversational take, cards = the link surface.** PR 2's prompt reframe should instruct the model that the cards own the links, so prose stops emitting bare URL paths inline.

1. **Blocks protocol reshape** (gap C) — `lib/boss/types.ts`: generalize `Citation` → a `Block` union; rename the `citations` stream event → `blocks`. Renderer + persistence accept **both** old and new shapes so historical `boss_messages` render.
2. **Agent core** — `getClaudeClient().messages.stream()` → AI SDK `streamText` + `prepareStep` per-step model. Keep Haiku→Sonnet tiering; **deflect-lanes route to the sensitive Claude lane** via `resolveModel('concierge', { sensitive })`, deleting the separate `ESCALATE_HINTS` list. Iteration-cap forced synthesis = final step, tools off.
   - (gap E) Measure the per-model prompt-cache cost of switching mid-turn; decide which turns escalate.
   - (gap F) Confirm the worst chain (Haiku → tool → `research_gear` web-search → Sonnet synthesis) fits under `maxDuration = 200`.
3. **Tool conversion** — `Anthropic.Tool` → AI SDK tool via `jsonSchema(input_schema)` + `execute` wrapping `BossTool.handler`; preserve `minTier` gating, `is_error` results, blocks via the execute return.
4. **System blocks** — `buildBossConciergeSystemBlocks` → `SystemModelMessage[]` (mirror `cachedSystem`, per-block `cacheControl`, stable→volatile order). **Same text as today.**
5. **Route** — `app/api/boss/route.ts` relays `blocks` events; `persistTurn` stores blocks (reuse the `citations` jsonb column; renderer handles both shapes — no migration).
6. **Front-end** (gaps C + D) — consolidate **one shared message renderer** used by page / FAB / embed; render the block union; **first-class guide card** (title + one-line "why this helps" + category/read-time). Partial-stream failure: keep half-streamed text, append a short error line, never wipe.
7. **Verify** — `next build` clean; unit tests for model resolution + sensitive routing; run the golden set to prove **parity**; live click-through on all three surfaces.

### PR 2 — North-star prompt reframe + feedback loop (behavioral; live-validated)
8. **Rewrite `BOSS_CONCIERGE_BASE`** (gap A) — intent-first routing, **content/guides primary, gear specialized**, useful-first fallback ladder. Preserve verbatim: the four deflect lanes, third-person rule, affiliate disclosure, no-emoji, plain-text. **Also (live finding 2026-07-22):** instruct that the **cards own the links** — prose should give the conversational take and NOT re-emit bare `/reviews/…`, `/go/…`, or guide URL paths inline (they render as raw text today, duplicating the card CTAs).
9. **Feedback hook** (completes B) — wire the existing `messageId` on `done` to thumbs up/down; document the "read the last N conversations after ship" ritual. Re-run the golden set to prove improvement, not regression.
10. **Live validation** — all four deflect lanes + representative content queries before merge.

## Out of scope (tracked in memory `project_boss_concierge_northstar`)
- Action tools (next chapter — the block protocol + `minTier` are the seam).
- Return-path chip; follow-ups **G–M** (provider-swap deflect safety, gap-logging flywheel, attribution, prompt-injection hardening, free/plus split, a11y, whole-session context awareness).

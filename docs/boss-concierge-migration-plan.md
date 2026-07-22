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
8. **Rewrite `BOSS_CONCIERGE_BASE`** (gap A) — intent-first routing, **content/guides primary, gear specialized**, useful-first fallback ladder. Preserve verbatim: the four deflect lanes, third-person rule, affiliate disclosure, no-emoji, plain-text.
9. **Feedback hook** (completes B) — wire the existing `messageId` on `done` to thumbs up/down; document the "read the last N conversations after ship" ritual. Re-run the golden set to prove improvement, not regression.
10. **Live validation** — all four deflect lanes + representative content queries before merge.

## Out of scope (tracked in memory `project_boss_concierge_northstar`)
- Action tools (next chapter — the block protocol + `minTier` are the seam).
- Return-path chip; follow-ups **G–M** (provider-swap deflect safety, gap-logging flywheel, attribution, prompt-injection hardening, free/plus split, a11y, whole-session context awareness).

// Model registry for the provider-agnostic AI layer. Every entry is a Vercel AI
// Gateway slug in `provider/model` form. NOTE the gateway convention: versions
// use DOTS, not hyphens — `anthropic/claude-sonnet-4.6`, never `...-4-6`.
//
// Verified live 2026-07-27 via `gateway.getAvailableModels()` (npm run ai:smoke)
// — 300 models total; all slugs below present. Before pointing a PRODUCTION
// surface at a NEW slug, re-run that check — do not trust memory.
// (Reinforces the "verify the model against the runtime, not just a doc" rule.)
//
// ── WHY THESE ARE PINNED, AND HOW THEY STAY CURRENT ──
// The Gateway has NO floating "latest" alias — there is no `claude-sonnet-latest`
// and no routing option that resolves "newest of a family" (only `order`, `only`,
// `models`, `user`, `tags`). So a generation jump is always a deliberate edit here.
//
// Note the slugs carry no DATE, though: `anthropic/claude-sonnet-5`, not
// `...-5-20260214`. So the Gateway already abstracts snapshot-level refreshes —
// what you pin below is a GENERATION, not a snapshot.
//
// Auto-floating would be wrong for this app even if it existed: `moderation` is a
// legal/compliance gate (CLAUDE.md §3), 19 surfaces depend on generateObject
// schema adherence, and the content bucket's brand voice is tuned per model — a
// silent swap is a voice regression you'd discover in published copy.
//
// So: the DECISION is pinned here, the DETECTION is automated. `npm run ai:drift`
// (scripts/ai-model-drift.mjs, weekly in CI) reports when a family below has a
// newer generation available, or when a pinned slug has been RETIRED. You get
// told; you decide.

export const MODELS = {
  // ── Anthropic — the default provider. Trusted for the compliance gate
  //    (moderation) and the edge-off / vulnerable-topic concierge lane. ──
  claudeSonnet: 'anthropic/claude-sonnet-5',
  // NOTE: there is no `claude-haiku-5` on the Gateway — 4.5 IS the current cheap
  // Anthropic tier ($1/$5 per MTok), and the only Anthropic option for a
  // cost-sensitive lane.
  claudeHaiku: 'anthropic/claude-haiku-4.5',
  claudeOpus: 'anthropic/claude-opus-5',
  // ⚠️ TOP TIER, NOT A FAST TIER. Fable 5 is Anthropic's most capable model and
  // the most EXPENSIVE — $10/$50 per MTok, 2× Opus 5 and 10× Haiku 4.5. Do NOT
  // reach for it as a cheap/fast lane:
  //   • thinking is ALWAYS ON and cannot be disabled (`thinking.disabled` → 400),
  //     so every call pays reasoning tokens even for trivial extraction;
  //   • single turns can run minutes — wrong for interactive surfaces;
  //   • requires 30-day data retention (unavailable under ZDR);
  //   • safety classifiers can return `stop_reason: 'refusal'` (HTTP 200, empty
  //     content) — callers must branch on it before reading output.
  // Registered only so the drift checker tracks it and a future
  // hardest-reasoning surface has a named entry. Nothing points here today.
  claudeFable: 'anthropic/claude-fable-5',
  // ── xAI / Grok — opt-in second provider (per-bucket, via env). grok-4.5 is
  //    the current general model; grok-4.1-fast for cheap/low-latency turns. ──
  grok: 'xai/grok-4.5',
  grokFast: 'xai/grok-4.1-fast-non-reasoning',
} as const

export type ModelSlug = (typeof MODELS)[keyof typeof MODELS]

// A gateway slug is `provider/model`. Used to validate operator-supplied env
// overrides so a typo (e.g. `grok4`) can't silently become an invalid model.
const SLUG_RE = /^[a-z0-9-]+\/[a-z0-9.:-]+$/i

export function isValidModelSlug(s: string | undefined | null): s is string {
  return typeof s === 'string' && SLUG_RE.test(s.trim())
}

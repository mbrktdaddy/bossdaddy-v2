// Model registry for the provider-agnostic AI layer. Every entry is a Vercel AI
// Gateway slug in `provider/model` form. NOTE the gateway convention: versions
// use DOTS, not hyphens — `anthropic/claude-sonnet-4.6`, never `...-4-6`.
//
// Verified live 2026-07-20 via `gateway.getAvailableModels()` (npm run ai:smoke)
// — 295 models total; all slugs below present. Before pointing a PRODUCTION
// surface at a NEW slug, re-run that check — do not trust memory.
// (Reinforces the "verify the model against the runtime, not just a doc" rule.)

export const MODELS = {
  // ── Anthropic — the default provider. Trusted for the compliance gate
  //    (moderation) and the edge-off / vulnerable-topic concierge lane. ──
  claudeSonnet: 'anthropic/claude-sonnet-4.6',
  claudeHaiku: 'anthropic/claude-haiku-4.5',
  claudeOpus: 'anthropic/claude-opus-4.8',
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

import type { LanguageModelUsage } from 'ai'

// List prices in USD per 1M tokens, keyed by Gateway slug. Used ONLY as the
// fallback when the Gateway does not report a cost for the call — the Gateway's
// own number wins because it knows about BYOK, intro rates and per-provider
// caching rules. Anthropic cache reads bill at 10% of input, cache writes at
// 125%; the other providers here don't expose a cache split through the Gateway.
//
// Keep this in step with lib/ai/models.ts. An unknown slug returns null, never a
// guess — a wrong number on the cost chip is worse than no number.
const PRICING: Record<string, { in: number; out: number; cacheRead?: number; cacheWrite?: number }> = {
  'anthropic/claude-sonnet-5':  { in: 3, out: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  'anthropic/claude-opus-5':    { in: 5, out: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'anthropic/claude-haiku-4.5': { in: 1, out: 5,  cacheRead: 0.1, cacheWrite: 1.25 },
}

// Image models bill per token too (OpenAI Images API `usage`): text input,
// image input and image output at different rates per 1M. Rows are the
// Standard (non-batch) list prices read from developers.openai.com/api/docs/pricing
// — the gpt-image-1 family on 2026-10-23, gpt-image-2 and 2.5 on 2026-10-31.
// Cached-input rates exist (1.5: $2 image / $1.25 text) but the Images API
// `usage` reports no cached split, so they are not modelled. An unknown slug
// returns null, never a guess.
//
// Keep this in step with lib/images/tiers.ts — tests/unit/ai-image-pricing.test.ts
// fails when a pinned tier model has no row here.
const IMAGE_PRICING: Record<string, { textIn: number; imageIn: number; imageOut: number }> = {
  // CURRENT — the two models lib/images/tiers.ts pins, plus plain gpt-image-2 so an
  // ad-hoc run still prices. Verified 2026-10-31 on OpenAI's pricing page
  // ($5.00 text in / $8.00 image in / $30.00 image out per 1M); the image guide
  // states that gpt-image-2 and 2.5 share token rates.
  'openai/gpt-image-2.5-sunburst': { textIn: 5, imageIn: 8, imageOut: 30 },
  'openai/gpt-image-2.5-flare':    { textIn: 5, imageIn: 8, imageOut: 30 },
  'openai/gpt-image-2':            { textIn: 5, imageIn: 8, imageOut: 30 },
  // RETIRED — nothing calls these any more; the rows stay so historical
  // `generations` rows still price on the cost chip.
  'openai/gpt-image-1':      { textIn: 5, imageIn: 10,  imageOut: 40 }, // retired: shutdown 2026-10-23
  'openai/gpt-image-1.5':    { textIn: 5, imageIn: 8,   imageOut: 32 }, // retired: shutdown 2026-12-01
  'openai/gpt-image-1-mini': { textIn: 2, imageIn: 2.5, imageOut: 8 },  // retired: shutdown 2026-12-01
}

export interface ImageUsage {
  input_tokens?: number
  output_tokens?: number
  input_tokens_details?: { text_tokens?: number; image_tokens?: number }
}

export function estimateImageCostUsd(model: string, usage: ImageUsage | undefined): number | null {
  const p = IMAGE_PRICING[model]
  if (!p || !usage) return null
  const textIn  = usage.input_tokens_details?.text_tokens ?? usage.input_tokens ?? 0
  const imageIn = usage.input_tokens_details?.image_tokens ?? 0
  const out     = usage.output_tokens ?? 0
  const usd = (textIn / 1e6) * p.textIn + (imageIn / 1e6) * p.imageIn + (out / 1e6) * p.imageOut
  return Math.round(usd * 1e5) / 1e5
}

export function estimateCostUsd(model: string, usage: LanguageModelUsage | undefined): number | null {
  const p = PRICING[model]
  if (!p || !usage) return null
  const cacheRead  = usage.inputTokenDetails?.cacheReadTokens ?? 0
  const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0
  const input      = usage.inputTokens ?? 0
  // `inputTokens` is the total; price the cached portions at their own rates
  // and the remainder at the base input rate.
  const plainInput = Math.max(0, input - cacheRead - cacheWrite)
  const output     = usage.outputTokens ?? 0
  const usd =
    (plainInput / 1e6) * p.in +
    (cacheRead / 1e6) * (p.cacheRead ?? p.in) +
    (cacheWrite / 1e6) * (p.cacheWrite ?? p.in) +
    (output / 1e6) * p.out
  return Math.round(usd * 1e5) / 1e5
}

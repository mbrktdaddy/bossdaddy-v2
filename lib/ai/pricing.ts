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
// image input and image output at different rates per 1M. Only gpt-image-1 is
// priced here — the per-token list prices for the newer tiers were not
// verified when this shipped, and a guess on the cost chip is worse than a
// blank. Add a row once the price page has been read, not before.
const IMAGE_PRICING: Record<string, { textIn: number; imageIn: number; imageOut: number }> = {
  'openai/gpt-image-1': { textIn: 5, imageIn: 10, imageOut: 40 },
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

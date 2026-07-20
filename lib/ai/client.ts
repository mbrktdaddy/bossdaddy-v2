// Provider-agnostic AI call wrappers. Every one-shot AI call site routes through
// here so the provider is chosen in ONE place (lib/flags.ts `resolveModel`) and
// every call automatically gets:
//   • Gateway failover to Claude if the chosen provider errors / hits budget
//   • cost-attribution tags (per-surface) for the Gateway dashboard
//   • an Anthropic prompt-cache breakpoint on the system block
//
// Auth: calls route through the Vercel AI Gateway, authenticated via
// VERCEL_OIDC_TOKEN (auto on Vercel; `vercel env pull` locally) or a static
// AI_GATEWAY_API_KEY. No provider API keys are handled here.
//
// Streaming (the Boss concierge) and the web_search research surfaces are NOT
// covered by these one-shot helpers — they migrate in later phases.

import { gateway, generateObject, generateText, type ModelMessage } from 'ai'
import type { z } from 'zod'
import { resolveModel, type AiBucket } from '../flags'

interface CallBase {
  /** Purpose bucket — selects the provider/model. See lib/flags.ts. */
  bucket: AiBucket
  /** Short surface label for Gateway cost attribution, e.g. 'review-draft'. */
  tag: string
  /** Concierge only: route this turn through the sensitive / edge-off lane. */
  sensitive?: boolean
  maxOutputTokens: number
  temperature?: number
  maxRetries?: number
}

// System block with an Anthropic ephemeral cache breakpoint. Providers that
// don't support explicit caching ignore it (xAI caches automatically); the
// Gateway forwards it to Anthropic when that provider is active.
function cachedSystem(text: string) {
  return {
    role: 'system' as const,
    content: text,
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' as const } } },
  }
}

function gatewayOptions(tag: string, fallback: string[]) {
  return {
    gateway: {
      ...(fallback.length ? { models: fallback } : {}),
      tags: [`surface:${tag}`],
    },
  }
}

/**
 * One-shot structured generation. Replaces the old tool-forcing `createStructured`
 * — the AI SDK enforces the schema and validates the object, so callers get a
 * typed, validated result with no manual JSON parsing or fence-stripping.
 */
export async function aiGenerateObject<T>(
  opts: CallBase & {
    system?: string
    schema: z.ZodType<T>
    prompt?: string
    messages?: ModelMessage[]
  },
): Promise<T> {
  const { model, fallback } = resolveModel(opts.bucket, { sensitive: opts.sensitive })
  const { object } = await generateObject({
    model: gateway(model),
    schema: opts.schema,
    ...(opts.system ? { system: cachedSystem(opts.system) } : {}),
    ...(opts.messages ? { messages: opts.messages } : { prompt: opts.prompt ?? '' }),
    maxOutputTokens: opts.maxOutputTokens,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.maxRetries != null ? { maxRetries: opts.maxRetries } : {}),
    providerOptions: gatewayOptions(opts.tag, fallback),
  })
  return object
}

/** One-shot plain-text generation (moderation prose, vision alt-text, refines). */
export async function aiGenerateText(
  opts: CallBase & {
    system?: string
    prompt?: string
    messages?: ModelMessage[]
  },
): Promise<string> {
  const { model, fallback } = resolveModel(opts.bucket, { sensitive: opts.sensitive })
  const { text } = await generateText({
    model: gateway(model),
    ...(opts.system ? { system: cachedSystem(opts.system) } : {}),
    ...(opts.messages ? { messages: opts.messages } : { prompt: opts.prompt ?? '' }),
    maxOutputTokens: opts.maxOutputTokens,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.maxRetries != null ? { maxRetries: opts.maxRetries } : {}),
    providerOptions: gatewayOptions(opts.tag, fallback),
  })
  return text
}

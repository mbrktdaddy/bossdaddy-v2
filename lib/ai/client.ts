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

import { gateway, generateObject, generateText, type FlexibleSchema, type ModelMessage, type SystemModelMessage } from 'ai'
import { resolveModel, type AiBucket } from '../flags'

// A call's system prompt: either a single string (wrapped with one Anthropic
// cache breakpoint) or pre-built SystemModelMessages (multi-block voice system,
// each carrying its own breakpoint — see buildBossDaddySystemMessages).
type SystemArg = string | SystemModelMessage[]

interface CallBase {
  /** Purpose bucket — selects the provider/model. See lib/flags.ts. */
  bucket: AiBucket
  /** Short surface label for Gateway cost attribution, e.g. 'review-draft'. */
  tag: string
  /** Concierge only: route this turn through the sensitive / edge-off lane. */
  sensitive?: boolean
  /**
   * Explicit gateway model slug for a per-request tier picker (e.g. X Studio
   * repurpose's sonnet/opus toggle). Supersedes the bucket default; ignored for
   * compliance-pinned buckets. Still gets the automatic Claude fallback.
   */
  model?: string
  maxOutputTokens: number
  temperature?: number
  maxRetries?: number
}

// System block with an Anthropic ephemeral cache breakpoint. Providers that
// don't support explicit caching ignore it (xAI caches automatically); the
// Gateway forwards it to Anthropic when that provider is active.
// Exported so the research helper (lib/ai/research.ts) shares one cache-breakpoint
// convention with the one-shot wrappers.
export function cachedSystem(text: string): SystemModelMessage {
  return {
    role: 'system',
    content: text,
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  }
}

// A string gets one cache breakpoint; pre-built SystemModelMessages pass through
// unchanged (they already carry their own breakpoints).
function resolveSystem(system?: SystemArg): { system?: string | SystemModelMessage[] } {
  if (system == null) return {}
  return { system: typeof system === 'string' ? [cachedSystem(system)] : system }
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
    system?: SystemArg
    // Zod schema OR a reused JSON schema via `jsonSchema()` — the SDK validates
    // the model output against it and returns a typed, parsed object.
    schema: FlexibleSchema<T>
    prompt?: string
    messages?: ModelMessage[]
  },
): Promise<T> {
  const { model, fallback } = resolveModel(opts.bucket, { sensitive: opts.sensitive, model: opts.model })
  const { object } = await generateObject({
    model: gateway(model),
    schema: opts.schema,
    ...resolveSystem(opts.system),
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
    system?: SystemArg
    prompt?: string
    messages?: ModelMessage[]
  },
): Promise<string> {
  const { model, fallback } = resolveModel(opts.bucket, { sensitive: opts.sensitive, model: opts.model })
  const { text } = await generateText({
    model: gateway(model),
    ...resolveSystem(opts.system),
    ...(opts.messages ? { messages: opts.messages } : { prompt: opts.prompt ?? '' }),
    maxOutputTokens: opts.maxOutputTokens,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.maxRetries != null ? { maxRetries: opts.maxRetries } : {}),
    providerOptions: gatewayOptions(opts.tag, fallback),
  })
  return text
}

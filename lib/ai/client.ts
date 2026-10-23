// Provider-agnostic AI call wrappers. Every one-shot AI call site routes through
// here so the provider is chosen in ONE place (lib/flags.ts `resolveModel`) and
// every call automatically gets:
//   • Gateway failover to Claude if the chosen provider errors / hits budget
//   • cost-attribution tags (per-surface) for the Gateway dashboard
//   • an Anthropic prompt-cache breakpoint on the system block
//   • AI SDK telemetry spans (Sentry `vercelAIIntegration`), inputs/outputs OFF
//   • usage / finish reason / latency / estimated cost back to the caller, so
//     the content routes can log a `generations` row (mig 164)
//
// Auth: calls route through the Vercel AI Gateway, authenticated via
// VERCEL_OIDC_TOKEN (auto on Vercel; `vercel env pull` locally) or a static
// AI_GATEWAY_API_KEY. No provider API keys are handled here.
//
// Streaming (the Boss concierge) and the web_search research surfaces are NOT
// covered by these one-shot helpers.

import { gateway, generateObject, generateText, streamText, type FlexibleSchema, type LanguageModelUsage, type ModelMessage, type SystemModelMessage, type TelemetrySettings } from 'ai'
import { resolveModel, type AiBucket } from '../flags'
import { estimateCostUsd } from './pricing'

// A call's system prompt: either a single string (wrapped with one Anthropic
// cache breakpoint) or pre-built SystemModelMessages (multi-block voice system,
// each carrying its own breakpoint — see buildBossDaddySystemMessages).
type SystemArg = string | SystemModelMessage[]

interface CallBase {
  /** Purpose bucket — selects the provider/model. See lib/flags.ts. */
  bucket: AiBucket
  /** Short surface label for Gateway cost attribution, e.g. 'review-draft'. */
  tag: string
  /**
   * Explicit gateway model slug for a per-request tier picker (e.g. X Studio
   * repurpose's sonnet/opus toggle). Supersedes the bucket default; ignored for
   * compliance-pinned buckets. Still gets the automatic Claude fallback.
   */
  model?: string
  /**
   * Anthropic reasoning depth: 'low' | 'medium' | 'high' | 'xhigh' | 'max'.
   * Omitted = the provider default ('high'). Ignored by non-Anthropic providers.
   *
   * Measured 2026-07-27 (`npm run ai:ab-content`) on the long-form content path:
   *   • `high`  — 57–125s, no reasoning tokens spent on creative generation.
   *   • `xhigh` — Sonnet 5 spent 57% of its output budget on thinking and took
   *     194s, OVER the routes' 180s maxDuration; Opus 5 hit a hard gateway
   *     failure. Do not raise a long-form route to xhigh without re-measuring.
   * Cheap extraction lanes want 'low' — 3x faster with no quality cost.
   */
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max'
  maxOutputTokens: number
  temperature?: number
  maxRetries?: number
  /** lib/content PROMPT_VERSION, attached to the telemetry span when present. */
  promptVersion?: string
}

/** What a call cost and how it ended — the content routes persist this. */
export interface CallMeta {
  /** The resolved Gateway slug that was asked for (the failover chain may have served it). */
  model: string
  usage: LanguageModelUsage | undefined
  finishReason: string
  latencyMs: number
  /**
   * List-price estimate from lib/ai/pricing.ts (null for an unpriced slug).
   * The Gateway does not expose per-call cost in `providerMetadata` on ai@6;
   * its dashboard remains the billing truth, this is the operator's chip.
   */
  costUsd: number | null
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

// Provider options every call carries: the Gateway failover chain + cost tag, and
// (when the caller asked for one) the Anthropic reasoning-effort level. The
// `anthropic` block is inert on non-Anthropic providers, so it is safe to set on
// a bucket an operator has pointed at Grok.
function callProviderOptions(tag: string, fallback: string[], effort?: CallBase['effort']) {
  return {
    gateway: {
      ...(fallback.length ? { models: fallback } : {}),
      tags: [`surface:${tag}`],
    },
    ...(effort ? { anthropic: { effort } } : {}),
  }
}

// One span per call, named by the surface tag so Sentry groups latency and
// failures the same way the Gateway groups cost. Inputs/outputs are never
// recorded — drafts carry the author's family facts, Boss turns are private.
function telemetry(opts: CallBase): TelemetrySettings {
  return {
    isEnabled: true,
    recordInputs: false,
    recordOutputs: false,
    functionId: opts.tag,
    metadata: {
      bucket: opts.bucket,
      ...(opts.promptVersion ? { promptVersion: opts.promptVersion } : {}),
    },
  }
}

function meta(model: string, usage: LanguageModelUsage | undefined, finishReason: string, startedAt: number): CallMeta {
  return {
    model,
    usage,
    finishReason,
    latencyMs: Date.now() - startedAt,
    costUsd: estimateCostUsd(model, usage),
  }
}

/**
 * One-shot structured generation with call metadata. The AI SDK validates the
 * object against the schema — pass a Zod schema (lib/content/schemas.ts) so
 * that validation actually runs; a bare `jsonSchema()` without `validate`
 * validates nothing.
 */
export async function aiGenerateObjectWithMeta<T>(
  opts: CallBase & {
    system?: SystemArg
    schema: FlexibleSchema<T>
    prompt?: string
    messages?: ModelMessage[]
  },
): Promise<{ object: T; meta: CallMeta }> {
  const { model, fallback } = resolveModel(opts.bucket, { model: opts.model })
  const startedAt = Date.now()
  const result = await generateObject({
    model: gateway(model),
    schema: opts.schema,
    ...resolveSystem(opts.system),
    ...(opts.messages ? { messages: opts.messages } : { prompt: opts.prompt ?? '' }),
    maxOutputTokens: opts.maxOutputTokens,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.maxRetries != null ? { maxRetries: opts.maxRetries } : {}),
    providerOptions: callProviderOptions(opts.tag, fallback, opts.effort),
    experimental_telemetry: telemetry(opts),
  })
  return { object: result.object, meta: meta(model, result.usage, result.finishReason, startedAt) }
}

/** One-shot structured generation (object only). */
export async function aiGenerateObject<T>(
  opts: Parameters<typeof aiGenerateObjectWithMeta<T>>[0],
): Promise<T> {
  return (await aiGenerateObjectWithMeta<T>(opts)).object
}

/** One-shot plain-text generation with call metadata. */
export async function aiGenerateTextWithMeta(
  opts: CallBase & {
    system?: SystemArg
    prompt?: string
    messages?: ModelMessage[]
  },
): Promise<{ text: string; meta: CallMeta }> {
  const { model, fallback } = resolveModel(opts.bucket, { model: opts.model })
  const startedAt = Date.now()
  const result = await generateText({
    model: gateway(model),
    ...resolveSystem(opts.system),
    ...(opts.messages ? { messages: opts.messages } : { prompt: opts.prompt ?? '' }),
    maxOutputTokens: opts.maxOutputTokens,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.maxRetries != null ? { maxRetries: opts.maxRetries } : {}),
    providerOptions: callProviderOptions(opts.tag, fallback, opts.effort),
    experimental_telemetry: telemetry(opts),
  })
  return { text: result.text, meta: meta(model, result.usage, result.finishReason, startedAt) }
}

/** One-shot plain-text generation (moderation prose, vision alt-text, refines). */
export async function aiGenerateText(
  opts: Parameters<typeof aiGenerateTextWithMeta>[0],
): Promise<string> {
  return (await aiGenerateTextWithMeta(opts)).text
}

/**
 * Streamed plain-text generation (the staged draft's sections). Returns the
 * AI SDK stream result — call `.toTextStreamResponse()` in the route. The
 * caller's `onFinish` receives the full text + CallMeta once the stream ends
 * and is awaited by the SDK before the stream closes, so a DB write inside it
 * completes before the function is reclaimed.
 */
export function aiStreamText(
  opts: CallBase & {
    system?: SystemArg
    prompt?: string
    messages?: ModelMessage[]
    onFinish?: (result: { text: string; meta: CallMeta }) => Promise<void> | void
    onError?: (error: unknown) => void
  },
) {
  const { model, fallback } = resolveModel(opts.bucket, { model: opts.model })
  const startedAt = Date.now()
  return streamText({
    model: gateway(model),
    ...resolveSystem(opts.system),
    ...(opts.messages ? { messages: opts.messages } : { prompt: opts.prompt ?? '' }),
    maxOutputTokens: opts.maxOutputTokens,
    ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
    ...(opts.maxRetries != null ? { maxRetries: opts.maxRetries } : {}),
    providerOptions: callProviderOptions(opts.tag, fallback, opts.effort),
    experimental_telemetry: telemetry(opts),
    onFinish: async (event) => {
      await opts.onFinish?.({ text: event.text, meta: meta(model, event.totalUsage, event.finishReason, startedAt) })
    },
    onError: (event) => opts.onError?.(event.error),
  })
}

/** The metadata shape for a call that threw, so failures log like successes. */
export function failedCallMeta(bucket: AiBucket, startedAt: number, finishReason: string, model?: string): CallMeta {
  return {
    model: resolveModel(bucket, { model }).model,
    usage: undefined,
    finishReason,
    latencyMs: Date.now() - startedAt,
    costUsd: null,
  }
}

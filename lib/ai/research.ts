// The `research` bucket — the ONLY bucket that uses live web search. It backs the
// three research surfaces: specs-grade, the Boss's gap research (research_gear),
// and the X Studio trend radar.
//
// Web search is a PROVIDER-NATIVE capability, not a portable one: each provider
// ships its own search tool with its own data + freshness characteristics
// (Anthropic web search vs xAI / Grok Live Search over the real-time X firehose).
// So the search tool is dispatched by the RESOLVED provider — set
// AI_MODEL_RESEARCH to a grok slug and the whole bucket (including the Boss's
// search) automatically switches to Grok Live Search, no code change.
//
// Consequences of provider-native search:
//   • This bucket does NOT use the Gateway's in-call `models` failover chain —
//     that swaps the model but not the matching search tool. Instead we do an
//     APP-LEVEL fallback: on a transient provider error, retry once on Claude +
//     Anthropic web search (the default provider, always available).
//   • The SDK's multi-step loop (`stopWhen: stepCountIs`) replaces the hand-rolled
//     `pause_turn` continuation loops each surface used to carry.
//   • `Output.object` replaces the old `submit_*` output tool + prose-JSON salvage:
//     the model searches, then emits one schema-validated object.

import {
  gateway,
  generateText,
  Output,
  stepCountIs,
  type FlexibleSchema,
  type ModelMessage,
  type Tool,
} from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { xai } from '@ai-sdk/xai'
import { resolveModel } from '../flags'
import { classifyClaudeError } from './errors'
import { cachedSystem } from './client'

export interface ResearchSearchConfig {
  /** Anthropic: web_search max_uses. xAI: no equivalent — it self-caps, bounded by maxSteps. */
  maxUses?: number
  /** Restrict search to these domains (both providers). */
  allowedDomains?: string[]
  /** Exclude these domains (Anthropic blockedDomains / xAI excludedDomains). */
  blockedDomains?: string[]
}

// Which provider's native web-search tool a resolved gateway slug maps to. xAI
// (Grok Live Search) for `xai/*`; everything else falls back to Anthropic web
// search — the default provider, and the only one guaranteed available for the
// app-level failover. Exported for unit tests of the dispatch contract.
export function researchProviderFor(model: string): 'xai' | 'anthropic' {
  return model.startsWith('xai/') ? 'xai' : 'anthropic'
}

// Build the provider-native web-search tool that matches the resolved model. The
// key on the tools object is `web_search` for both so prompts read the same. The
// two providers' tools have different input/output generics; widen to the common
// `Tool` type so they can share one `tools` slot.
function webSearchToolFor(model: string, cfg: ResearchSearchConfig): Tool {
  if (researchProviderFor(model) === 'xai') {
    // Grok Live Search — real-time X + web. No max_uses knob; bounded by maxSteps.
    return xai.tools.webSearch({
      ...(cfg.allowedDomains ? { allowedDomains: cfg.allowedDomains } : {}),
      ...(cfg.blockedDomains ? { excludedDomains: cfg.blockedDomains } : {}),
    })
  }
  // Anthropic native web search — the default provider and the fallback provider.
  return anthropic.tools.webSearch_20260209({
    ...(cfg.maxUses != null ? { maxUses: cfg.maxUses } : {}),
    ...(cfg.allowedDomains ? { allowedDomains: cfg.allowedDomains } : {}),
    ...(cfg.blockedDomains ? { blockedDomains: cfg.blockedDomains } : {}),
  })
}

// Transient PROVIDER errors worth failing over for. A format error (no_object /
// truncated) would fail identically on Claude, so those rethrow rather than
// burn a second call.
const FALLBACK_KINDS = new Set(['timeout', 'overload', 'rate_limit', 'budget'])

export interface AiResearchResult<T> {
  /** The schema-validated structured result. */
  object: T
  /** The model that actually produced the result (differs from the primary after a fallback). */
  model: string
  /** Grounding URLs the search tool surfaced (best-effort; surfaces also keep the model-emitted sources in `object`). */
  sources: { title: string | null; url: string }[]
}

/**
 * One live-web-search research call: search with the resolved provider's native
 * tool, then return one schema-validated object. Provider-native + app-level
 * Claude fallback on transient outages.
 */
export async function aiResearch<T>(opts: {
  /** Short surface label for Gateway cost attribution, e.g. 'specs-grade'. */
  tag: string
  system: string
  prompt?: string
  messages?: ModelMessage[]
  /** Zod schema or a reused JSON schema via `jsonSchema()`; the SDK validates the output. */
  schema: FlexibleSchema<T>
  /** Max steps the SDK allows before forcing the final object (search steps + reasoning + the output step). */
  maxSteps: number
  search?: ResearchSearchConfig
  maxOutputTokens: number
  temperature?: number
  maxRetries?: number
  /** Per-call wall-clock cap (ms) — radar bounds this tightly under the cron cap. */
  timeout?: number
}): Promise<AiResearchResult<T>> {
  const { model, fallback } = resolveModel('research')
  const search = opts.search ?? {}

  const run = async (m: string): Promise<AiResearchResult<T>> => {
    const { output, sources } = await generateText({
      model: gateway(m),
      tools: { web_search: webSearchToolFor(m, search) },
      output: Output.object({ schema: opts.schema }),
      stopWhen: stepCountIs(opts.maxSteps),
      system: [cachedSystem(opts.system)],
      ...(opts.messages ? { messages: opts.messages } : { prompt: opts.prompt ?? '' }),
      maxOutputTokens: opts.maxOutputTokens,
      ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      ...(opts.maxRetries != null ? { maxRetries: opts.maxRetries } : {}),
      ...(opts.timeout != null ? { timeout: opts.timeout } : {}),
      providerOptions: { gateway: { tags: [`surface:${opts.tag}`] } },
    })
    return {
      object: output as T,
      model: m,
      sources: (sources ?? [])
        .filter((s): s is Extract<typeof s, { sourceType: 'url' }> => s.sourceType === 'url')
        .map((s) => ({ title: s.title ?? null, url: s.url }))
        .filter((s) => s.url),
    }
  }

  try {
    return await run(model)
  } catch (err) {
    // App-level failover: retry once on Claude + Anthropic search for a transient
    // provider error. `fallback` is non-empty only when the primary wasn't Claude.
    const { kind, detail } = classifyClaudeError(err)
    if (fallback.length && FALLBACK_KINDS.has(kind)) {
      console.warn(`aiResearch[${opts.tag}]: ${model} failed (${kind}: ${detail}) — falling back to ${fallback[0]}`)
      return await run(fallback[0])
    }
    throw err
  }
}

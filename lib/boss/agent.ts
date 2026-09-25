import { gateway, streamText, type ModelMessage, type SystemModelMessage, type ToolSet } from 'ai'
import { xai } from '@ai-sdk/xai'
import { resolveModel } from '@/lib/flags'
import { MODELS } from '@/lib/ai/models'
import { BOSS_SEARCH_RULES } from './prompt'
import { EXCLUDED_WEB_DOMAINS, EXCLUDED_X_HANDLES, MAX_SOURCES, toSourceBlock } from './sources'
import type { BossStreamEvent, SourceBlock } from './types'

// Room for a real artifact (a toast, a weekend plan, a tough-talk script) without
// tripping the "ran long" cutoff on ordinary answers. Only billed when used.
const MAX_TOKENS = 4096
// Conversational lane: warm and varied, not a deterministic extraction.
const TEMPERATURE = 0.7
const CONCIERGE_TAG = 'boss-concierge'
// grok-4.7 on a search question, measured 2026-09-25: default ≈ 33s / $0.25,
// low ≈ 21s / $0.15 with the same answer quality. 'none' is rejected (400).
const XAI_REASONING_EFFORT = 'low'
const SNAG = 'The Boss hit a snag. Give it another shot in a sec.'

// The Boss is a general-purpose assistant in the Boss Daddy voice: one streamed
// call per turn. On an xAI model it gets xAI's server-side web_search + x_search
// (executed by xAI through the Gateway — no loop code here); on any other model
// it runs tool-less. The site-content tools (gear/guide search, goal logging)
// were retired 2026-09-24 — restore from the `boss-concierge-tools-v1` git tag.
//
// Yields BossStreamEvents the API route relays as SSE. `messageId` on `done` is
// filled by the route after it persists.
export async function* runBossAgent(opts: {
  system: SystemModelMessage[]
  messages: ModelMessage[]
}): AsyncGenerator<BossStreamEvent> {
  const { model, fallback } = resolveModel('concierge')
  const search = model.startsWith('xai/')

  let outcome = yield* streamTurn({
    model,
    system: search ? withSearchRules(opts.system) : opts.system,
    messages: opts.messages,
    tools: search ? searchTools() : undefined,
    // Gateway failover would hand xAI's tools to Claude, so with search on the
    // Claude backup is done below instead, tool-less.
    fallback: search ? [] : fallback,
  })

  if (!outcome.ok && !outcome.wroteText && search) {
    yield { type: 'notice', message: 'Live search is down right now, so this answer is from general knowledge.' }
    outcome = yield* streamTurn({ model: MODELS.claudeSonnet, system: opts.system, messages: opts.messages, fallback: [] })
  }

  if (!outcome.ok) {
    yield { type: 'error', message: outcome.wroteText ? 'The Boss got cut off. Give it another shot.' : SNAG }
    return
  }
  // A length cutoff still ends in `done`: the partial answer streamed and is
  // worth keeping, so the route saves the turn and the chat shows it with a note.
  if (outcome.ranLong) {
    yield { type: 'error', message: 'That answer ran long — ask for a shorter take or narrow it down.' }
  }
  yield { type: 'done', messageId: null, conversationId: null }
}

function searchTools(): ToolSet {
  return {
    web_search: xai.tools.webSearch(EXCLUDED_WEB_DOMAINS.length ? { excludedDomains: EXCLUDED_WEB_DOMAINS } : {}),
    x_search: xai.tools.xSearch(EXCLUDED_X_HANDLES.length ? { excludedXHandles: EXCLUDED_X_HANDLES } : {}),
  }
}

// Right after the cached base prompt, ahead of the per-day / per-member blocks,
// so the stable prefix stays cacheable.
function withSearchRules(system: SystemModelMessage[]): SystemModelMessage[] {
  const [base, ...rest] = system
  return [base, { role: 'system', content: BOSS_SEARCH_RULES }, ...rest]
}

type Outcome = { ok: boolean; wroteText: boolean; ranLong: boolean }

async function* streamTurn(args: {
  model: string
  system: SystemModelMessage[]
  messages: ModelMessage[]
  tools?: ToolSet
  fallback: string[]
}): AsyncGenerator<BossStreamEvent, Outcome> {
  const sources = new Map<string, SourceBlock>()
  let wroteText = false
  let ranLong = false

  try {
    const result = streamText({
      model: gateway(args.model),
      system: args.system,
      messages: args.messages,
      tools: args.tools,
      maxOutputTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      providerOptions: {
        gateway: {
          tags: [`surface:${CONCIERGE_TAG}`],
          ...(args.fallback.length ? { models: args.fallback } : {}),
        },
        ...(args.model.startsWith('xai/') ? { xai: { reasoningEffort: XAI_REASONING_EFFORT } } : {}),
      },
    })

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'reasoning-start':
          if (!wroteText) yield { type: 'status', status: 'thinking' }
          break
        case 'tool-input-start':
          if (!wroteText) yield { type: 'status', status: part.toolName === 'x_search' ? 'searching-x' : 'searching-web' }
          break
        case 'source':
          if (part.sourceType === 'url') {
            const block = toSourceBlock(part.url, part.title)
            if (block && !sources.has(block.slug)) sources.set(block.slug, block)
          }
          break
        case 'text-delta':
          if (part.text) {
            wroteText = true
            yield { type: 'text', delta: part.text }
          }
          break
        case 'finish':
          if (part.finishReason === 'length') ranLong = true
          break
        case 'error':
          return { ok: false, wroteText, ranLong }
      }
    }
  } catch {
    return { ok: false, wroteText, ranLong }
  }

  if (sources.size) yield { type: 'sources', sources: [...sources.values()].slice(0, MAX_SOURCES) }
  return { ok: true, wroteText, ranLong }
}

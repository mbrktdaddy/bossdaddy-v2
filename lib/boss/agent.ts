import { gateway, streamText, type ModelMessage, type SystemModelMessage } from 'ai'
import { resolveModel } from '@/lib/flags'
import type { BossStreamEvent } from './types'

// Room for a real artifact (a toast, a weekend plan, a tough-talk script) without
// tripping the "ran long" cutoff on ordinary answers. Only billed when used.
const MAX_TOKENS = 4096
// Conversational lane: warm and varied, not a deterministic extraction.
const TEMPERATURE = 0.7
const CONCIERGE_TAG = 'boss-concierge'

// The Boss is a general-purpose assistant in the Boss Daddy voice: one streamed
// model call per turn, no tools. The site-content tools (gear/guide search, web
// research, goal logging) were retired 2026-09-24 until the content library can
// carry them — restore from the `boss-concierge-tools-v1` git tag. Safety on
// medical / legal / financial / crisis topics is the model's own behavior; the
// brand-tone layer (edge off for struggle) lives in the prompt.
//
// Yields BossStreamEvents the API route relays as SSE. `messageId` on `done` is
// filled by the route after it persists.
export async function* runBossAgent(opts: {
  system: SystemModelMessage[]
  messages: ModelMessage[]
}): AsyncGenerator<BossStreamEvent> {
  // Empty when the concierge model is Claude; → Claude when an operator points
  // the bucket at another provider.
  const { model, fallback } = resolveModel('concierge')

  let ranLong = false
  try {
    const result = streamText({
      model: gateway(model),
      system: opts.system,
      messages: opts.messages,
      maxOutputTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      providerOptions: {
        gateway: {
          tags: [`surface:${CONCIERGE_TAG}`],
          ...(fallback.length ? { models: fallback } : {}),
        },
      },
    })

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          if (part.text) yield { type: 'text', delta: part.text }
          break
        case 'finish':
          if (part.finishReason === 'length') ranLong = true
          break
        case 'error':
          yield { type: 'error', message: 'The Boss hit a snag. Give it another shot in a sec.' }
          return
      }
    }
  } catch {
    yield { type: 'error', message: 'The Boss hit a snag. Give it another shot in a sec.' }
    return
  }

  // A length cutoff still ends in `done`: the partial answer streamed and is
  // worth keeping, so the route saves the turn and the chat shows it with a note.
  if (ranLong) {
    yield { type: 'error', message: 'That answer ran long — ask for a shorter take or narrow it down.' }
  }
  yield { type: 'done', messageId: null, conversationId: null }
}

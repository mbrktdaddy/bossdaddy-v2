import Anthropic from '@anthropic-ai/sdk'
import { getClaudeClient, MODEL, HAIKU_MODEL } from '@/lib/claude/client'
import type { BossStreamEvent, BossTool, Citation, ToolContext } from './types'
import { tierAtLeast } from './entitlements'

type SystemParam = Anthropic.Messages.MessageCreateParams['system']

const MAX_TOKENS = 2048

// Pre-filter keywords that route a first turn straight to Sonnet — these are the
// deflect lanes (medical / crisis / legal / financial) where a careful, on-brand
// redirect matters more than saving tokens.
const ESCALATE_HINTS = [
  'suicid', 'kill myself', 'self-harm', 'self harm', 'hurt myself', 'overdose',
  'diagnos', 'symptom', 'prescri', 'dosage', 'medication',
  'custody', 'divorce', 'lawsuit', ' sue ', 'attorney',
  'invest', 'stocks', 'crypto', ' tax ', 'taxes',
]

// Haiku-first cost control. Escalate to Sonnet when reasoning quality matters:
// after a tool round-trip (ranking/synthesis), for long prompts, or deflect lanes.
export function chooseModel(state: {
  latestUserText: string
  iteration: number
  policy: 'haiku-first' | 'sonnet-priority'
}): string {
  if (state.policy === 'sonnet-priority') return MODEL
  if (state.iteration > 0) return MODEL
  const t = state.latestUserText.toLowerCase()
  if (state.latestUserText.length > 600) return MODEL
  if (ESCALATE_HINTS.some((k) => t.includes(k))) return MODEL
  return HAIKU_MODEL
}

// The streaming multi-tool loop. Yields BossStreamEvents the API route relays as
// SSE. Terminates on end_turn, on the iteration cap (forces a final tool-less
// synthesis), or on error. `messageId` on `done` is filled by the route after it
// persists the assistant turn.
export async function* runBossAgent(opts: {
  system: SystemParam
  messages: Anthropic.Messages.MessageParam[]
  tools: BossTool[]
  ctx: ToolContext
  maxIterations?: number
}): AsyncGenerator<BossStreamEvent> {
  const { system, ctx } = opts
  const maxIterations = opts.maxIterations ?? ctx.entitlements.maxIterations
  const messages = [...opts.messages]
  const toolDefs = opts.tools.map((t) => t.definition)
  const toolMap = new Map(opts.tools.map((t) => [t.definition.name, t]))
  const latestUserText = extractLatestUserText(messages)

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const model = chooseModel({ latestUserText, iteration, policy: ctx.entitlements.modelPolicy })
    let final: Anthropic.Messages.Message
    try {
      const stream = getClaudeClient().messages.stream({
        model,
        max_tokens: MAX_TOKENS,
        system,
        tools: toolDefs,
        messages,
      })
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          yield { type: 'text', delta: event.delta.text }
        }
      }
      final = await stream.finalMessage()
    } catch {
      yield { type: 'error', message: 'The Boss hit a snag. Give it another shot in a sec.' }
      return
    }

    if (final.stop_reason === 'max_tokens') {
      yield { type: 'error', message: 'That answer ran long — ask for a shorter take or narrow it down.' }
      return
    }

    messages.push({ role: 'assistant', content: final.content })

    if (final.stop_reason === 'tool_use') {
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
      const citations: Citation[] = []
      for (const block of final.content) {
        if (block.type !== 'tool_use') continue
        yield { type: 'tool_start', name: block.name }
        const tool = toolMap.get(block.name)
        if (!tool) {
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Unknown tool.', is_error: true })
          continue
        }
        const need = tool.minTier ?? 'anon'
        if (!tierAtLeast(ctx.entitlements.tier, need)) {
          const ask = !ctx.userId
            ? 'Ask them to sign in or create a free account first.'
            : 'That capability is part of Boss+ — invite them to upgrade.'
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `This action isn't available on the user's current plan. ${ask}`,
          })
          continue
        }
        try {
          const result = await tool.handler(block.input as Record<string, unknown>, ctx)
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result.content })
          if (result.citations?.length) citations.push(...result.citations)
        } catch {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: 'That lookup failed — tell the user you could not check the vault right now.',
            is_error: true,
          })
        }
      }
      if (citations.length) yield { type: 'citations', items: citations }
      messages.push({ role: 'user', content: toolResults })
      continue
    }

    yield { type: 'done', messageId: null, conversationId: null }
    return
  }

  // Iteration cap hit — force one final, tool-less synthesis so we never leave
  // the user mid-loop with no answer.
  try {
    const stream = getClaudeClient().messages.stream({ model: MODEL, max_tokens: 1024, system, messages })
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', delta: event.delta.text }
      }
    }
  } catch {
    yield { type: 'error', message: 'The Boss hit a snag. Give it another shot in a sec.' }
    return
  }
  yield { type: 'done', messageId: null, conversationId: null }
}

function extractLatestUserText(messages: Anthropic.Messages.MessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user') continue
    if (typeof m.content === 'string') return m.content
    const text = m.content
      .filter((b): b is Anthropic.Messages.TextBlockParam => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
    if (text) return text
  }
  return ''
}

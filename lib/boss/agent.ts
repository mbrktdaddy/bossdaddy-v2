import {
  gateway,
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type JSONSchema7,
  type ModelMessage,
  type SystemModelMessage,
  type ToolSet,
} from 'ai'
import { resolveModel } from '@/lib/flags'
import type { Block, BossStreamEvent, BossTool, ToolContext } from './types'
import { tierAtLeast } from './entitlements'

const MAX_TOKENS = 2048
const CONCIERGE_TAG = 'boss-concierge'

// First-turn patterns that route to the edge-off SENSITIVE Claude lane (loss,
// self-harm, medical, legal, financial). These are exactly the four deflect lanes,
// where a careful on-brand redirect matters more than saving tokens — so a match
// resolves the sensitive lane via resolveModel('concierge', { sensitive: true })
// (defaults to Claude, operator-overridable independently — see lib/flags.ts).
//
// gap G: matching is word-boundary / stem-based and deliberately tuned to
// OVER-match (safe-default-up). The old substring list under-matched — 'hurt
// myself' missed "hurting myself", and ' sue ' (space-padded) missed "sue him"
// and sentence-final "sue." A false positive just runs a benign turn on the
// careful Claude lane (a little pricier, edge-off tone); a false negative runs a
// genuine crisis/medical/legal/financial turn on the cheap fast lane. The first
// is cheap insurance; the second is the failure that matters. So stems match
// inflections (suicid → suicidal/suicide, invest → investing/investment) and
// single words use \b, not surrounding spaces.
const SENSITIVE_PATTERNS: RegExp[] = [
  // Mental-health crisis / self-harm
  /\bsuicid/,
  /\bself[-\s]?harm/,
  /\bkill(?:ing)?\s+myself\b/,
  /\bhurt\w*\s+myself\b/,
  /\bend(?:ing)?\s+(?:it all|my life)\b/,
  /\boverdos/,
  // Medical
  /\bdiagnos/,
  /\bsymptom/,
  /\bprescri/,
  /\bdosag|\bdosing\b/,
  /\bmedication/,
  // Legal
  /\bcustod/,
  /\bdivorc/,
  /\blawsuit/,
  /\bsue\b|\bsuing\b/,
  /\battorney/,
  /\blawyer/,
  // Financial / investment / tax
  /\binvest/,
  /\bstocks?\b/,
  /\bcrypto/,
  /\btax(?:es|ed)?\b/,
]

export function isSensitive(text: string): boolean {
  const t = text.toLowerCase()
  return SENSITIVE_PATTERNS.some((re) => re.test(t))
}

// Per-step model, all resolved through the concierge bucket's lanes (lib/flags.ts):
//   • sensitive turns → the edge-off sensitive lane;
//   • reasoning-heavy turns (after a tool round, long prompts) + the paid
//     sonnet-priority policy → the everyday lane (Sonnet default, AI_MODEL_CONCIERGE);
//   • the cheap opening turn → the fast lane (Haiku default, AI_MODEL_CONCIERGE_FAST).
//
// gap E: the fast lane is Haiku by default. In the all-Claude config this stays
// same-provider (Haiku → everyday Sonnet) and prompt-cache-friendly. An operator
// can retune the fast lane independently via AI_MODEL_CONCIERGE_FAST.
function modelForStep(state: {
  stepNumber: number
  sensitive: boolean
  latestUserText: string
  policy: 'haiku-first' | 'sonnet-priority'
}): string {
  if (state.sensitive) return resolveModel('concierge', { sensitive: true }).model
  if (state.policy === 'sonnet-priority') return resolveModel('concierge').model
  if (state.stepNumber > 0) return resolveModel('concierge').model
  if (state.latestUserText.length > 600) return resolveModel('concierge').model
  return resolveModel('concierge', { fast: true }).model
}

// Convert the read-only BossTool registry into an AI SDK ToolSet bound to this
// turn's context. The model-facing tool result is the compact `content` string
// (via toModelOutput); the structured `blocks` ride along on the raw execute
// return and are read off the `tool-result` stream part for the client — so
// blocks never bloat the model's context. minTier gating and handler failures
// resolve to a narratable string (never a throw) so the loop degrades gracefully.
function buildToolSet(bossTools: BossTool[], ctx: ToolContext): ToolSet {
  const set: ToolSet = {}
  for (const bt of bossTools) {
    const def = bt.definition
    const need = bt.minTier ?? 'anon'
    set[def.name] = tool({
      description: def.description,
      inputSchema: jsonSchema(def.input_schema as unknown as JSONSchema7),
      execute: async (input): Promise<{ content: string; blocks: Block[] }> => {
        if (!tierAtLeast(ctx.entitlements.tier, need)) {
          const ask = !ctx.userId
            ? 'Ask them to sign in or create a free account first.'
            : 'That capability is part of Boss+ — invite them to upgrade.'
          return { content: `This action isn't available on the user's current plan. ${ask}`, blocks: [] }
        }
        try {
          const result = await bt.handler(input as Record<string, unknown>, ctx)
          return { content: result.content, blocks: result.citations ?? [] }
        } catch {
          return { content: 'That lookup failed — tell the user you could not check the vault right now.', blocks: [] }
        }
      },
      // The model only needs the compact content; blocks are client-only.
      toModelOutput: ({ output }) => ({ type: 'text', value: (output as { content: string }).content }),
    })
  }
  return set
}

// The streaming multi-tool loop, on the AI SDK / Gateway. Yields BossStreamEvents
// the API route relays as SSE. The SDK runs the agentic loop (tool call → execute
// → feed result → next step); `stopWhen` caps it and `prepareStep` picks the model
// per step and forces a tool-less final synthesis so a turn never ends on a bare
// tool result. `messageId` on `done` is filled by the route after it persists.
export async function* runBossAgent(opts: {
  system: SystemModelMessage[]
  messages: ModelMessage[]
  tools: BossTool[]
  ctx: ToolContext
  maxIterations?: number
}): AsyncGenerator<BossStreamEvent> {
  const { system, ctx } = opts
  const maxIterations = opts.maxIterations ?? ctx.entitlements.maxIterations
  // One extra step past the tool-round budget is reserved for the forced synthesis.
  const maxSteps = maxIterations + 1
  const toolSet = buildToolSet(opts.tools, ctx)
  const latestUserText = extractLatestUserText(opts.messages)
  const sensitive = isSensitive(latestUserText)
  const policy = ctx.entitlements.modelPolicy

  const pick = (stepNumber: number) =>
    gateway(modelForStep({ stepNumber, sensitive, latestUserText, policy }))

  // Everyday fallback chain — empty when the concierge model is Claude (parity),
  // populated (→ Claude) only when an operator opts the bucket onto another provider.
  const { fallback } = resolveModel('concierge', { sensitive })

  let ranLong = false
  try {
    const result = streamText({
      model: pick(0),
      system,
      messages: opts.messages,
      tools: toolSet,
      stopWhen: stepCountIs(maxSteps),
      maxOutputTokens: MAX_TOKENS,
      prepareStep: ({ stepNumber }) =>
        stepNumber >= maxSteps - 1
          ? { model: pick(stepNumber), toolChoice: 'none' } // final step: force synthesis
          : { model: pick(stepNumber) },
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
        case 'tool-call':
          yield { type: 'tool_start', name: part.toolName }
          break
        case 'tool-result': {
          const blocks = (part.output as { blocks?: Block[] } | undefined)?.blocks
          if (blocks?.length) yield { type: 'blocks', items: blocks }
          break
        }
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

  if (ranLong) {
    yield { type: 'error', message: 'That answer ran long — ask for a shorter take or narrow it down.' }
    return
  }
  yield { type: 'done', messageId: null, conversationId: null }
}

function extractLatestUserText(messages: ModelMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role !== 'user') continue
    if (typeof m.content === 'string') return m.content
    const text = m.content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join(' ')
    if (text) return text
  }
  return ''
}

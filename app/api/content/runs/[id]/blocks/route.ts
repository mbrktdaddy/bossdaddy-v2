import { NextResponse, type NextRequest } from 'next/server'
import { aiGenerateObjectWithMeta, failedCallMeta } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { buildBossDaddySystemMessages } from '@/lib/voiceProfile'
import { fetchTagVocabulary } from '@/lib/claude/tag-vocab'
import { logGeneration } from '@/lib/content/generations'
import { PROMPT_VERSION, validateSuggestedTags } from '@/lib/content/prompts'
import { blocksOutput, blocksPrompt } from '@/lib/content/pipeline/blocks'
import { normalizeElement, type ContentElement, type ElementDraftOutputT } from '@/lib/content/elements'
import { updateRun } from '@/lib/content/pipeline/run'
import { loadOwnedRun, rateLimited, requireStage } from '@/lib/content/pipeline/route-helpers'
import type { Blocks } from '@/lib/content/pipeline/types'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 90

// Stage 3 — the structured blocks, derived from the finished prose.
const EFFORT = 'medium' as const
const TEMPERATURE = 0.5

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadOwnedRun(id)
  if ('error' in ctx) return ctx.error
  const { supabase, userId, run } = ctx

  // Re-runnable from any later stage (the author wants fresh blocks).
  const stageErr = requireStage(run, ['blocks', 'critic', 'images', 'done'])
  if (stageErr) return stageErr
  if (!run.outline) return NextResponse.json({ error: 'No outline' }, { status: 409 })

  const { success } = await checkRateLimit(`draft-blocks:${userId}`, 'draft-blocks')
  if (!success) return rateLimited()

  const vocab = await fetchTagVocabulary(supabase)
  const prompt = blocksPrompt(run, vocab)
  const system = await buildBossDaddySystemMessages(supabase, userId)
  const schema = blocksOutput(run.outline.blocks, run.contentType, run.outline.elements ?? [])
  const startedAt = Date.now()

  try {
    const { object, meta } = await aiGenerateObjectWithMeta<Blocks>({
      bucket: 'content',
      tag: 'draft-blocks',
      schema,
      system,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 3000,
      effort: EFFORT,
      temperature: TEMPERATURE,
      maxRetries: 2,
      promptVersion: PROMPT_VERSION,
    })
    // The model's element drafts are the flat ElementDraftOutput shape; keep only the ones that hold up.
    const rawElements = (object as unknown as { elements?: ElementDraftOutputT[] }).elements ?? []
    const elements = rawElements.map(normalizeElement).filter((e): e is ContentElement => e != null)
    const blocks: Blocks = {
      ...object,
      ...(elements.length ? { elements } : { elements: undefined }),
      suggestedTags: await validateSuggestedTags(supabase, object.suggestedTags),
    }
    await logGeneration(supabase, {
      userId, contentType: run.contentType, runId: run.id, stage: 'blocks', status: 'done',
      meta, effort: EFFORT, temperature: TEMPERATURE, input: { choices: run.outline.blocks, prompt }, output: blocks,
    })
    const next = await updateRun(supabase, run, { blocks, status: 'critic', error: null }, meta.costUsd ?? 0)
    return NextResponse.json({ run: next })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('draft-blocks error:', c.kind, '-', c.detail)
    await logGeneration(supabase, {
      userId, contentType: run.contentType, runId: run.id, stage: 'blocks',
      status: c.kind === 'truncated' ? 'truncated' : 'failed',
      meta: failedCallMeta('content', startedAt, c.kind), effort: EFFORT, temperature: TEMPERATURE,
      input: { choices: run.outline.blocks, prompt },
    })
    await updateRun(supabase, run, { error: c.userMessage }).catch(() => {})
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}

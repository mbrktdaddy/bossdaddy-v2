import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { aiGenerateObjectWithMeta, failedCallMeta } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { MODELS } from '@/lib/ai/models'
import { checkRateLimit } from '@/lib/rate-limit'
import { logGeneration } from '@/lib/content/generations'
import { BriefInput, briefSubject, normalizeBrief } from '@/lib/content/pipeline/briefs'
import { DISTILL_SYSTEM, DistillOutput, distillPrompt, firsthandSource, normalizeDistilled, type DistillModelOutput } from '@/lib/content/pipeline/distill'
import { rateLimited, requireAuthor } from '@/lib/content/pipeline/route-helpers'

// The brief step — docs/content-pipeline-plan.md §4a.
//   POST /api/content/distill { brief } → { facts, gaps, asides, skipped, costUsd }
//
// Runs from the wizard between the idea step and the run: the raw notes become
// clean facts and the gaps the author answers before anything is drafted. No
// run exists yet, so the call is a `brief` row in `generations` without a run
// id. A brief with no firsthand material skips the call (skipped: true).

export const maxDuration = 60
const TEMPERATURE = 0.3
const EFFORT = 'low' as const

const Input = z.object({ brief: BriefInput })

export async function POST(request: NextRequest) {
  const auth = await requireAuthor()
  if ('error' in auth) return auth.error
  const { supabase, userId } = auth

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid brief', details: parsed.error.flatten() }, { status: 400 })
  }
  const brief = normalizeBrief(parsed.data.brief)
  const source = firsthandSource(brief)
  if (!source.trim()) return NextResponse.json({ facts: [], gaps: [], asides: [], skipped: true, costUsd: null })

  const { success } = await checkRateLimit(`distill:${userId}`, 'distill')
  if (!success) return rateLimited()

  const prompt = distillPrompt(brief)
  const startedAt = Date.now()
  try {
    const { object, meta } = await aiGenerateObjectWithMeta<DistillModelOutput>({
      // An editor's task — judgement about what a reader needs — so Sonnet, not the utility default.
      bucket: 'utility', model: MODELS.claudeSonnet, tag: 'brief-distill', schema: DistillOutput, system: DISTILL_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 4000, effort: EFFORT, temperature: TEMPERATURE, maxRetries: 1,
    })
    const distilled = normalizeDistilled(object)
    await logGeneration(supabase, {
      userId, contentType: brief.contentType, stage: 'brief', status: 'done', meta, effort: EFFORT, temperature: TEMPERATURE,
      input: { subject: briefSubject(brief), chars: source.length, prompt }, output: object,
    })
    return NextResponse.json({ ...distilled, skipped: false, costUsd: meta.costUsd ?? null })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('brief-distill error:', c.kind, '-', c.detail)
    await logGeneration(supabase, {
      userId, contentType: brief.contentType, stage: 'brief', status: c.kind === 'truncated' ? 'truncated' : 'failed',
      meta: failedCallMeta('utility', startedAt, c.kind, MODELS.claudeSonnet, c.usage), effort: EFFORT, temperature: TEMPERATURE,
      input: { subject: briefSubject(brief), chars: source.length },
    }).catch(() => {})
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}

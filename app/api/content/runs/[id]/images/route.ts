import { NextResponse, type NextRequest } from 'next/server'
import { aiGenerateObjectWithMeta, failedCallMeta } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { MODELS } from '@/lib/ai/models'
import { logGeneration } from '@/lib/content/generations'
import { PROMPT_VERSION } from '@/lib/content/prompts'
import { ImagesOutput, imagesPrompt, validateImagePlan, type ImagesModelOutput } from '@/lib/content/pipeline/images'
import { updateRun } from '@/lib/content/pipeline/run'
import { loadOwnedRun, rateLimited, requireStage } from '@/lib/content/pipeline/route-helpers'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

// Stage 5 — image placements from the finished prose (Haiku; subject only, the
// house style is applied at generation time).
const EFFORT = 'low' as const
const TEMPERATURE = 0.7

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadOwnedRun(id)
  if ('error' in ctx) return ctx.error
  const { supabase, userId, run } = ctx

  const stageErr = requireStage(run, ['images', 'done'])
  if (stageErr) return stageErr
  if (!run.outline) return NextResponse.json({ error: 'No outline' }, { status: 409 })

  const { success } = await checkRateLimit(`draft-images:${userId}`, 'draft-images')
  if (!success) return rateLimited()

  const prompt = imagesPrompt(run)
  const startedAt = Date.now()
  try {
    const { object, meta } = await aiGenerateObjectWithMeta<ImagesModelOutput>({
      bucket: 'content',
      model: MODELS.claudeHaiku,
      tag: 'draft-images',
      schema: ImagesOutput,
      system: 'You plan editorial photography for Boss Daddy (BossDaddyLife.com), a dad-focused gear and life site. Scenes, never product replicas; no people, no text, no logos.',
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 1500,
      effort: EFFORT,
      temperature: TEMPERATURE,
      maxRetries: 2,
      promptVersion: PROMPT_VERSION,
    })
    const images = validateImagePlan(object, run.outline.parts, run.outline.imageCount)
    await logGeneration(supabase, {
      userId, contentType: run.contentType, runId: run.id, stage: 'images', status: 'done',
      meta, effort: EFFORT, temperature: TEMPERATURE, input: { imageCount: run.outline.imageCount, prompt }, output: images,
    })
    const next = await updateRun(supabase, run, { images, status: 'done', error: null }, meta.costUsd ?? 0)
    return NextResponse.json({ run: next })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('draft-images error:', c.kind, '-', c.detail)
    await logGeneration(supabase, {
      userId, contentType: run.contentType, runId: run.id, stage: 'images',
      status: c.kind === 'truncated' ? 'truncated' : 'failed',
      meta: failedCallMeta('content', startedAt, c.kind, MODELS.claudeHaiku), effort: EFFORT, temperature: TEMPERATURE,
      input: { prompt },
    })
    await updateRun(supabase, run, { error: c.userMessage }).catch(() => {})
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}

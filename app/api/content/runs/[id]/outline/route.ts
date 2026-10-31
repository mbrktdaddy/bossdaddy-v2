import { NextResponse, type NextRequest } from 'next/server'
import { aiGenerateObjectWithMeta, failedCallMeta } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { buildBossDaddySystemMessages } from '@/lib/voiceProfile'
import { logGeneration } from '@/lib/content/generations'
import { PROMPT_VERSION } from '@/lib/content/prompts'
import { OutlineEdit, OutlineOutput, assignProductTokens, buildOutline, normalizeElementPlans, outlinePrompt, validateOutlineShape, type OutlineModelOutput } from '@/lib/content/pipeline/outline'
import { findRelated } from '@/lib/content/pipeline/related'
import { updateRun } from '@/lib/content/pipeline/run'
import { loadOwnedRun, rateLimited, requireStage } from '@/lib/content/pipeline/route-helpers'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 60

// Stage 1 — POST generates the outline (content-bucket model at effort high —
// the outline is where the argument is decided, 2026-10-30); PUT saves the
// author's edited outline and opens drafting. The author ALWAYS passes through
// PUT: the outline is the contract the sections are written against.

const EFFORT = 'high' as const
const TEMPERATURE = 0.7

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadOwnedRun(id)
  if ('error' in ctx) return ctx.error
  const { supabase, userId, run } = ctx

  const stageErr = requireStage(run, ['outline'])
  if (stageErr) return stageErr

  const { success } = await checkRateLimit(`draft-outline:${userId}`, 'draft-outline')
  if (!success) return rateLimited()

  const related = await findRelated(supabase, run.brief).catch(() => [])
  const prompt = outlinePrompt(run.brief, related)
  const system = await buildBossDaddySystemMessages(supabase, userId)
  const startedAt = Date.now()

  try {
    const { object, meta } = await aiGenerateObjectWithMeta<OutlineModelOutput>({
      bucket: 'content',
      tag: 'draft-outline',
      schema: OutlineOutput,
      system,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 2500,
      effort: EFFORT,
      temperature: TEMPERATURE,
      maxRetries: 2,
      promptVersion: PROMPT_VERSION,
    })
    const shapeErr = validateOutlineShape(object.parts)
    const outline = buildOutline(object, run.brief, related)
    await logGeneration(supabase, {
      userId, contentType: run.contentType, runId: run.id, stage: 'outline', status: 'done',
      meta, effort: EFFORT, temperature: TEMPERATURE, input: { brief: run.brief, related, prompt }, output: object,
    })
    const next = await updateRun(supabase, run, { outline, error: shapeErr }, meta.costUsd ?? 0)
    return NextResponse.json({ run: next })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('draft-outline error:', c.kind, '-', c.detail)
    await logGeneration(supabase, {
      userId, contentType: run.contentType, runId: run.id, stage: 'outline',
      status: c.kind === 'truncated' ? 'truncated' : 'failed',
      meta: failedCallMeta('content', startedAt, c.kind),
      effort: EFFORT, temperature: TEMPERATURE, input: { brief: run.brief, prompt },
    })
    await updateRun(supabase, run, { error: c.userMessage }).catch(() => {})
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadOwnedRun(id)
  if ('error' in ctx) return ctx.error
  const { supabase, run } = ctx

  if (run.status === 'failed') return NextResponse.json({ error: 'This run was discarded — start a new one.' }, { status: 409 })
  if (!run.outline) return NextResponse.json({ error: 'Generate the outline first.' }, { status: 409 })

  const body = await request.json().catch(() => null)
  const parsed = OutlineEdit.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid outline', details: parsed.error.flatten() }, { status: 400 })
  }
  const shapeErr = validateOutlineShape(parsed.data.parts)
  if (shapeErr) return NextResponse.json({ error: shapeErr }, { status: 400 })

  // Any edit to the plan restarts the prose: sections are written against a
  // specific outline, and a changed heading or note invalidates what follows.
  //
  // Product tokens are re-assigned here, not trusted from the client: the
  // EARLY / MID / VERDICT placement is positional, so removing the first body
  // part or adding a section would otherwise drop a link silently (the critic
  // only checks each part against its own expectation, so nothing would flag
  // a review that shipped with no product link at all).
  const outline = {
    ...run.outline,
    title: parsed.data.title.trim(),
    excerpt: parsed.data.excerpt.trim(),
    parts: assignProductTokens(
      parsed.data.parts.map((p) => ({ ...p, heading: p.kind === 'intro' ? '' : p.heading.trim() })),
      run.brief,
    ),
    blocks: parsed.data.blocks,
    imageCount: parsed.data.imageCount,
    elements: normalizeElementPlans(parsed.data.elements, parsed.data.parts.map((p) => ({ ...p, productToken: null })), run.brief),
  }
  const next = await updateRun(supabase, run, {
    outline,
    sections: outline.parts.map(() => null),
    blocks: null, critic: null, images: null,
    status: 'drafting',
    error: null,
  })
  return NextResponse.json({ run: next })
}

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { aiResearch } from '@/lib/ai/research'
import { classifyClaudeError } from '@/lib/ai/errors'
import { failedCallMeta } from '@/lib/ai/client'
import { checkRateLimit } from '@/lib/rate-limit'
import { logGeneration } from '@/lib/content/generations'
import { loadOwnedRun, rateLimited } from '@/lib/content/pipeline/route-helpers'
import { updateRun } from '@/lib/content/pipeline/run'
import { RESEARCH_SYSTEM, ResearchOutput, researchPrompt, toResearchResult, type ResearchModelOutput } from '@/lib/content/pipeline/research'
import { RETAILER_BLOCKLIST } from '@/lib/content/references'

// "Research this part" — docs/content-pipeline-plan.md §4a.
//   POST /api/content/runs/[id]/research { partIndex } → { findings, notes, costUsd }
//
// One live web search (the research bucket: Grok Live Search or Anthropic web
// search, whichever is configured) for the facts one planned section needs.
// Nothing is saved here: the author keeps what belongs in the outline editor and
// the outline PUT carries the kept sources into the brief (`addReferenceNotes`).
// The call is a `research` row in `generations` and its cost joins the run's.

export const maxDuration = 90
const TEMPERATURE = 0

const Input = z.object({ partIndex: z.number().int().min(0).max(40) })

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadOwnedRun(id)
  if ('error' in ctx) return ctx.error
  const { supabase, userId, run } = ctx
  if (!run.outline) return NextResponse.json({ error: 'Plan the outline first.' }, { status: 409 })

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const part = run.outline.parts[parsed.data.partIndex]
  if (!part) return NextResponse.json({ error: 'No such part' }, { status: 400 })

  const { success } = await checkRateLimit(`research-part:${userId}`, 'research-part')
  if (!success) return rateLimited()

  const prompt = researchPrompt(run, parsed.data.partIndex)
  const startedAt = Date.now()
  try {
    const { object, meta } = await aiResearch<ResearchModelOutput>({
      tag: 'research-part', system: RESEARCH_SYSTEM, prompt, schema: ResearchOutput,
      maxSteps: 6,
      search: { maxUses: 4, blockedDomains: RETAILER_BLOCKLIST, dynamicFiltering: false },
      maxOutputTokens: 3000, temperature: TEMPERATURE, timeout: 70_000, retryOnTransient: false,
    })
    const result = toResearchResult(object.findings)
    await logGeneration(supabase, {
      userId, contentType: run.contentType, runId: run.id, stage: 'research', status: 'done', meta, temperature: TEMPERATURE,
      input: { partIndex: parsed.data.partIndex, heading: part.heading, prompt }, output: object,
    })
    if (meta.costUsd) await updateRun(supabase, run, {}, meta.costUsd).catch(() => {})
    return NextResponse.json({ ...result, costUsd: meta.costUsd ?? null })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('research-part error:', c.kind, '-', c.detail)
    await logGeneration(supabase, {
      userId, contentType: run.contentType, runId: run.id, stage: 'research', status: c.kind === 'truncated' ? 'truncated' : 'failed',
      meta: failedCallMeta('research', startedAt, c.kind, undefined, c.usage), temperature: TEMPERATURE,
      input: { partIndex: parsed.data.partIndex, heading: part.heading, prompt },
    }).catch(() => {})
    return NextResponse.json({ error: c.userMessage }, { status: c.status })
  }
}

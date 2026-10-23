import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { aiStreamText, failedCallMeta } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { buildBossDaddySystemMessages } from '@/lib/voiceProfile'
import { logGeneration } from '@/lib/content/generations'
import { PROMPT_VERSION } from '@/lib/content/prompts'
import { sectionBudget, sectionPrompt } from '@/lib/content/pipeline/section'
import { getRun, updateRun } from '@/lib/content/pipeline/run'
import { loadOwnedRun, rateLimited, requireStage } from '@/lib/content/pipeline/route-helpers'
import { checkRateLimit } from '@/lib/rate-limit'

// Stage 2 — one part, streamed as plain text. The response body is the prose;
// the run row is updated in onFinish (awaited by the SDK before the stream
// closes), so the client re-fetches the run after the stream ends.
export const maxDuration = 120

const EFFORT = 'high' as const
const TEMPERATURE = 0.8

const Input = z.object({
  index: z.number().int().min(0).max(20),
  /** Re-write a part that already has text (the author asked for another take). */
  rewrite: z.boolean().default(false),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadOwnedRun(id)
  if ('error' in ctx) return ctx.error
  const { supabase, userId, run } = ctx

  const stageErr = requireStage(run, ['drafting'])
  if (stageErr) return stageErr

  const body = await request.json().catch(() => null)
  const parsed = Input.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const { index, rewrite } = parsed.data

  const part = run.outline?.parts[index]
  if (!part) return NextResponse.json({ error: 'No such part' }, { status: 400 })
  if (run.sections[index]?.text && !rewrite) {
    return NextResponse.json({ error: 'This part is already written; pass rewrite: true for another take.' }, { status: 409 })
  }
  // Parts are written in order so each one can continue from the last.
  const firstUnwritten = run.sections.findIndex((s, i) => i < index && !s?.text)
  if (firstUnwritten !== -1 && !rewrite) {
    return NextResponse.json({ error: `Write part ${firstUnwritten + 1} first.` }, { status: 409 })
  }

  const { success } = await checkRateLimit(`draft-section:${userId}`, 'draft-section')
  if (!success) return rateLimited()

  const prompt = sectionPrompt(run, index)
  const system = await buildBossDaddySystemMessages(supabase, userId)
  const budget = sectionBudget(part.targetWords)
  const startedAt = Date.now()

  const result = aiStreamText({
    bucket: 'content',
    tag: 'draft-section',
    system,
    messages: [{ role: 'user', content: prompt }],
    maxOutputTokens: budget,
    effort: EFFORT,
    temperature: TEMPERATURE,
    maxRetries: 2,
    promptVersion: PROMPT_VERSION,
    onFinish: async ({ text, meta }) => {
      const truncated = meta.finishReason === 'length'
      const clean = text.trim()
      const generationId = await logGeneration(supabase, {
        userId, contentType: run.contentType, runId: run.id, stage: 'section',
        status: truncated ? 'truncated' : 'done',
        meta, effort: EFFORT, temperature: TEMPERATURE,
        input: { index, heading: part.heading, kind: part.kind, targetWords: part.targetWords, prompt },
        output: { text: clean },
      })
      // Re-read: a concurrent write (unlikely — parts are sequential) must not be clobbered.
      const fresh = (await getRun(supabase, run.id)) ?? run
      const sections = [...fresh.sections]
      while (sections.length < (fresh.outline?.parts.length ?? 0)) sections.push(null)
      if (truncated || !clean) {
        await updateRun(supabase, fresh, { error: `Part ${index + 1} was cut off before it finished — try it again.` }, meta.costUsd ?? 0)
        return
      }
      sections[index] = { text: clean, generationId }
      const allWritten = sections.every((s) => !!s?.text)
      await updateRun(supabase, fresh, {
        sections,
        error: null,
        ...(allWritten ? { status: 'blocks' as const } : {}),
      }, meta.costUsd ?? 0)
    },
    onError: async (error) => {
      const c = classifyClaudeError(error)
      console.error('draft-section error:', c.kind, '-', c.detail)
      await logGeneration(supabase, {
        userId, contentType: run.contentType, runId: run.id, stage: 'section', status: 'failed',
        meta: failedCallMeta('content', startedAt, c.kind), effort: EFFORT, temperature: TEMPERATURE,
        input: { index, heading: part.heading, prompt },
      })
      await updateRun(supabase, run, { error: c.userMessage }).catch(() => {})
    },
  })

  return result.toTextStreamResponse()
}

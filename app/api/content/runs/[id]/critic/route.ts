import { NextResponse, type NextRequest } from 'next/server'
import { aiGenerateObjectWithMeta, failedCallMeta } from '@/lib/ai/client'
import { classifyClaudeError } from '@/lib/ai/errors'
import { getVoiceProfile } from '@/lib/voiceProfile'
import { logGeneration } from '@/lib/content/generations'
import { PROMPT_VERSION } from '@/lib/content/prompts'
import { runRules } from '@/lib/content/pipeline/critic/rules'
import { CRITIC_SYSTEM, CriticOutput, blocksText, criticPrompt, type CriticModelOutput } from '@/lib/content/pipeline/critic/model'
import { updateRun } from '@/lib/content/pipeline/run'
import { loadOwnedRun, rateLimited, requireStage } from '@/lib/content/pipeline/route-helpers'
import type { Critic, CriticFinding } from '@/lib/content/pipeline/types'
import { checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 90

// Stage 4 — rules first (deterministic, free), then the model's judgement.
// If the model call fails the rules findings still stand and the run moves on:
// the critic informs the author, it never blocks the pipeline by itself.
// `blocksText` / `CRITIC_SYSTEM` live in the model module so the content eval
// (tests/eval/content-eval.ts) judges with exactly this editor.
const EFFORT = 'low' as const
const TEMPERATURE = 0

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadOwnedRun(id)
  if ('error' in ctx) return ctx.error
  const { supabase, userId, run } = ctx

  const stageErr = requireStage(run, ['critic', 'images', 'done'])
  if (stageErr) return stageErr
  if (!run.outline) return NextResponse.json({ error: 'No outline' }, { status: 409 })

  const { success } = await checkRateLimit(`critic:${userId}`, 'critic')
  if (!success) return rateLimited()

  const profile = await getVoiceProfile(supabase, userId)
  const familyNames = (profile?.family_members ?? []).map((m) => m.name?.trim() ?? '').filter((n) => n.length >= 2)
  const parts = run.outline.parts
  const texts = parts.map((_, i) => run.sections[i]?.text ?? '')

  const findings: CriticFinding[] = runRules({ brief: run.brief, parts, texts, familyNames })
  let summary = ''

  const prompt = criticPrompt(run, blocksText(run))
  const startedAt = Date.now()
  let cost = 0
  try {
    const { object, meta } = await aiGenerateObjectWithMeta<CriticModelOutput>({
      bucket: 'content',
      tag: 'critic',
      schema: CriticOutput,
      // No voice system here on purpose: the critic is the editor, not the writer.
      system: CRITIC_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
      maxOutputTokens: 2000,
      effort: EFFORT,
      temperature: TEMPERATURE,
      maxRetries: 2,
      promptVersion: PROMPT_VERSION,
    })
    cost = meta.costUsd ?? 0
    for (const f of object.findings) {
      findings.push({ severity: f.severity, code: f.code, message: f.message, part: f.part != null ? f.part - 1 : null, quote: f.quote ?? null, source: 'model' })
    }
    summary = object.summary
    await logGeneration(supabase, {
      userId, contentType: run.contentType, runId: run.id, stage: 'critic', status: 'done',
      meta, effort: EFFORT, temperature: TEMPERATURE, input: { prompt }, output: object,
    })
  } catch (err) {
    const c = classifyClaudeError(err)
    console.error('critic error (continuing with rules only):', c.kind, '-', c.detail)
    await logGeneration(supabase, {
      userId, contentType: run.contentType, runId: run.id, stage: 'critic', status: 'failed',
      meta: failedCallMeta('content', startedAt, c.kind), effort: EFFORT, temperature: TEMPERATURE, input: { prompt },
    })
    summary = 'The editor pass was unavailable — only the rule checks ran.'
  }

  const order = { block: 0, warn: 1, note: 2 }
  findings.sort((a, b) => order[a.severity] - order[b.severity])
  const critic: Critic = { findings, summary }
  const next = await updateRun(supabase, run, {
    critic,
    status: run.outline.imageCount > 0 ? 'images' : 'done',
    error: null,
  }, cost)
  return NextResponse.json({ run: next })
}

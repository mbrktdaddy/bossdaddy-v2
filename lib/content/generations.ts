import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/lib/supabase/database.types'
import type { CallMeta } from '@/lib/ai/client'
import { PROMPT_VERSION } from './prompts'

// One row per AI stage call (migration 164). This IS the audit trail — which
// model and prompt version wrote what, for how much — so it is awaited, not
// fire-and-forget: on serverless the function can be reclaimed the moment the
// response flushes, dropping a detached write. A logging failure must never
// break a generation, so errors are swallowed after a console.error.

// 'images' = the image PLAN (a text call); 'image' = one generated picture
// (the image model + its vision QA), so the chip includes the pixels.
export type GenerationStage = 'draft' | 'outline' | 'section' | 'blocks' | 'critic' | 'images' | 'image' | 'refine'
export type GenerationStatus = 'done' | 'failed' | 'truncated'

export interface LogGenerationInput {
  userId: string
  contentType: 'review' | 'guide'
  contentId?: string | null
  stage: GenerationStage
  status: GenerationStatus
  meta: CallMeta
  /** The staged-pipeline run this call belongs to (mig 165). */
  runId?: string | null
  effort?: string | null
  temperature?: number | null
  /** The wizard fields + user prompt. NOT the system prompt — that is PROMPT_VERSION. */
  input: Record<string, unknown>
  output?: unknown
}

export async function logGeneration(supabase: SupabaseClient, g: LogGenerationInput): Promise<string | null> {
  const u = g.meta.usage
  const { data, error } = await supabase
    .from('generations')
    .insert({
      user_id:             g.userId,
      content_type:        g.contentType,
      content_id:          g.contentId ?? null,
      run_id:              g.runId ?? null,
      stage:               g.stage,
      status:              g.status,
      model:               g.meta.model,
      prompt_version:      PROMPT_VERSION,
      effort:              g.effort ?? null,
      temperature:         g.temperature ?? null,
      input_tokens:        u?.inputTokens ?? 0,
      output_tokens:       u?.outputTokens ?? 0,
      reasoning_tokens:    u?.outputTokenDetails?.reasoningTokens ?? 0,
      cached_input_tokens: u?.inputTokenDetails?.cacheReadTokens ?? 0,
      latency_ms:          g.meta.latencyMs,
      cost_usd:            g.meta.costUsd,
      finish_reason:       g.meta.finishReason,
      input:               g.input as Json,
      output:              (g.output ?? null) as Json,
    })
    .select('id')
    .single()

  if (error) {
    console.error('logGeneration failed:', error.message)
    return null
  }
  return data?.id ?? null
}

/**
 * Called when the author saves a draft that came from a generation: links the
 * row to the content and marks it accepted. Owner-only RLS means the session
 * client can do this — the author is the row's user.
 */
export async function attachGeneration(
  supabase: SupabaseClient,
  generationId: string,
  contentId: string,
): Promise<void> {
  const { error } = await supabase
    .from('generations')
    .update({ content_id: contentId, accepted: true })
    .eq('id', generationId)
  if (error) console.error('attachGeneration failed:', error.message)
}

/** Sum of everything spent on one piece, for the cost chip. */
export async function costForContent(supabase: SupabaseClient, contentId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('generations')
    .select('cost_usd')
    .eq('content_id', contentId)
  if (error || !data) return null
  let total = 0
  let any = false
  for (const row of data as { cost_usd: number | null }[]) {
    if (row.cost_usd != null) { total += Number(row.cost_usd); any = true }
  }
  return any ? Math.round(total * 1e5) / 1e5 : null
}

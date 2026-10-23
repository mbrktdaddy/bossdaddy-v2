import type { SupabaseClient } from '@supabase/supabase-js'
import type { Json } from '@/lib/supabase/database.types'
import { PROMPT_VERSION } from '../prompts'
import type { Blocks, Brief, Critic, ImagePlan, Outline, RunState, RunStatus, SectionResult } from './types'

// Persistence for `content_runs` (mig 165). Routes use the SESSION client so
// RLS enforces ownership; nothing here needs the service role.

type Row = {
  id: string; user_id: string; content_type: string; status: string
  brief: Json; outline: Json | null; sections: Json; blocks: Json | null; critic: Json | null; images: Json | null
  content_id: string | null; cost_usd: number | null; error: string | null; prompt_version: string
  created_at: string; updated_at: string
}

export function rowToRun(row: Row): RunState {
  return {
    id: row.id,
    userId: row.user_id,
    contentType: row.content_type as RunState['contentType'],
    status: row.status as RunStatus,
    brief: row.brief as unknown as Brief,
    outline: (row.outline as unknown as Outline | null) ?? null,
    sections: Array.isArray(row.sections) ? (row.sections as unknown as (SectionResult | null)[]) : [],
    blocks: (row.blocks as unknown as Blocks | null) ?? null,
    critic: (row.critic as unknown as Critic | null) ?? null,
    images: (row.images as unknown as ImagePlan | null) ?? null,
    contentId: row.content_id,
    costUsd: Number(row.cost_usd ?? 0),
    error: row.error,
    promptVersion: row.prompt_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createRun(supabase: SupabaseClient, userId: string, brief: Brief): Promise<RunState> {
  const { data, error } = await supabase
    .from('content_runs')
    .insert({
      user_id: userId,
      content_type: brief.contentType,
      status: 'outline',
      brief: brief as unknown as Json,
      prompt_version: PROMPT_VERSION,
    })
    .select('*')
    .single()
  if (error || !data) throw new Error(`createRun failed: ${error?.message ?? 'no row'}`)
  return rowToRun(data as Row)
}

export async function getRun(supabase: SupabaseClient, id: string): Promise<RunState | null> {
  const { data, error } = await supabase.from('content_runs').select('*').eq('id', id).maybeSingle()
  if (error) { console.error('getRun failed:', error.message); return null }
  return data ? rowToRun(data as Row) : null
}

export interface RunPatch {
  status?: RunStatus
  outline?: Outline | null
  sections?: (SectionResult | null)[]
  blocks?: Blocks | null
  critic?: Critic | null
  images?: ImagePlan | null
  error?: string | null
  contentId?: string | null
}

/** Patch the run; `addCost` accumulates (stages are sequential, so read-then-write is safe). */
export async function updateRun(supabase: SupabaseClient, run: RunState, patch: RunPatch, addCost: number | null = null): Promise<RunState> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.status !== undefined) update.status = patch.status
  if (patch.outline !== undefined) update.outline = patch.outline as unknown as Json
  if (patch.sections !== undefined) update.sections = patch.sections as unknown as Json
  if (patch.blocks !== undefined) update.blocks = patch.blocks as unknown as Json
  if (patch.critic !== undefined) update.critic = patch.critic as unknown as Json
  if (patch.images !== undefined) update.images = patch.images as unknown as Json
  if (patch.error !== undefined) update.error = patch.error
  if (patch.contentId !== undefined) update.content_id = patch.contentId
  if (addCost != null) update.cost_usd = Math.round((run.costUsd + addCost) * 1e5) / 1e5

  const { data, error } = await supabase
    .from('content_runs')
    .update(update)
    .eq('id', run.id)
    .select('*')
    .single()
  if (error || !data) throw new Error(`updateRun failed: ${error?.message ?? 'no row'}`)
  return rowToRun(data as Row)
}

/**
 * Called when the author saves the draft that a run produced: links the run and
 * every generation behind it to the content row. Owner RLS lets the session
 * client do this — the author is the row's user.
 */
export async function attachRun(supabase: SupabaseClient, runId: string, contentId: string): Promise<void> {
  const [a, b] = await Promise.all([
    supabase.from('content_runs').update({ content_id: contentId, updated_at: new Date().toISOString() }).eq('id', runId),
    supabase.from('generations').update({ content_id: contentId, accepted: true }).eq('run_id', runId),
  ])
  if (a.error) console.error('attachRun (run) failed:', a.error.message)
  if (b.error) console.error('attachRun (generations) failed:', b.error.message)
}

/** Latest unfinished run of this type for the user — what the wizard offers to resume. */
export async function findResumableRun(supabase: SupabaseClient, userId: string, contentType: 'review' | 'guide'): Promise<RunState | null> {
  const { data } = await supabase
    .from('content_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('content_type', contentType)
    .not('status', 'in', '("done","failed")')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ? rowToRun(data as Row) : null
}

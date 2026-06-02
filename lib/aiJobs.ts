import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

// Async job records for long-running AI calls (migration 092). The endpoint
// creates a pending job, runs the work in the background, and the client polls.
//
// NOTE: `ai_jobs` isn't in the generated Database types until `npm run db:types`
// is rerun after applying migration 092. We access it through an untyped client
// cast so this module compiles now and the rest of the app stays fully typed.

export type AiJobKind = 'specs_grade'
export type AiJobStatus = 'pending' | 'running' | 'done' | 'error'

export interface AiJob {
  id: string
  user_id: string
  kind: AiJobKind
  status: AiJobStatus
  input: Record<string, unknown>
  result: Record<string, unknown> | null
  error: string | null
  created_at: string
  updated_at: string
}

function db(): SupabaseClient {
  // Service-role client (bypasses RLS). Ownership is enforced in code on reads.
  return createAdminClient() as unknown as SupabaseClient
}

// Create a pending job and return its id.
export async function createJob(
  userId: string,
  kind: AiJobKind,
  input: Record<string, unknown>,
): Promise<string> {
  const { data, error } = await db()
    .from('ai_jobs')
    .insert({ user_id: userId, kind, input, status: 'pending' })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createJob failed: ${error?.message ?? 'no row returned'}`)
  return (data as { id: string }).id
}

export async function markRunning(id: string): Promise<void> {
  await db().from('ai_jobs').update({ status: 'running', updated_at: new Date().toISOString() }).eq('id', id)
}

export async function markDone(id: string, result: Record<string, unknown>): Promise<void> {
  await db().from('ai_jobs').update({ status: 'done', result, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function markError(id: string, message: string): Promise<void> {
  await db().from('ai_jobs').update({ status: 'error', error: message.slice(0, 500), updated_at: new Date().toISOString() }).eq('id', id)
}

// Read a job, enforcing ownership in code (we use the service-role client, which
// bypasses RLS). Returns null if missing or not owned by `userId`.
export async function getJob(id: string, userId: string): Promise<AiJob | null> {
  const { data, error } = await db().from('ai_jobs').select('*').eq('id', id).maybeSingle()
  if (error || !data) return null
  const job = data as AiJob
  if (job.user_id !== userId) return null
  return job
}

import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getRun } from './run'
import type { RunState, RunStatus } from './types'

// Shared plumbing for app/api/content/runs/*: auth (authors/admins only, same
// gate as the old draft routes' callers), ownership via RLS + an explicit
// check, and the stage guard that keeps a stage from running out of order.

type Supabase = Awaited<ReturnType<typeof createClient>>

export type RunContext = { supabase: Supabase; userId: string; run: RunState }

export async function requireAuthor(): Promise<{ supabase: Supabase; userId: string } | { error: NextResponse }> {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['author', 'admin'].includes(profile.role)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { supabase, userId: user.id }
}

export async function loadOwnedRun(id: string): Promise<RunContext | { error: NextResponse }> {
  const auth = await requireAuthor()
  if ('error' in auth) return auth
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: NextResponse.json({ error: 'Invalid run id' }, { status: 400 }) }
  const run = await getRun(auth.supabase, id)
  // RLS already hides other users' rows; the explicit check keeps the intent legible.
  if (!run || run.userId !== auth.userId) return { error: NextResponse.json({ error: 'Run not found' }, { status: 404 }) }
  return { supabase: auth.supabase, userId: auth.userId, run }
}

/** 409 unless the run is in one of the allowed stages. */
export function requireStage(run: RunState, allowed: RunStatus[]): NextResponse | null {
  if (allowed.includes(run.status)) return null
  return NextResponse.json(
    { error: `This run is at the "${run.status}" stage; expected ${allowed.map((s) => `"${s}"`).join(' or ')}.`, run },
    { status: 409 },
  )
}

export function rateLimited(): NextResponse {
  return NextResponse.json({ error: 'Too many generations right now — slow down and try again shortly.' }, { status: 429 })
}

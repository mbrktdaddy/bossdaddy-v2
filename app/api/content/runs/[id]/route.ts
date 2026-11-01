import { NextResponse, type NextRequest } from 'next/server'
import { loadOwnedRun } from '@/lib/content/pipeline/route-helpers'
import { discardUnfinishedRuns, getRun } from '@/lib/content/pipeline/run'

// GET  /api/content/runs/[id] → { run }
// DELETE /api/content/runs/[id] → marks it AND every other unfinished run of
//        the same type failed ("discard & start over"). One at a time let a
//        stray run resurface as "unfinished draft" after each discard.

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadOwnedRun(id)
  if ('error' in ctx) return ctx.error
  return NextResponse.json({ run: ctx.run })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await loadOwnedRun(id)
  if ('error' in ctx) return ctx.error
  // Keep the rows (and their generations log) — the cost was real; just take
  // them out of the resumable set.
  await discardUnfinishedRuns(ctx.supabase, ctx.userId, ctx.run.contentType, 'Discarded by the author.')
  const run = (await getRun(ctx.supabase, id)) ?? { ...ctx.run, status: 'failed' as const }
  return NextResponse.json({ run })
}

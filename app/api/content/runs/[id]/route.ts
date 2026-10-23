import { NextResponse, type NextRequest } from 'next/server'
import { loadOwnedRun } from '@/lib/content/pipeline/route-helpers'
import { updateRun } from '@/lib/content/pipeline/run'

// GET  /api/content/runs/[id] → { run }
// DELETE /api/content/runs/[id] → marks it failed ("discard & start over")

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
  // Keep the row (and its generations log) — the cost was real; just take it
  // out of the resumable set.
  const run = await updateRun(ctx.supabase, ctx.run, { status: 'failed', error: 'Discarded by the author.' })
  return NextResponse.json({ run })
}

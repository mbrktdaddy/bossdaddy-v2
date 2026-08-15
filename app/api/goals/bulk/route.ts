import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { recomputeGoalStats } from '@/lib/goals/stats'
import { revalidateGoals } from '@/lib/goals/revalidate'

// Bulk pause / resume / archive / restore / delete from the goals index.
//
// NO CLIENT JAVASCRIPT, which shapes two decisions:
//
//   • "Select all" can't be a checkbox that ticks the others — that needs JS. So
//     scope is a radio instead: act on the ones you checked, or on everything in
//     the current view. The server already knows what's in the view, so "all"
//     needs no client state at all.
//
//   • Bulk delete is two-step, same as the single delete. The first POST returns
//     to the index with the ids in the query string and renders a confirm panel
//     naming every goal; only that panel's form actually destroys anything. A
//     one-shot bulk delete is the kind of button that eats someone's year of
//     history on a mis-tap.
//
// RLS does the authorization. Every statement is scoped by the session client, so
// an id belonging to someone else simply matches zero rows — there's no ownership
// check here to forget.

const MAX_IDS = 200
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const op = String(form.get('op') ?? '')
  const scope = String(form.get('scope') ?? 'selected')
  const view = String(form.get('view') ?? 'active')
  const confirmed = String(form.get('confirm') ?? '') === 'yes'

  const archivedView = view === 'archived'
  const backTo = archivedView ? '/goals?archived=1' : '/goals'

  if (!['pause', 'resume', 'archive', 'restore', 'delete'].includes(op)) {
    return bounce(request, backTo, 'Unknown action.')
  }

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.redirect(new URL('/login?next=/goals', request.url), 303)

  // ── which goals ───────────────────────────────────────────────────────────
  let ids: string[]
  if (scope === 'all') {
    // "Everything in this view" — resolved server-side from the same status
    // filter the page rendered with, so it can't drift from what the user saw.
    const { data } = await supabase
      .from('goals')
      .select('id')
      .in('status', archivedView ? ['archived'] : ['active', 'paused'])
      .limit(MAX_IDS)
    ids = ((data ?? []) as unknown as { id: string }[]).map((g) => g.id)
  } else {
    ids = form.getAll('goalIds').map(String).filter((v) => UUID_RE.test(v)).slice(0, MAX_IDS)
  }

  if (!ids.length) {
    return bounce(request, backTo, 'Nothing selected — tick a goal first, or choose "everything here".')
  }

  // ── delete: confirm first ─────────────────────────────────────────────────
  if (op === 'delete' && !confirmed) {
    const url = new URL(backTo, request.url)
    url.searchParams.set('confirmDelete', ids.join(','))
    return NextResponse.redirect(url, 303)
  }

  if (op === 'delete') {
    const { error } = await supabase.from('goals').delete().in('id', ids)
    if (error) {
      console.error('goals/bulk delete failed', error.message)
      return bounce(request, backTo, 'Couldn\'t delete those.')
    }
    revalidateGoals(ids)
    return bounce(request, backTo, `Deleted ${ids.length} goal${ids.length === 1 ? '' : 's'}.`)
  }

  // ── status changes ────────────────────────────────────────────────────────
  const status = op === 'pause' ? 'paused' : 'archived'
  const targetStatus = (op === 'resume' || op === 'restore') ? 'active' : status

  const { data: updated, error } = await supabase
    .from('goals')
    .update({
      status: targetStatus,
      archived_at: targetStatus === 'archived' ? new Date().toISOString() : null,
      // Same rule as setGoalStatus: going back to active clears the finish stamp,
      // archiving keeps it. An active goal carrying a completed_at is a row that
      // contradicts itself.
      ...(targetStatus === 'active' ? { completed_at: null } : {}),
    })
    .in('id', ids)
    .select('id')
  if (error) {
    console.error('goals/bulk update failed', error.message)
    return bounce(request, backTo, 'Couldn\'t update those.')
  }

  const touched = ((updated ?? []) as unknown as { id: string }[]).map((g) => g.id)
  // open_count and next_due_at both change when a goal pauses, so the index
  // cards would keep showing a stale "Due" badge without this.
  if (touched.length) await recomputeGoalStats(supabase, touched)
  revalidateGoals(touched)

  const verb = op === 'pause' ? 'Paused'
    : op === 'archive' ? 'Archived'
    : 'Restored'
  return bounce(request, backTo, `${verb} ${touched.length} goal${touched.length === 1 ? '' : 's'}.`)
}

function bounce(request: NextRequest, backTo: string, message: string): NextResponse {
  const url = new URL(backTo, request.url)
  url.searchParams.set('msg', message)
  return NextResponse.redirect(url, 303)
}

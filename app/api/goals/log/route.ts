import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { logOccurrenceEntry } from '@/lib/goals/log'

// The flush endpoint for the offline queue on /today.
//
// WHY A ROUTE HANDLER AND NOT THE SERVER ACTION: the queue drains in the
// background, possibly minutes after the page rendered and possibly for several
// entries at once. It needs a plain fetch it can retry and inspect the status of,
// not a form submission that navigates.
//
// SAFE TO CALL TWICE, BY CONSTRUCTION. logOccurrenceEntry keys on
// `client_entry_id = occurrence.id` with `unique (user_id, client_entry_id)`
// behind it (migration 134, decision 5), so a double flush is a no-op rather than
// a double-counted dose. That is what lets this endpoint be dumb about retries —
// the client can re-send anything it isn't sure about.
//
// `local_date` is NOT taken from the client here. For occurrence-bound logs it
// comes off the occurrence row, so a dose logged at 11:40pm and synced at 8am
// still lands on the night it was taken — the trap migration 134 warns about.

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    occurrenceId?: string; action?: string; value?: number | null
  } | null
  if (!body?.occurrenceId) {
    return NextResponse.json({ error: 'Missing occurrence' }, { status: 400 })
  }
  const action = body.action === 'skipped' ? 'skipped' : 'completed'

  const result = await logOccurrenceEntry(supabase, {
    occurrenceId: body.occurrenceId,
    userId: user.id,
    action,
    value: typeof body.value === 'number' && Number.isFinite(body.value) ? body.value : null,
    // Distinguishes a queued log from a live one in the entry history, which is
    // the only way to tell later whether the offline path is actually being used.
    source: 'offline_sync',
  })

  // EVERY OUTCOME IS FINAL, so the client always drops the entry.
  //   'logged'           — written.
  //   'already_resolved' — a double flush, or he tapped the email link meanwhile.
  //                        The queue did its job; retrying would achieve nothing.
  //   'not_found'        — not his occurrence, or it's gone. Never becomes valid.
  // Returning 200 for all three is deliberate: a queued entry that can never
  // succeed must not sit in localStorage retrying forever.
  return NextResponse.json({ ok: true, outcome: result.outcome })
}

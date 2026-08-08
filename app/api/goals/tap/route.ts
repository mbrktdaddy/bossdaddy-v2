import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOccurrenceToken } from '@/lib/goals/links'
import { recomputeGoalStats } from '@/lib/goals/stats'

// The mutating half of the one-tap flow. app/g/[token]/page.tsx renders a plain
// form that POSTs here; this is the only place the token can cause a write.
//
// No session is required — the signed token is the authorization, scoped to a
// single occurrence and expiring in two weeks. That's what lets a dad log a dose
// from an email on a device he's never signed in on.
//
// IDEMPOTENCY, TWICE OVER:
//   • The occurrence UPDATE is guarded on its current status, so a double POST
//     (impatient double-tap, mail-client retry, browser back-then-resubmit)
//     resolves once and the second attempt falls through to "already logged".
//   • The entry write uses the occurrence id as `client_entry_id`, which is
//     unique per (user, client_entry_id) — so even if the guard were bypassed,
//     Postgres refuses the duplicate. A double-counted medication dose is the
//     one bug this flow absolutely must not have.

const SNOOZE_MINUTES = 60

export async function POST(request: NextRequest) {
  const form = await request.formData()
  const token = String(form.get('token') ?? '')
  const action = String(form.get('action') ?? '')
  const rawValue = form.get('value')

  const verified = verifyOccurrenceToken(token)
  if (!verified.ok) {
    // Bounce back to the page, which renders the specific reason.
    return redirectTo(request, `/g/${encodeURIComponent(token)}`)
  }
  if (action !== 'completed' && action !== 'skipped' && action !== 'snoozed') {
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { occurrenceId } = verified.payload

  const { data: occurrenceRow } = await admin
    .from('goal_occurrences')
    .select('id, goal_id, user_id, status, local_date, target_value')
    .eq('id', occurrenceId)
    .maybeSingle()
  const occurrence = occurrenceRow as unknown as {
    id: string; goal_id: string; user_id: string; status: string
    local_date: string; target_value: number | null
  } | null
  if (!occurrence) return redirectTo(request, `/g/${token}`)

  const now = new Date()

  // ── snooze: no log entry, just push the nudge out an hour ──────────────────
  if (action === 'snoozed') {
    await admin.from('goal_occurrences')
      .update({
        status: 'snoozed',
        snoozed_until: new Date(now.getTime() + SNOOZE_MINUTES * 60_000).toISOString(),
      })
      .eq('id', occurrence.id)
      .in('status', ['pending', 'notified', 'missed'])
    return redirectTo(request, `/g/${token}?state=snoozed`)
  }

  // ── resolve the occurrence, guarded ───────────────────────────────────────
  // A `missed` row is still loggable: catch-up is a first-class action, never a
  // closed door. Already-completed/skipped rows match nothing and fall through.
  const { data: updated } = await admin
    .from('goal_occurrences')
    .update({ status: action, resolved_at: now.toISOString(), snoozed_until: null })
    .eq('id', occurrence.id)
    .in('status', ['pending', 'notified', 'snoozed', 'missed'])
    .select('id')

  if (!updated?.length) {
    return redirectTo(request, `/g/${token}?state=${action === 'skipped' ? 'skipped' : 'logged'}`)
  }

  // ── write the log entry ───────────────────────────────────────────────────
  const wasCatchup = occurrence.status === 'missed'
  const parsed = rawValue == null || String(rawValue).trim() === '' ? null : Number(rawValue)
  const value = parsed != null && Number.isFinite(parsed) ? parsed : null

  const { error: entryError } = await admin.from('goal_entries').insert({
    goal_id: occurrence.goal_id,
    occurrence_id: occurrence.id,
    user_id: occurrence.user_id,
    // The occurrence's own local date, never a date derived here — the server's
    // idea of "today" is not the user's, and a late-night log belongs to the day
    // it was meant for.
    local_date: occurrence.local_date,
    observed_at: now.toISOString(),
    kind: action === 'skipped' ? 'skipped' : wasCatchup ? 'catchup' : 'completed',
    value,
    source: 'push',
    client_entry_id: occurrence.id,
  })
  if (entryError && !isDuplicate(entryError)) {
    console.error('goals/tap entry insert failed', entryError.message)
  }

  // Keep the index card honest — streak and open count both just moved.
  await recomputeGoalStats(admin, [occurrence.goal_id])

  return redirectTo(request, `/g/${token}?state=${action === 'skipped' ? 'skipped' : 'logged'}`)
}

function isDuplicate(error: { code?: string }): boolean {
  return error.code === '23505'  // unique_violation — the second tap, as designed
}

// 303 so the browser follows with GET and a refresh can't re-POST the form.
function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303)
}

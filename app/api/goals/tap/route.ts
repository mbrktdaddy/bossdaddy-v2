import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyOccurrenceToken } from '@/lib/goals/links'
import { logOccurrenceEntry } from '@/lib/goals/log'

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

  // ── resolve the occurrence and write the entry ────────────────────────────
  // Both halves of the idempotency described above live in lib/goals/log.ts,
  // shared with the goals UI and the Boss's log_goal_entry tool — a second copy
  // here is how the three paths would drift on which day a late-night tap counts
  // for. A `missed` row is still loggable: catch-up is first-class, never a closed
  // door, and an already-resolved row falls through to the same confirmation.
  //
  // Failures are logged, not thrown: this request's job is to land the dad on a
  // page that tells him the truth, and the page reads live state.
  const parsed = rawValue == null || String(rawValue).trim() === '' ? null : Number(rawValue)

  try {
    await logOccurrenceEntry(admin, {
      occurrenceId: occurrence.id,
      userId: occurrence.user_id,
      action,
      value: parsed,
      source: 'push',
    })
  } catch (err) {
    console.error('goals/tap log failed', err instanceof Error ? err.message : String(err))
  }

  return redirectTo(request, `/g/${token}?state=${action === 'skipped' ? 'skipped' : 'logged'}`)
}

// 303 so the browser follows with GET and a refresh can't re-POST the form.
function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303)
}

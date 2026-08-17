import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { verifyOccurrenceToken } from '@/lib/goals/links'
import { logOccurrenceEntry } from '@/lib/goals/log'
import { revalidateGoal } from '@/lib/goals/revalidate'

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
  // Stays on the confirmation page even for a signed-in owner, unlike the two
  // branches below. "Snooze" means not now — bouncing him into the app is the
  // opposite of what he asked for, and the detail page would still show the
  // occurrence as open (a snoozed row is still actionable there), which would
  // read as if the snooze hadn't taken.
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
    const result = await logOccurrenceEntry(admin, {
      occurrenceId: occurrence.id,
      userId: occurrence.user_id,
      action,
      value: parsed,
      source: 'push',
    })
    // He logged from his inbox; the goal pages he already had open are now stale.
    revalidateGoal(result.goalId)
  } catch (err) {
    console.error('goals/tap log failed', err instanceof Error ? err.message : String(err))
  }

  // ── where he lands ────────────────────────────────────────────────────────
  // Signed in as the owner → his goal, where the streak has already moved and the
  // week strip has filled in. That's the payoff, and it's a page he can do the
  // next thing from; the token confirmation is a cul-de-sac by comparison.
  //
  // NOT signed in → the confirmation page, and this is the half that matters. The
  // whole point of the token is a dad tapping from an email on a device he's never
  // signed in on. Sending HIM to /goals/<id> means the auth wall — "Sign in to see
  // this goal" — immediately after a successful write, which reads as "it didn't
  // save" and invites a second tap. So the check is ownership, not merely a
  // session: someone else's browser gets the confirmation too.
  //
  // Deliberately AFTER the write. An auth round-trip that's slow or broken must
  // never be able to cost him the log.
  if (await isOwner(occurrence.user_id)) {
    return redirectTo(request, `/goals/${occurrence.goal_id}?logged=${action}`)
  }
  return redirectTo(request, `/g/${token}?state=${action === 'skipped' ? 'skipped' : 'logged'}`)
}

/** Does the request carry a session belonging to the occurrence's owner? */
async function isOwner(userId: string): Promise<boolean> {
  try {
    const supabase = await createClient()
    const { user } = await getUserSafe(supabase)
    return user?.id === userId
  } catch {
    return false          // no session, expired cookies, auth server down — same answer
  }
}

// 303 so the browser follows with GET and a refresh can't re-POST the form.
function redirectTo(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303)
}

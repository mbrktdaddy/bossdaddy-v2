'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'

// Mutations for the goals UI.
//
// These use the SESSION client, not the admin client, so RLS is what enforces
// ownership rather than a hand-written `user_id` filter I could forget. A goal
// that isn't yours matches zero rows.
//
// Every action is invoked from a plain `<form action={...}>`, which requires a
// `Promise<void>` signature — no return channel. So feedback works like this:
//
//   • Benign outcomes (already logged, occurrence vanished) are no-ops. The
//     revalidated page shows the true current state, and that IS the feedback.
//   • Unexpected DB failures THROW, so error.tsx surfaces them. A save that
//     quietly does nothing is the worst option for a medication log.
//
// Consequence: no client JavaScript on these pages, and nothing to hydrate.

/**
 * Resolve one occurrence and write its log entry.
 *
 * `client_entry_id` is the occurrence id — the same key the one-tap email route
 * uses — so logging the same occurrence twice (once here, once from an email on
 * your phone) is refused by the unique constraint instead of double-counting.
 * For a medication or a taper that's the whole ballgame.
 */
export async function logOccurrence(formData: FormData): Promise<void> {
  const occurrenceId = String(formData.get('occurrenceId') ?? '')
  const goalId = String(formData.get('goalId') ?? '')
  const action = String(formData.get('action') ?? 'completed')
  const rawValue = formData.get('value')

  if (!occurrenceId || !goalId) return
  if (action !== 'completed' && action !== 'skipped') return

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return

  const { data: occurrenceRow } = await supabase
    .from('goal_occurrences')
    .select('id, goal_id, status, local_date')
    .eq('id', occurrenceId)
    .maybeSingle()
  const occurrence = occurrenceRow as unknown as
    { id: string; goal_id: string; status: string; local_date: string } | null
  if (!occurrence) return

  const wasCatchup = occurrence.status === 'missed'

  // Guarded on current status so a double submit resolves exactly once. A
  // `missed` row stays loggable — catch-up is always available, never demanded.
  const { data: updated, error: updateError } = await supabase
    .from('goal_occurrences')
    .update({ status: action, resolved_at: new Date().toISOString(), snoozed_until: null })
    .eq('id', occurrence.id)
    .in('status', ['pending', 'notified', 'snoozed', 'missed'])
    .select('id')
  if (updateError) throw new Error(`Could not update that day: ${updateError.message}`)

  // Zero rows means someone already resolved it. Revalidate and let the page
  // show the truth.
  if (updated?.length) {
    const parsed = rawValue == null || String(rawValue).trim() === '' ? null : Number(rawValue)
    const value = parsed != null && Number.isFinite(parsed) ? parsed : null

    const { error } = await supabase.from('goal_entries').insert({
      goal_id: occurrence.goal_id,
      occurrence_id: occurrence.id,
      user_id: user.id,
      // The occurrence's own local date — never a date derived on the server,
      // whose "today" is not the user's.
      local_date: occurrence.local_date,
      kind: action === 'skipped' ? 'skipped' : wasCatchup ? 'catchup' : 'completed',
      value,
      source: 'web',
      client_entry_id: occurrence.id,
    })
    // 23505 (unique_violation) is the intended outcome of a double submit.
    if (error && error.code !== '23505') {
      throw new Error(`Could not save that entry: ${error.message}`)
    }
  }

  revalidatePath('/goals')
  revalidatePath(`/goals/${goalId}`)
}

/** Silence or re-arm reminders for one schedule. The knob, not a lock. */
export async function toggleScheduleMute(formData: FormData): Promise<void> {
  const scheduleId = String(formData.get('scheduleId') ?? '')
  const goalId = String(formData.get('goalId') ?? '')
  const muted = String(formData.get('muted') ?? '') === 'true'
  if (!scheduleId || !goalId) return

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return

  const { error } = await supabase
    .from('goal_schedules')
    .update({ muted })
    .eq('id', scheduleId)
  if (error) throw new Error(`Could not update reminders: ${error.message}`)

  revalidatePath(`/goals/${goalId}`)
}

/**
 * Pause or resume a whole goal. Paused goals stop materializing new days and
 * stop nudging; the log is untouched, so resuming picks up where it left off.
 */
export async function setGoalStatus(formData: FormData): Promise<void> {
  const goalId = String(formData.get('goalId') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!goalId) return
  if (status !== 'active' && status !== 'paused' && status !== 'archived') return

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return

  const { error } = await supabase
    .from('goals')
    .update({
      status,
      archived_at: status === 'archived' ? new Date().toISOString() : null,
    })
    .eq('id', goalId)
  if (error) throw new Error(`Could not update that goal: ${error.message}`)

  revalidatePath('/goals')
  revalidatePath(`/goals/${goalId}`)
}

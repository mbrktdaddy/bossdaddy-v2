'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { recomputeGoalStats } from '@/lib/goals/stats'
import { localDateInZone } from '@/lib/goals/recurrence'

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

  await recomputeGoalStats(supabase, [goalId])
  revalidatePath('/goals')
  revalidatePath(`/goals/${goalId}`)
}

/**
 * Logs something that wasn't scheduled — "I just weighed myself", an extra
 * workout, a cigarette count on an off day.
 *
 * Every entry used to require an occurrence, which meant an honest log on an
 * unscheduled day had nowhere to go and the only way to record reality was to
 * wait for a slot. Occurrence-less entries still count toward the streak, since
 * computeStreak folds over entries by local date, not by occurrence.
 *
 * `local_date` comes from the goal's own timezone rather than the server's — the
 * server's idea of today is not the user's, especially late at night.
 */
export async function logUnprompted(formData: FormData): Promise<void> {
  const goalId = String(formData.get('goalId') ?? '')
  const rawValue = formData.get('value')
  const note = String(formData.get('note') ?? '').trim()
  const forDate = String(formData.get('localDate') ?? '').trim()
  if (!goalId) return

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return

  const { data: goalRow } = await supabase
    .from('goals')
    .select('id, metric_key')
    .eq('id', goalId)
    .maybeSingle()
  const goal = goalRow as unknown as { id: string; metric_key: string | null } | null
  if (!goal) return

  const { data: scheduleRow } = await supabase
    .from('goal_schedules')
    .select('timezone')
    .eq('goal_id', goalId)
    .limit(1)
    .maybeSingle()
  const zone = (scheduleRow as unknown as { timezone: string } | null)?.timezone ?? 'UTC'

  const parsed = rawValue == null || String(rawValue).trim() === '' ? null : Number(rawValue)
  const value = parsed != null && Number.isFinite(parsed) ? parsed : null

  // A measurement without a number violates the CHECK on goal_entries, and a
  // measuring goal logged with no value tells us nothing anyway.
  if (goal.metric_key && value == null) return

  const localDate = /^\d{4}-\d{2}-\d{2}$/.test(forDate)
    ? forDate
    : safeLocalDate(zone)

  const { error } = await supabase.from('goal_entries').insert({
    goal_id: goalId,
    occurrence_id: null,
    user_id: user.id,
    local_date: localDate,
    kind: goal.metric_key ? 'measurement' : 'completed',
    value,
    note: note || null,
    source: 'web',
    // A fresh id per unprompted log — unlike the occurrence-bound path, logging
    // twice in a day here is legitimate (two weigh-ins, two workouts).
    client_entry_id: randomUUID(),
  })
  if (error) throw new Error(`Could not save that: ${error.message}`)

  await recomputeGoalStats(supabase, [goalId])
  revalidatePath('/goals')
  revalidatePath(`/goals/${goalId}`)
}

function safeLocalDate(zone: string): string {
  try {
    return localDateInZone(new Date(), zone)
  } catch {
    return localDateInZone(new Date(), 'UTC')
  }
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

  await recomputeGoalStats(supabase, [goalId])
  revalidatePath('/goals')
  revalidatePath(`/goals/${goalId}`)
}

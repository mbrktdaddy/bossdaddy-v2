'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { recomputeGoalStats } from '@/lib/goals/stats'
import { localDateInZone } from '@/lib/goals/recurrence'
import { logOccurrenceEntry, logOffDayEntry } from '@/lib/goals/log'

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
 * The write itself — the status guard, the occurrence-id idempotency key, the
 * catch-up kind — lives in lib/goals/log.ts, shared with the one-tap email route
 * and the Boss's log_goal_entry tool. This wrapper is the form contract: pull the
 * fields, hand them over, revalidate.
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

  const parsed = rawValue == null || String(rawValue).trim() === '' ? null : Number(rawValue)

  await logOccurrenceEntry(supabase, {
    occurrenceId,
    userId: user.id,
    action,
    value: parsed,
    source: 'web',
  })

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

  const { data: scheduleRow } = await supabase
    .from('goal_schedules')
    .select('timezone')
    .eq('goal_id', goalId)
    .limit(1)
    .maybeSingle()
  const zone = (scheduleRow as unknown as { timezone: string } | null)?.timezone ?? 'UTC'

  const parsed = rawValue == null || String(rawValue).trim() === '' ? null : Number(rawValue)

  await logOffDayEntry(supabase, {
    goalId,
    userId: user.id,
    // The goal's own zone, not the server's — the server's idea of today is not
    // the user's, especially late at night.
    localDate: /^\d{4}-\d{2}-\d{2}$/.test(forDate) ? forDate : safeLocalDate(zone),
    value: parsed,
    note,
    source: 'web',
  })

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

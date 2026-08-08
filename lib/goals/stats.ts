// Recomputes the derived numbers in `goal_stats`.
//
// Everything here is a fold over data that already exists, so a stats row is
// never authoritative — drop the table and it rebuilds. That's deliberate: a
// stored streak is a number that can be wrong, and a wrong streak either robs
// someone of a day they earned or credits one they didn't.
//
// BULK BY DEFAULT. The single-goal case (someone taps "log it") calls the same
// function with one id, so there's one code path and the query count is fixed at
// four regardless of how many goals a sweep tick touched. Recomputing per goal
// would have quietly undone the sweep's batching.

import 'server-only'
import { targetForDate, type CurveInput } from '@/lib/goals/curve'
import { localDateInZone } from '@/lib/goals/recurrence'
import {
  computeStreak, adherenceRate, latestValue,
  type EntryLike, type OccurrenceLike,
} from '@/lib/goals/progress'

/** Minimal client shape — works with both the session and service-role clients. */
type Queryable = {
  from: (table: string) => any   // eslint-disable-line @typescript-eslint/no-explicit-any
}

type GoalRow = CurveInput & { id: string; user_id: string }

export async function recomputeGoalStats(
  client: Queryable,
  goalIds: string[],
  now: Date = new Date(),
): Promise<{ updated: number; errors: string[] }> {
  const ids = [...new Set(goalIds)].filter(Boolean)
  if (!ids.length) return { updated: 0, errors: [] }

  const errors: string[] = []

  const [goalsRes, schedulesRes, occurrencesRes, entriesRes] = await Promise.all([
    client.from('goals')
      .select('id, user_id, curve, baseline_value, target_value, started_on, target_date, step_every_days')
      .in('id', ids),
    client.from('goal_schedules').select('goal_id, timezone').in('goal_id', ids),
    client.from('goal_occurrences')
      .select('goal_id, local_date, status, target_value, due_at')
      .in('goal_id', ids),
    client.from('goal_entries')
      .select('goal_id, local_date, kind, value')
      .in('goal_id', ids),
  ])

  for (const [label, res] of [
    ['goals', goalsRes], ['schedules', schedulesRes],
    ['occurrences', occurrencesRes], ['entries', entriesRes],
  ] as const) {
    if (res.error) errors.push(`stats/${label}: ${res.error.message}`)
  }

  const goals = (goalsRes.data ?? []) as GoalRow[]
  if (!goals.length) return { updated: 0, errors }

  type ScheduleRow = { goal_id: string; timezone: string }
  type OccRow = OccurrenceLike & { goal_id: string; due_at: string }
  type EntRow = EntryLike & { goal_id: string }

  const schedules = (schedulesRes.data ?? []) as ScheduleRow[]
  const occurrences = (occurrencesRes.data ?? []) as OccRow[]
  const entries = (entriesRes.data ?? []) as EntRow[]
  const nowMs = now.getTime()

  const rows = goals.map((goal) => {
    // A goal's zone comes from its first schedule. A goal with no schedule can't
    // have a meaningful "today", so it falls back to UTC and simply won't show a
    // today-target (the reader's freshness check will disagree).
    const zone = schedules.find((s) => s.goal_id === goal.id)?.timezone ?? 'UTC'
    const today = safeLocalDate(now, zone)

    const mine = occurrences.filter((o) => o.goal_id === goal.id)
    const mineEntries = entries.filter((e) => e.goal_id === goal.id)

    const { done, total } = adherenceRate(mine)
    const latest = latestValue(mineEntries)

    // Unresolved AND already due. A day that hasn't arrived isn't "open".
    const open = mine.filter((o) =>
      isUnresolved(o.status) && new Date(o.due_at).getTime() <= nowMs)

    const upcoming = mine
      .filter((o) => new Date(o.due_at).getTime() > nowMs)
      .sort((a, b) => a.due_at.localeCompare(b.due_at))[0]

    const todays = mine.find((o) => o.local_date === today)

    return {
      goal_id: goal.id,
      user_id: goal.user_id,
      streak: computeStreak(mineEntries, today),
      logged_done: done,
      logged_total: total,
      latest_value: latest?.value ?? null,
      latest_local_date: latest?.localDate ?? null,
      open_count: open.length,
      next_due_at: upcoming?.due_at ?? null,
      today_local_date: today,
      // Prefer the target already stamped on today's occurrence; fall back to
      // evaluating the curve for goals whose day hasn't been materialized.
      today_target: todays?.target_value ?? targetForDate(goal, today),
      computed_at: now.toISOString(),
    }
  })

  const { error } = await client
    .from('goal_stats')
    .upsert(rows, { onConflict: 'goal_id' })
  if (error) {
    errors.push(`stats/upsert: ${error.message}`)
    return { updated: 0, errors }
  }
  return { updated: rows.length, errors }
}

function isUnresolved(status: string): boolean {
  return status === 'pending' || status === 'notified'
    || status === 'missed' || status === 'snoozed'
}

/** A bad zone must never take down a stats recompute. */
function safeLocalDate(now: Date, zone: string): string {
  try {
    return localDateInZone(now, zone)
  } catch {
    return localDateInZone(now, 'UTC')
  }
}

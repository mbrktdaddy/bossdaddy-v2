// The one place a goal entry is written.
//
// Three callers now log the same thing three ways, and they must not drift: the
// goals UI (Server Actions, session client), the one-tap link from a reminder
// (`/api/goals/tap`, admin client — it's authenticated by a signed token, not a
// cookie), and the Boss (`log_goal_entry`, session client). Before this module the
// first two were independent copies of the same twenty lines; a third copy for the
// Boss is what "tools are thin wrappers over the same domain service, never
// reimplementations" exists to prevent.
//
// The client is a PARAMETER rather than created here, so each caller keeps the
// auth story it needs — RLS-scoped for the UI and the Boss, service-role for the
// cron-adjacent tap route — and this module never decides who you are.
//
// WHAT IT DOESN'T DO: no `revalidatePath`, no redirects, no HTTP. Callers own
// their own cache invalidation and their own idea of what to say afterwards. That
// asymmetry is the reason the Boss can call it mid-stream.

import 'server-only'
import { randomUUID } from 'node:crypto'
import { recomputeGoalStats } from '@/lib/goals/stats'

/** Minimal client shape — works with the session and service-role clients alike. */
type Queryable = {
  from: (table: string) => any   // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type LogSource = 'web' | 'push' | 'email' | 'boss' | 'offline_sync' | 'import'
export type EntryKind = 'completed' | 'skipped' | 'catchup' | 'relapse' | 'measurement'

/** Thrown for genuine DB failures. A save that quietly does nothing is the worst
 *  outcome for a medication log, so callers must decide — the UI throws on to
 *  error.tsx, the Boss turns it into a sentence. */
export class GoalLogError extends Error {}

export type OccurrenceLogResult = {
  /** 'logged' — this call wrote it. 'already_resolved' — someone got there first
   *  (a double submit, or the same day tapped from the email and the web). */
  outcome: 'logged' | 'already_resolved' | 'not_found'
  goalId: string | null
  entryId: string | null
  localDate: string | null
  kind: EntryKind | null
  value: number | null
}

/**
 * Resolve one scheduled occurrence and write its log entry.
 *
 * `client_entry_id` is the OCCURRENCE ID, not a fresh uuid — that's what makes
 * logging the same day twice (once in the app, once from the reminder email on the
 * way to the car) a no-op instead of a double-counted dose. The unique index on
 * (user_id, client_entry_id) is the enforcement; 23505 is the intended outcome of
 * a race, not an error.
 *
 * The status update is GUARDED on the current status so a double submit resolves
 * exactly once, and `missed` stays loggable — catch-up is always available and
 * never demanded.
 */
export async function logOccurrenceEntry(
  client: Queryable,
  args: {
    occurrenceId: string
    userId: string
    action: 'completed' | 'skipped'
    value?: number | null
    source?: LogSource
  },
): Promise<OccurrenceLogResult> {
  const empty: OccurrenceLogResult = {
    outcome: 'not_found', goalId: null, entryId: null, localDate: null, kind: null, value: null,
  }
  if (!args.occurrenceId || !args.userId) return empty

  // ⚠️ OWNERSHIP IS CHECKED HERE, NOT LEFT TO RLS.
  //
  // This looked the occurrence up by id alone. Safe until migration 137, which
  // gave teammates read on goal_occurrences — and `goal_entries_owner_write` only
  // asserts `user_id = auth.uid()`, NOT that the goal belongs to the writer. So a
  // teammate could resolve someone else's occurrence and write an entry against
  // their goal under their own user id. The row would even look legitimate.
  //
  // The teammate WRITE path is deliberately unbuilt (migration 137 defers it), so
  // owner-only is the correct rule today. When it IS built it lands here, and it
  // needs `logged_by` — it must not be re-enabled by loosening this lookup.
  const { data: occurrenceRow } = await client
    .from('goal_occurrences')
    .select('id, goal_id, status, local_date')
    .eq('id', args.occurrenceId)
    .eq('user_id', args.userId)
    .maybeSingle()
  const occurrence = occurrenceRow as
    { id: string; goal_id: string; status: string; local_date: string } | null
  if (!occurrence) return empty

  const wasCatchup = occurrence.status === 'missed'
  const kind: EntryKind =
    args.action === 'skipped' ? 'skipped' : wasCatchup ? 'catchup' : 'completed'
  const value = normalizeValue(args.value)

  const { data: updated, error: updateError } = await client
    .from('goal_occurrences')
    .update({ status: args.action, resolved_at: new Date().toISOString(), snoozed_until: null })
    .eq('id', occurrence.id)
    .in('status', ['pending', 'notified', 'snoozed', 'missed'])
    .select('id')
  if (updateError) throw new GoalLogError(`Could not update that day: ${updateError.message}`)

  let entryId: string | null = null
  let outcome: OccurrenceLogResult['outcome'] = 'already_resolved'

  // Zero rows means someone already resolved it — the entry is already there, so
  // find its id rather than reporting nothing. Undo needs a handle either way.
  if (updated?.length) {
    const { data: inserted, error } = await client
      .from('goal_entries')
      .insert({
        goal_id: occurrence.goal_id,
        occurrence_id: occurrence.id,
        user_id: args.userId,
        // The occurrence's OWN local date. Never a date derived on the server,
        // whose "today" is not the user's.
        local_date: occurrence.local_date,
        kind,
        value,
        source: args.source ?? 'web',
        client_entry_id: occurrence.id,
      })
      .select('id')
      .maybeSingle()

    if (error && error.code !== '23505') {
      throw new GoalLogError(`Could not save that entry: ${error.message}`)
    }
    if (inserted) {
      entryId = (inserted as { id: string }).id
      outcome = 'logged'
    }
  }

  if (!entryId) {
    const { data: existing } = await client
      .from('goal_entries')
      .select('id')
      .eq('user_id', args.userId)
      .eq('client_entry_id', occurrence.id)
      .maybeSingle()
    entryId = (existing as { id: string } | null)?.id ?? null
  }

  await recomputeGoalStats(client, [occurrence.goal_id])

  return {
    outcome,
    goalId: occurrence.goal_id,
    entryId,
    localDate: occurrence.local_date,
    kind,
    value,
  }
}

export type OffDayLogResult = {
  outcome: 'logged' | 'needs_value' | 'not_found'
  goalId: string | null
  entryId: string | null
  localDate: string | null
  kind: EntryKind | null
  value: number | null
}

/**
 * Log something that wasn't scheduled — an extra workout, a weigh-in nobody asked
 * for, an honest count on a day nothing was due.
 *
 * Occurrence-less entries still count toward the streak and toward votes, because
 * both fold over entries by local date rather than by occurrence. Before this path
 * existed, an honest log on an off day had nowhere to go.
 *
 * `client_entry_id` is a FRESH uuid here, unlike the occurrence-bound path: two
 * weigh-ins or two walks in one day are both legitimate, so there's nothing to
 * dedupe against.
 */
export async function logOffDayEntry(
  client: Queryable,
  args: {
    goalId: string
    userId: string
    localDate: string
    value?: number | null
    note?: string | null
    /** Overrides the kind derived from whether the goal measures something. */
    kind?: EntryKind
    source?: LogSource
  },
): Promise<OffDayLogResult> {
  const empty: OffDayLogResult = {
    outcome: 'not_found', goalId: null, entryId: null, localDate: null, kind: null, value: null,
  }
  if (!args.goalId || !args.userId) return empty

  const { data: goalRow } = await client
    .from('goals')
    .select('id, metric_key')
    .eq('id', args.goalId)
    .maybeSingle()
  const goal = goalRow as { id: string; metric_key: string | null } | null
  if (!goal) return empty

  const value = normalizeValue(args.value)

  // A measuring goal logged with no number tells us nothing, and a `measurement`
  // row without a value violates the CHECK on goal_entries.
  const kind: EntryKind = args.kind ?? (goal.metric_key ? 'measurement' : 'completed')
  if (kind === 'measurement' && value == null) {
    return { ...empty, outcome: 'needs_value', goalId: goal.id }
  }

  const { data: inserted, error } = await client
    .from('goal_entries')
    .insert({
      goal_id: goal.id,
      occurrence_id: null,
      user_id: args.userId,
      local_date: args.localDate,
      kind,
      value,
      note: args.note?.trim() || null,
      source: args.source ?? 'web',
      client_entry_id: randomUUID(),
    })
    .select('id')
    .single()
  if (error) throw new GoalLogError(`Could not save that: ${error.message}`)

  await recomputeGoalStats(client, [goal.id])

  return {
    outcome: 'logged',
    goalId: goal.id,
    entryId: (inserted as { id: string }).id,
    localDate: args.localDate,
    kind,
    value,
  }
}

/**
 * Remove an entry — the undo behind "scratch that".
 *
 * Migration 134 gave `goal_entries` full owner control precisely because "a
 * mis-tap has to be fixable", and until this function existed nothing in the app
 * actually delivered on that.
 *
 * When the entry was bound to a scheduled occurrence, that occurrence goes back to
 * `pending` with `resolved_at` cleared, because it genuinely is unresolved again.
 * Two consequences, both wanted: TODAY's day becomes due again (correct — he
 * un-logged it), and an OLD day gets re-marked `missed` by the sweep's age-out
 * pass, silently. Neither can produce a duplicate nudge: the outbox is unique per
 * (occurrence, channel), so a reminder that already went out can't go out twice.
 */
export async function deleteGoalEntry(
  client: Queryable,
  args: { entryId: string; userId: string },
): Promise<{ outcome: 'deleted' | 'not_found'; goalId: string | null; localDate: string | null }> {
  if (!args.entryId || !args.userId) return { outcome: 'not_found', goalId: null, localDate: null }

  const { data: entryRow } = await client
    .from('goal_entries')
    .select('id, goal_id, occurrence_id, local_date')
    .eq('id', args.entryId)
    .maybeSingle()
  const entry = entryRow as
    { id: string; goal_id: string; occurrence_id: string | null; local_date: string } | null
  if (!entry) return { outcome: 'not_found', goalId: null, localDate: null }

  // RLS scopes this to the owner; the explicit user_id is belt and braces for the
  // service-role callers, which have no policy to fall back on.
  const { error } = await client
    .from('goal_entries')
    .delete()
    .eq('id', entry.id)
    .eq('user_id', args.userId)
  if (error) throw new GoalLogError(`Could not undo that: ${error.message}`)

  if (entry.occurrence_id) {
    const { error: revertError } = await client
      .from('goal_occurrences')
      .update({ status: 'pending', resolved_at: null })
      .eq('id', entry.occurrence_id)
    if (revertError) {
      throw new GoalLogError(`Undid the entry but couldn't reopen the day: ${revertError.message}`)
    }
  }

  await recomputeGoalStats(client, [entry.goal_id])

  return { outcome: 'deleted', goalId: entry.goal_id, localDate: entry.local_date }
}

function normalizeValue(value: number | null | undefined): number | null {
  if (value == null) return null
  return Number.isFinite(value) ? value : null
}

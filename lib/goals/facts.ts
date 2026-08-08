// Everything true about a goal right now, in one object.
//
// THIS EXISTS SO THE MODEL NEVER DOES ARITHMETIC. Whether a day was a miss,
// whether the number beat the target, how many votes the plan has, which day of it
// he's on — all of it is computed here and handed over as facts. A model that
// counts votes will eventually count them wrong, and on a cessation goal a wrong
// number isn't a glitch, it's a lie about someone's week.
//
// Read-only and client-agnostic, so the Boss's tools, a future /today view, and
// anything else that has to describe a goal all describe it the same way.

import 'server-only'
import { localDateInZone } from '@/lib/goals/recurrence'
import { targetForDate, type CurveInput } from '@/lib/goals/curve'
import { compareToTarget, planWindow, VOTE_KINDS } from '@/lib/goals/progress'

/** Minimal client shape — works with the session and service-role clients alike. */
type Queryable = {
  from: (table: string) => any   // eslint-disable-line @typescript-eslint/no-explicit-any
}

export type GoalFacts = {
  goalId: string
  title: string
  kind: string
  status: string

  /** What it measures, if anything. `unit` is display-ready (" per day"). */
  metricKey: string | null
  metricUnit: string | null
  direction: string | null

  /** Identity, or nulls when he never set one — then the caller uses plain
   *  process language. Never invent one. */
  identityStatement: string | null
  identityShort: string | null

  /** Edge OFF: cessation, medication, anything where a slip is a hard day.
   *  Carried from the template that started the goal (migration 136). */
  sensitive: boolean

  /** The user's calendar date in this goal's own zone — never the server's. */
  today: string
  timezone: string

  /** Votes in the CURRENT plan window. null when there's no identity to vote for. */
  votes: number | null
  dayInPlan: number | null
  planDays: number | null

  streak: number | null
  todayTarget: number | null
  latestValue: number | null
  openCount: number | null
}

export async function loadGoalFacts(
  client: Queryable,
  goalId: string,
  now: Date = new Date(),
): Promise<GoalFacts | null> {
  const { data: goalRow } = await client
    .from('goals')
    .select(
      'id, title, kind, status, metric_key, metric_unit, direction, curve, baseline_value, ' +
      'target_value, step_every_days, started_on, target_date, identity_statement, ' +
      'identity_short, config',
    )
    .eq('id', goalId)
    .maybeSingle()

  const goal = goalRow as (CurveInput & {
    id: string
    title: string
    kind: string
    status: string
    metric_key: string | null
    metric_unit: string | null
    direction: string | null
    identity_statement: string | null
    identity_short: string | null
    config: Record<string, unknown> | null
  }) | null
  if (!goal) return null

  const [{ data: scheduleRow }, { data: statRow }] = await Promise.all([
    client.from('goal_schedules').select('timezone').eq('goal_id', goalId).limit(1).maybeSingle(),
    client.from('goal_stats')
      .select('streak, latest_value, open_count')
      .eq('goal_id', goalId)
      .maybeSingle(),
  ])

  const timezone = (scheduleRow as { timezone: string } | null)?.timezone ?? 'UTC'
  const today = safeLocalDate(now, timezone)
  const stats = statRow as
    { streak: number; latest_value: number | null; open_count: number } | null

  // Votes only mean something when there's an identity to vote for. Without one
  // the caller falls back to process language, so the count isn't even fetched.
  const identityStatement = goal.identity_statement
  const win = identityStatement ? planWindow(goal.started_on, goal.target_date, today) : null

  let votes: number | null = null
  if (win) {
    const { count, error } = await client
      .from('goal_entries')
      .select('id', { count: 'exact', head: true })
      .eq('goal_id', goalId)
      .in('kind', [...VOTE_KINDS])
      .gte('local_date', win.start)
      .lte('local_date', win.end)
    // Null rather than 0 on failure: a zero would read as "you've done nothing."
    if (!error) votes = count ?? 0
  }

  return {
    goalId: goal.id,
    title: goal.title,
    kind: goal.kind,
    status: goal.status,
    metricKey: goal.metric_key,
    metricUnit: goal.metric_unit,
    direction: goal.direction,
    identityStatement,
    identityShort: goal.identity_short,
    sensitive: (goal.config as { sensitive?: unknown } | null)?.sensitive === true,
    today,
    timezone,
    votes,
    dayInPlan: win ? win.dayInPlan : null,
    planDays: win?.planDays ?? null,
    streak: stats?.streak ?? null,
    todayTarget: targetForDate(goal, today),
    latestValue: stats?.latest_value ?? null,
    openCount: stats?.open_count ?? null,
  }
}

/**
 * Did the logged number beat the day's target? Returns null when there's nothing
 * to compare, which is the common case — most goals are "did it or didn't".
 *
 * NOTE THIS IS NOT THE VOTE RULE. Missing the target does not cost a vote (see
 * VOTE_KINDS). It's here so the Boss can say "that's under your number today"
 * when it's true, and say nothing when it isn't.
 */
export function targetVerdict(
  value: number | null,
  target: number | null,
  direction: string | null,
): 'better' | 'met' | 'over' | null {
  if (value == null || target == null) return null
  return compareToTarget(value, target, direction)
}

function safeLocalDate(now: Date, zone: string): string {
  try {
    return localDateInZone(now, zone)
  } catch {
    return localDateInZone(now, 'UTC')
  }
}

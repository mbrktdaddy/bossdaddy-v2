// Turning "smoked 4 today" into one specific goal row.
//
// The Boss gets a phrase, not an id. Something has to decide that "smoking" means
// the Quit-smoking taper — and that something must NEVER GUESS, because the cost
// of guessing wrong is an entry in the wrong log, and on a medication goal that's
// a record saying he took a dose he didn't.
//
// So resolution is deliberately conservative: an exact match wins, a single
// partial match wins, and ANYTHING ELSE comes back as `ambiguous` with the
// candidates so the Boss asks a one-line question instead of picking a favourite.
// The only inference allowed is the safe one — when a dad has exactly one goal, "log
// it" can only mean that goal.
//
// `pickGoalByHint` is pure and exported for tests: it's the part that can be
// subtly, silently wrong.

import 'server-only'

/** Minimal client shape — works with the session and service-role clients alike. */
type Queryable = {
  from: (table: string) => any   // eslint-disable-line @typescript-eslint/no-explicit-any
}

export const GOAL_PICK_COLUMNS =
  'id, title, kind, status, metric_key, metric_unit, direction, curve, baseline_value, ' +
  'target_value, step_every_days, started_on, target_date, identity_statement, identity_short'

export type PickableGoal = {
  id: string
  title: string
  kind: string
  status: string
  metric_key: string | null
  metric_unit: string | null
  direction: string | null
  curve: string
  baseline_value: number | null
  target_value: number | null
  step_every_days: number | null
  started_on: string
  target_date: string | null
  identity_statement: string | null
  identity_short: string | null
}

export type StatRow = {
  goal_id: string
  streak: number
  logged_done: number
  logged_total: number
  open_count: number
  next_due_at: string | null
  today_local_date: string | null
  today_target: number | null
  latest_value: number | null
}

// A dad with more than this many active goals has a different problem, and an
// unbounded list would put his whole history in a prompt.
const MAX_GOALS = 25

/**
 * The goals a log could plausibly land on. Archived and completed goals are
 * excluded — logging into something he closed out is never what he meant — but
 * PAUSED goals stay in, because pausing silences reminders and does not mean he
 * stopped doing the thing.
 */
export async function loadPickableGoals(
  client: Queryable,
  opts: { includePaused?: boolean } = {},
): Promise<PickableGoal[]> {
  const statuses = opts.includePaused === false ? ['active'] : ['active', 'paused']
  const { data, error } = await client
    .from('goals')
    .select(GOAL_PICK_COLUMNS)
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .limit(MAX_GOALS)
  if (error) return []
  return (data ?? []) as PickableGoal[]
}

/** One batched read of the derived numbers for a set of goals. */
export async function loadStatsFor(
  client: Queryable,
  goalIds: string[],
): Promise<Map<string, StatRow>> {
  const out = new Map<string, StatRow>()
  if (!goalIds.length) return out
  const { data } = await client
    .from('goal_stats')
    .select('goal_id, streak, logged_done, logged_total, open_count, next_due_at, today_local_date, today_target, latest_value')
    .in('goal_id', goalIds)
  for (const row of (data ?? []) as StatRow[]) out.set(row.goal_id, row)
  return out
}

export type PickResult =
  | { kind: 'match'; goal: PickableGoal }
  | { kind: 'ambiguous'; candidates: PickableGoal[] }
  | { kind: 'none' }

// Words that name no goal in particular. "log it" after a sentence about smoking
// is normal speech, and with one goal on the board it's unambiguous.
const GENERIC = new Set([
  'it', 'that', 'this', 'them', 'those', 'mine', 'my goal', 'the goal',
  'my habit', 'the habit', 'my plan', 'the plan', 'today', 'goal', 'habit', 'plan',
])

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Ignored when overlapping words: they match everything and would make two
// unrelated goals look like the same one.
const STOPWORDS = new Set([
  'my', 'the', 'a', 'an', 'and', 'or', 'for', 'to', 'of', 'on', 'in', 'at',
  'log', 'logged', 'take', 'took', 'get', 'got', 'do', 'did', 'done', 'goal',
  'every', 'day', 'daily', 'today', 'yesterday', 'week', 'weekly', 'more', 'less',
])

/**
 * Match a spoken hint to exactly one goal, or refuse.
 *
 * Order matters: each rung is a stronger claim than the one below it, and the
 * first rung that lands on exactly ONE goal wins. Two goals on the same rung is
 * ambiguity, not a tie to be broken — "cut back" with both a smoking and a
 * drinking taper on the board has to become a question.
 */
export function pickGoalByHint(goals: PickableGoal[], hint: string): PickResult {
  if (!goals.length) return { kind: 'none' }

  const raw = (hint ?? '').trim()
  const needle = raw.toLowerCase()

  // 0. No hint, or a pronoun. Safe only when there's nothing to confuse it with.
  if (!needle || GENERIC.has(needle)) {
    return goals.length === 1
      ? { kind: 'match', goal: goals[0] }
      : { kind: 'ambiguous', candidates: goals }
  }

  // 1. An id, straight from a previous list_goals call.
  if (UUID.test(raw)) {
    const byId = goals.find((g) => g.id.toLowerCase() === needle)
    return byId ? { kind: 'match', goal: byId } : { kind: 'none' }
  }

  // 2. The exact title.
  const exact = goals.filter((g) => g.title.trim().toLowerCase() === needle)
  if (exact.length === 1) return { kind: 'match', goal: exact[0] }
  if (exact.length > 1) return { kind: 'ambiguous', candidates: exact }

  // 3. The hint appears in the title, or names the thing being counted
  //    ("cigarettes" → the taper that measures cigarettes).
  const contains = goals.filter(
    (g) =>
      g.title.toLowerCase().includes(needle)
      || (g.metric_key ?? '').toLowerCase().includes(needle)
      || needle.includes(g.title.trim().toLowerCase()),
  )
  if (contains.length === 1) return { kind: 'match', goal: contains[0] }
  if (contains.length > 1) return { kind: 'ambiguous', candidates: contains }

  // 4. Any real word in common, compared by STEM — people don't inflect their
  //    speech to match a title. "lifting session" has to find "Lift three times a
  //    week", and "smoked 4" has to find "Quit smoking"; neither is a substring of
  //    the other in either direction.
  //
  //    Last rung, and the loosest — a single overlap is enough ONLY because two
  //    overlaps come back as ambiguous. Every extra bit of fuzziness here buys a
  //    question, never a wrong write.
  const words = tokenize(needle)
  if (words.length) {
    const overlap = goals.filter((g) => {
      const hay = tokenize(`${g.title} ${g.metric_key ?? ''} ${g.metric_unit ?? ''}`)
      return words.some((w) => hay.some((h) => sharesStem(w, h)))
    })
    if (overlap.length === 1) return { kind: 'match', goal: overlap[0] }
    if (overlap.length > 1) return { kind: 'ambiguous', candidates: overlap }
  }

  return { kind: 'none' }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}

/**
 * Same word, allowing for how it was conjugated: smoke/smoking, lift/lifting,
 * walk/walked, cigarette/cigarettes.
 *
 * A shared four-character prefix rather than a real stemmer — four is long enough
 * that collisions are rare, short enough to survive an -ing or an -ed, and a
 * collision that does happen lands on two goals and becomes a question.
 */
function sharesStem(a: string, b: string): boolean {
  if (a === b) return true
  if (a.length < 4 || b.length < 4) return false
  return a.slice(0, 4) === b.slice(0, 4)
}

/**
 * The compact shape the model reads. Derived numbers come from `goal_stats`, which
 * the sweep and every log keep current — the model is never asked to work out a
 * streak or a target from a list of entries.
 */
export function summarizeGoalForModel(goal: PickableGoal, stat: StatRow | undefined) {
  return {
    goal_id: goal.id,
    title: goal.title,
    kind: goal.kind,
    status: goal.status,
    tracks: goal.metric_key,
    unit: goal.metric_unit,
    identity: goal.identity_statement,
    identity_short: goal.identity_short,
    started_on: goal.started_on,
    target_date: goal.target_date,
    // Stamped with the date it was computed for, so a stale row can't pass a
    // yesterday's number off as today's.
    today_target: stat?.today_local_date && stat.today_target != null ? stat.today_target : null,
    days_running: stat?.streak ?? 0,
    open_now: stat?.open_count ?? 0,
    next_due_at: stat?.next_due_at ?? null,
    last_logged_value: stat?.latest_value ?? null,
  }
}

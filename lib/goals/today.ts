// What's open right now, across every goal — the one query behind /today and every
// TodayCard.
//
// ─────────────────────────────────────────────────────────────────────────────
// WHY THIS IS A MODULE AND NOT INLINE ON THE PAGE
//
// This lived inside app/(public)/today/page.tsx. The moment the same summary had to
// appear on /goals, /tools and /account, a copy of "what counts as due" would have
// existed in four places — and the copies would drift, so a card would eventually
// say "2 waiting on you" and link to a page listing three. Same reasoning as
// lib/goals/revalidate.ts: one list, several callers.
//
// ZONE-AGNOSTIC BY CONSTRUCTION. There is no global "today" here, because there
// isn't one: every schedule carries its own IANA zone (migration 134, decision 2),
// so a man travelling has two goals whose calendar date differs. Nothing in this
// module computes a date. It splits on `due_at` against real time — due now, or
// coming later — and each row carries its OWN local_date and local_time for
// display. Do not add a "today" parameter here; the surfaces that genuinely need a
// calendar (the week strip) resolve a zone themselves and say that they're
// approximating.
// ─────────────────────────────────────────────────────────────────────────────

import 'server-only'
import { buildHistoryGrid, gridWindow, type HistoryCell } from '@/lib/goals/history'
import { localDateInZone } from '@/lib/goals/recurrence'

/** Minimal client shape — works with the session and service-role clients alike. */
type Queryable = {
  from: (table: string) => any   // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * How far ahead "coming up" reaches. 16 hours covers the rest of the day in any zone
 * the app supports without turning this into a week view.
 */
export const TODAY_LOOKAHEAD_HOURS = 16

/** Statuses that mean a day is still asking for something. */
const OPEN_STATUSES = ['pending', 'notified', 'snoozed', 'missed'] as const

export type TodayOccurrence = {
  id: string
  goal_id: string
  local_date: string
  local_time: string
  status: string
  target_value: number | null
  due_at: string
  shifted: boolean
}

export type TodayGoal = {
  id: string
  title: string
  status: string
  metric_key: string | null
  metric_unit: string | null
  identity_short: string | null
}

export type TodayWork = {
  /** Due at or before now, oldest first. This is the work. */
  dueNow: TodayOccurrence[]
  /** Coming later within the lookahead, soonest first. */
  later: TodayOccurrence[]
  goals: Map<string, TodayGoal>
  /**
   * Active goals this user owns, whether or not anything is due — the difference
   * between "all clear" and "nothing set up yet". A card that can't tell those apart
   * either nags a man with no goals or hides a clear day from one who has them.
   */
  activeGoalCount: number
}

export async function loadTodayWork(
  client: Queryable,
  userId: string,
  now: Date = new Date(),
  opts: { lookaheadHours?: number } = {},
): Promise<TodayWork> {
  const empty: TodayWork = { dueNow: [], later: [], goals: new Map(), activeGoalCount: 0 }
  if (!userId) return empty

  const horizon = new Date(
    now.getTime() + (opts.lookaheadHours ?? TODAY_LOOKAHEAD_HOURS) * 3_600_000,
  )

  // RLS scopes these to the user; the explicit user_id filter is the app saying which
  // rows it MEANT (migration 137 gave teammates read on these tables, so RLS no longer
  // equals "mine"). The partial index on (due_at) where status='pending' is what keeps
  // this cheap as history grows — it's sized to the work queue, not to the log.
  const [occurrenceRes, countRes] = await Promise.all([
    client
      .from('goal_occurrences')
      .select('id, goal_id, local_date, local_time, status, target_value, due_at, shifted')
      .eq('user_id', userId)
      .in('status', OPEN_STATUSES)
      .lte('due_at', horizon.toISOString())
      .order('due_at', { ascending: true })
      .limit(60),
    client
      .from('goals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'active'),
  ])

  const occurrences = (occurrenceRes.data ?? []) as TodayOccurrence[]
  const activeGoalCount = (countRes.count as number | null) ?? 0
  if (!occurrences.length) return { ...empty, activeGoalCount }

  const goalIds = [...new Set(occurrences.map((o) => o.goal_id))]
  const { data: goalRows } = await client
    .from('goals')
    .select('id, title, status, metric_key, metric_unit, identity_short')
    .eq('user_id', userId)
    .in('id', goalIds)

  const goals = new Map(((goalRows ?? []) as TodayGoal[]).map((g) => [g.id, g]))

  // A PAUSED GOAL SHOULDN'T BE ASKING FOR ANYTHING. The sweep stops materializing new
  // days when a goal is paused, but days already on the books survive the pause —
  // dropping them here is what makes "paused" mean what it says. Same for a finished
  // plan: its occurrences are pruned, but a leftover row must never resurface as work.
  const live = occurrences.filter((o) => goals.get(o.goal_id)?.status === 'active')
  const nowMs = now.getTime()

  return {
    dueNow: live.filter((o) => new Date(o.due_at).getTime() <= nowMs),
    later: live.filter((o) => new Date(o.due_at).getTime() > nowMs),
    goals,
    activeGoalCount,
  }
}

// ── the week strip's data ───────────────────────────────────────────────────
//
// Extracted here alongside the work query so /today and every TodayCard draw the
// same seven days. It lived on the page; the card needing it too is exactly how two
// versions of "this week" would have appeared.

/**
 * ⚠️ THIS IS THE ONE PLACE THAT PICKS A ZONE, AND IT IS AN APPROXIMATION ON PURPOSE.
 *
 * `loadTodayWork` above is zone-agnostic by construction — it splits on `due_at`
 * against real time, and every row carries its own local_date. A seven-day calendar
 * cannot do that: it needs to know which day is "today", and a man travelling has
 * goals whose calendar date differs (migration 134, decision 2). So the strip uses
 * the zone MOST of his schedules are in and answers "how has my week gone", while the
 * rows underneath stay authoritative about what is actually due.
 */
export async function loadTodayWeek(
  client: Queryable,
  userId: string,
  now: Date = new Date(),
): Promise<{ cells: HistoryCell[]; todayLocal: string; zone: string }> {
  const { data: zoneRows } = await client
    .from('goal_schedules')
    .select('timezone')
    .eq('user_id', userId)

  const zone = majorityZone(((zoneRows ?? []) as { timezone: string }[]).map((z) => z.timezone))
  const todayLocal = safeLocalDate(now, zone)
  const window = gridWindow(todayLocal, 1)
  if (!window) return { cells: [], todayLocal, zone }

  const [{ data: occurrenceRows }, { data: entryRows }] = await Promise.all([
    client
      .from('goal_occurrences')
      .select('local_date, status, target_value')
      .eq('user_id', userId)
      .gte('local_date', window.from)
      .lte('local_date', window.to),
    client
      .from('goal_entries')
      .select('local_date, kind, value')
      .eq('user_id', userId)
      .gte('local_date', window.from)
      .lte('local_date', window.to),
  ])

  // Aggregated across goals, so a day reads "kept" when SOMETHING was logged — the
  // same partial-counts-as-kept rule the per-goal calendar uses, rather than a second,
  // stricter idea of a good day.
  return {
    cells: buildHistoryGrid({
      occurrences: (occurrenceRows ?? []) as {
        local_date: string; status: string; target_value: number | null
      }[],
      entries: (entryRows ?? []) as {
        local_date: string; kind: string; value: number | null
      }[],
      fromYmd: window.from,
      toYmd: window.to,
    }),
    todayLocal,
    zone,
  }
}

/**
 * The zone most of this user's schedules are in. Ties break toward the first seen,
 * which is stable enough for a view that says it approximates. No schedules means
 * nothing to approximate, so UTC — the strip then shows a week of "nothing due",
 * which is true.
 */
export function majorityZone(zones: string[]): string {
  const counts = new Map<string, number>()
  for (const zone of zones) counts.set(zone, (counts.get(zone) ?? 0) + 1)
  let best = 'UTC'
  let bestCount = 0
  for (const [zone, count] of counts) {
    if (count > bestCount) { best = zone; bestCount = count }
  }
  return best
}

/** A bad zone must never take down a page. Mirrors lib/goals/stats.ts. */
function safeLocalDate(now: Date, zone: string): string {
  try {
    return localDateInZone(now, zone)
  } catch {
    return localDateInZone(now, 'UTC')
  }
}

export type TodayPreviewItem = {
  id: string
  title: string
  /** The occurrence's OWN wall clock, HH:MM. Never derived in the server's zone. */
  time: string
  /** What the plan asks for today, when the goal measures something. */
  target: number | null
  unit: string | null
  /** "Present Dad" — how a man recognises his own goal faster than by its title. */
  identityShort: string | null
}

/**
 * The first few due items, named — what turns a card from a count into a preview.
 *
 * A headline alone ("2 waiting on you") makes the reader open the page to find out
 * what the two things ARE, which is the tap the card exists to save. Capped, because
 * a card that lists nine items is the page.
 */
export function todayPreviewItems(work: TodayWork, limit = 3): TodayPreviewItem[] {
  return work.dueNow.slice(0, limit).map((occurrence) => {
    const goal = work.goals.get(occurrence.goal_id)
    return {
      id: occurrence.id,
      title: goal?.title ?? 'Something',
      time: occurrence.local_time.slice(0, 5),   // Postgres `time` is HH:MM:SS
      target: occurrence.target_value,
      unit: goal?.metric_unit ?? null,
      identityShort: goal?.identity_short ?? null,
    }
  })
}

/**
 * The one-line summary a card shows. Pure, so the wording is testable without a
 * database and identical on every surface.
 *
 * Returns null when there is nothing to say at all — no active goals means no card,
 * because a Today card on an account with no goals is an advert, not information.
 */
export function summarizeTodayWork(work: TodayWork): {
  tone: 'due' | 'clear'
  headline: string
  detail: string | null
  cta: string
} | null {
  if (work.activeGoalCount === 0) return null

  if (work.dueNow.length > 0) {
    const first = work.dueNow[0]
    const title = work.goals.get(first.goal_id)?.title ?? null
    return {
      tone: 'due',
      headline: `${work.dueNow.length} waiting on you`,
      // Names the oldest open one, because that's the one most likely to be forgotten.
      detail: title,
      cta: 'Do it',
    }
  }

  const next = work.later[0]
  return {
    tone: 'clear',
    headline: 'All clear right now',
    // The occurrence's OWN wall clock — never a time derived in the server's zone.
    detail: next ? `Next at ${next.local_time.slice(0, 5)}` : null,
    cta: 'Look',
  }
}

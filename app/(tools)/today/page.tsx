// /today — everything that needs doing, across every goal, in one screen.
//
// The goal pages answer "how is this going". This one answers "what do I do right
// now", which is the question a dad actually opens the app with. It's the PWA's
// real home: one tap per row, no navigation, nothing to read.
//
// ZONE-AGNOSTIC BY CONSTRUCTION. There is no global "today" here, because there
// isn't one — every schedule carries its own IANA zone (migration 134, decision 2),
// so a man travelling has two goals whose "today" differ by a day. Rather than pick
// a zone and be wrong for one of them, this page splits on `due_at` against real
// time: due now, or coming later. Each row then shows the occurrence's OWN
// local_date, which is the date it counts for.
//
// Every row is a plain form bound to the same Server Action the goal page uses, so
// this works with JS disabled and has nothing to hydrate. The one client component
// is OfflineLogQueue, which is inert whenever the connection is up: it intercepts a
// submit only when the browser already reports itself offline, queues it locally,
// and drains when signal returns. The page itself is still NOT cached — see that
// component, and the note at the bottom of this file.

import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import OfflineLogQueue from '@/components/goals/OfflineLogQueue'
import WeekStrip from '@/components/goals/WeekStrip'
import { buildHistoryGrid, gridWindow } from '@/lib/goals/history'
import { localDateInZone } from '@/lib/goals/recurrence'
import { logOccurrence } from '../goals/actions'

export const metadata: Metadata = {
  title: LABELS.goals.todayTitle,
  robots: { index: false, follow: false },   // private data, never indexed
}

// How far ahead "coming up" reaches. 16 hours covers the rest of the day in any
// zone the app supports without turning this into a week view.
const LOOKAHEAD_HOURS = 16

const OPEN_STATUSES = ['pending', 'notified', 'snoozed', 'missed'] as const

type OccurrenceRow = {
  id: string
  goal_id: string
  local_date: string
  local_time: string
  status: string
  target_value: number | null
  due_at: string
  shifted: boolean
}

type GoalRow = {
  id: string
  title: string
  status: string
  metric_key: string | null
  metric_unit: string | null
  identity_short: string | null
}

export default async function TodayPage() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (!user) {
    return (
      <Wrap>
        <h1 className="text-2xl font-black text-prose">Sign in to see your day.</h1>
        <LoginLink className="mt-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Sign in →
        </LoginLink>
      </Wrap>
    )
  }

  const now = new Date()
  const horizon = new Date(now.getTime() + LOOKAHEAD_HOURS * 3_600_000)

  // RLS scopes both reads to this user. The partial index on (due_at) where
  // status='pending' (migration 134) is what keeps this cheap as history grows —
  // it's sized to the work queue, not to the log.
  const [{ data: occurrenceRows }, { data: zoneRows }] = await Promise.all([
    supabase
      .from('goal_occurrences')
      .select('id, goal_id, local_date, local_time, status, target_value, due_at, shifted')
      .eq('user_id', user.id)
      .in('status', OPEN_STATUSES)
      .lte('due_at', horizon.toISOString())
      .order('due_at', { ascending: true })
      .limit(60),
    supabase.from('goal_schedules').select('timezone').eq('user_id', user.id),
  ])

  const occurrences = (occurrenceRows ?? []) as unknown as OccurrenceRow[]

  // ⚠️ THE WEEK STRIP FORCES A ZONE, AND THIS PAGE DELIBERATELY HAS NO GLOBAL ONE.
  // Every schedule carries its own IANA zone (migration 134, decision 2), so a man
  // travelling genuinely has two goals whose "today" differ by a day — which is why
  // the rows below split on `due_at` against real time and each shows its own
  // local_date. A seven-day calendar can't be zone-agnostic, so the strip uses the
  // zone MOST of his schedules are in and is explicitly the approximate view: it
  // answers "how has my week gone", while the rows underneath stay authoritative
  // about what is actually due right now. Falls back to UTC with no schedules.
  const stripZone = majorityZone(((zoneRows ?? []) as { timezone: string }[]).map((z) => z.timezone))
  const stripToday = safeLocalDate(now, stripZone)
  const stripWindow = gridWindow(stripToday, 1)

  const goalIds = [...new Set(occurrences.map((o) => o.goal_id))]
  const [{ data: goalRows }, { data: weekOccurrenceRows }, { data: weekEntryRows }] =
    await Promise.all([
      goalIds.length
        ? supabase
            .from('goals')
            .select('id, title, status, metric_key, metric_unit, identity_short')
            .eq('user_id', user.id)
            .in('id', goalIds)
        : Promise.resolve({ data: [] }),
      // The whole week across EVERY goal, not just what's open — the strip's job is
      // the week behind you as much as the day in front of you.
      stripWindow
        ? supabase
            .from('goal_occurrences')
            .select('local_date, status, target_value')
            .eq('user_id', user.id)
            .gte('local_date', stripWindow.from)
            .lte('local_date', stripWindow.to)
        : Promise.resolve({ data: [] }),
      stripWindow
        ? supabase
            .from('goal_entries')
            .select('local_date, kind, value')
            .eq('user_id', user.id)
            .gte('local_date', stripWindow.from)
            .lte('local_date', stripWindow.to)
        : Promise.resolve({ data: [] }),
    ])

  // Aggregated across goals, so a day reads "kept" when SOMETHING was logged. That's
  // the same rule the per-goal grid uses for a two-dose day (partial counts as kept)
  // rather than a second, stricter idea of a good day.
  const weekCells = stripWindow
    ? buildHistoryGrid({
        occurrences: (weekOccurrenceRows ?? []) as unknown as
          { local_date: string; status: string; target_value: number | null }[],
        entries: (weekEntryRows ?? []) as unknown as
          { local_date: string; kind: string; value: number | null }[],
        fromYmd: stripWindow.from,
        toYmd: stripWindow.to,
      })
    : []

  const goals = new Map(
    ((goalRows ?? []) as unknown as GoalRow[]).map((g) => [g.id, g]),
  )

  // A paused goal shouldn't be asking for anything. The sweep stops materializing
  // new days when a goal is paused, but days already on the books survive the
  // pause — dropping them here is what makes "paused" mean what it says.
  const live = occurrences.filter((o) => goals.get(o.goal_id)?.status === 'active')

  const dueNow = live.filter((o) => new Date(o.due_at).getTime() <= now.getTime())
  const later = live.filter((o) => new Date(o.due_at).getTime() > now.getTime())

  return (
    <Wrap>
      <header className="space-y-2">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {LABELS.goals.todayEyebrow}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-prose leading-[1.05] tracking-tight">
          {dueNow.length > 0 ? LABELS.goals.todayHeading : LABELS.goals.todayClearHeading}
        </h1>
        <p className="text-base text-prose-muted leading-snug">
          {dueNow.length > 0
            ? `${dueNow.length} thing${dueNow.length === 1 ? '' : 's'} waiting on you.`
            : LABELS.goals.todayClearBody}
        </p>
      </header>

      {/* The week, before the work. Approximate by construction — see the note on
          stripZone — and silent when there are no schedules to draw one from. */}
      {weekCells.length === 7 ? (
        <div className="mt-6">
          <WeekStrip cells={weekCells} todayLocal={stripToday} />
        </div>
      ) : null}

      {/* ── waiting on you ──────────────────────────────────────────────────── */}
      {dueNow.length > 0 ? (
        <section className="mt-8 space-y-3">
          {dueNow.map((occurrence) => (
            <Row
              key={occurrence.id}
              occurrence={occurrence}
              goal={goals.get(occurrence.goal_id)!}
              now={now}
            />
          ))}
        </section>
      ) : null}

      {/* ── coming up ───────────────────────────────────────────────────────── */}
      {later.length > 0 ? (
        <section className="mt-10 space-y-2">
          <h2 className="text-sm font-bold text-prose uppercase tracking-wide">Later on</h2>
          {later.map((occurrence) => {
            const goal = goals.get(occurrence.goal_id)!
            return (
              <Link
                key={occurrence.id}
                href={`/goals/${goal.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-soft bg-surface px-4 py-3 hover:border-strong transition-colors"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-prose">{goal.title}</span>
                  {goal.identity_short ? (
                    <span className="block truncate text-xs text-prose-faint">
                      {LABELS.goals.votingFor}: {goal.identity_short}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-xs text-prose-muted tabular-nums">
                  {occurrence.local_time.slice(0, 5)}
                </span>
              </Link>
            )
          })}
        </section>
      ) : null}

      {/* The ONLY client JavaScript on this page, and it does nothing at all while
          the connection is up — it intercepts a submit only when the browser
          already reports itself offline. See the component for why /today is not
          cached: a stale "what's due" list is a worse failure than a page that
          needs signal. */}
      <OfflineLogQueue />

      {/* ── nothing at all ──────────────────────────────────────────────────── */}
      {live.length === 0 ? (
        <div className="mt-8 rounded-xl border border-soft bg-surface p-5">
          <p className="text-sm text-prose-muted">{LABELS.goals.todayNothing}</p>
          <Link
            href="/goals"
            className="mt-4 inline-flex min-h-11 items-center text-xs font-semibold text-accent-text hover:text-prose"
          >
            {LABELS.goals.short} →
          </Link>
        </div>
      ) : (
        <div className="mt-10 border-t border-soft pt-6">
          <Link
            href="/goals"
            className="inline-flex min-h-11 items-center text-xs font-semibold text-accent-text hover:text-prose"
          >
            All your goals →
          </Link>
        </div>
      )}
    </Wrap>
  )
}

/**
 * One actionable row. The primary button is the whole point of the screen, so it's
 * full-width and "Not today" is the quiet secondary — a skip is a legitimate answer
 * but it should never be as easy to hit by accident as the thing he came to do.
 */
function Row({
  occurrence, goal, now,
}: {
  occurrence: OccurrenceRow
  goal: GoalRow
  now: Date
}) {
  const unit = goal.metric_unit ? ` ${goal.metric_unit}` : ''
  const wantsNumber = Boolean(goal.metric_key)

  // Anything whose own local_date is behind the current day, or that the sweep
  // already gave up on, is a catch-up. Phrased as an invitation, never a debt:
  // "Still open from the 6th", not "you missed this".
  const overdueDays = Math.max(
    0,
    Math.round((now.getTime() - new Date(occurrence.due_at).getTime()) / 86_400_000),
  )
  const isCatchup = occurrence.status === 'missed' || overdueDays >= 1

  return (
    <div className="rounded-xl border border-strong bg-surface-raised p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-prose">{goal.title}</p>
          {goal.identity_short ? (
            <p className="mt-0.5 text-xs text-eyebrow uppercase tracking-widest font-semibold">
              {LABELS.goals.votingFor}: {goal.identity_short}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-prose-muted">
            {isCatchup
              ? `Still open from ${occurrence.local_date}`
              : `Due ${occurrence.local_time.slice(0, 5)}`}
            {occurrence.target_value != null ? ` · target ${occurrence.target_value}${unit}` : ''}
          </p>
          {occurrence.shifted ? (
            <p className="mt-1 text-xs text-accent-text">
              Clocks changed, so this one landed at {occurrence.local_time.slice(0, 5)}.
            </p>
          ) : null}
        </div>
      </div>

      <form action={logOccurrence} className="mt-4 space-y-3">
        <input type="hidden" name="occurrenceId" value={occurrence.id} />
        <input type="hidden" name="goalId" value={goal.id} />

        {wantsNumber ? (
          <label className="block">
            <span className="text-xs text-prose-muted">
              {goal.metric_key}{unit ? ` (${goal.metric_unit})` : ''} — what actually happened
            </span>
            <input
              type="number"
              name="value"
              step="any"
              inputMode="decimal"
              defaultValue={occurrence.target_value ?? ''}
              className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-lg text-prose"
            />
          </label>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            name="action"
            value="completed"
            className="min-h-11 flex-1 rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors"
          >
            {LABELS.goals.logCta}
          </button>
          <button
            type="submit"
            name="action"
            value="skipped"
            className="min-h-11 rounded-lg border border-soft bg-surface px-5 py-3 text-sm font-semibold text-prose-muted hover:bg-surface-hover transition-colors"
          >
            Not today
          </button>
        </div>
      </form>
    </div>
  )
}

/**
 * The zone most of this user's schedules are in.
 *
 * Ties break toward the first one seen, which is stable enough for a strip that is
 * explicitly the approximate view. With no schedules at all there is nothing to
 * approximate, so UTC — the strip then shows a week of "nothing due", which is true.
 */
function majorityZone(zones: string[]): string {
  const counts = new Map<string, number>()
  for (const zone of zones) counts.set(zone, (counts.get(zone) ?? 0) + 1)
  let best = 'UTC'
  let bestCount = 0
  for (const [zone, count] of counts) {
    if (count > bestCount) { best = zone; bestCount = count }
  }
  return best
}

/** A bad zone must never take down the page. Mirrors lib/goals/stats.ts. */
function safeLocalDate(now: Date, zone: string): string {
  try {
    return localDateInZone(now, zone)
  } catch {
    return localDateInZone(now, 'UTC')
  }
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</div>
}

// ─────────────────────────────────────────────────────────────────────────────
// ON LOGGING OFFLINE — why it isn't here yet
//
// `goal_entries.client_entry_id` exists for exactly this (migration 134, decision
// 5): a client-generated id, unique per user, so a queue flushed twice can't
// double-count a dose. The contract is already designed.
//
// What's missing isn't the queue, it's the shell. A queue only helps if the page
// LOADS offline, and public/sw.js is a deliberate network passthrough — so today,
// offline means a blank page with nothing to queue from. Caching this route would
// fix that and put a list of someone's medication and cessation schedule in the
// on-device cache, which on a shared or family phone is a real exposure and a
// bigger decision than it looks.
//
// The narrower win, if we want one without that trade: keep the page uncached, and
// have a small client island catch a failed POST while the page is ALREADY open —
// which covers the common case of opening the app and then losing signal. That
// needs no cached private data and no service-worker change.
// ─────────────────────────────────────────────────────────────────────────────

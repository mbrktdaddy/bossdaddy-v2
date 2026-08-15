// Goal detail. The one screen a dad actually looks at: what's due, where the
// curve sits today, and how to log it in one tap.
//
// Everything is a plain <form> bound to a Server Action, so this page works with
// JavaScript disabled and has no client bundle. Data comes through the session
// client, so RLS decides ownership — a goal that isn't yours is a 404, not a
// hand-written filter I could forget.

import type { ReactNode } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import { localDateInZone } from '@/lib/goals/recurrence'
import {
  computeStreak, computeScheduledStreak, longestScheduledStreak, keptTotal,
  adherenceRate, recentAdherence, RATE_WINDOW_DAYS,
  latestValue, progressToTarget, compareToTarget,
  planWindow, VOTE_KINDS,
} from '@/lib/goals/progress'
import { describeRrule } from '@/lib/goals/schedule-input'
import { MAX_ENTRY_NOTE_LENGTH } from '@/lib/goals/log'
import {
  buildHistoryGrid, gridWindow, monthGridWindow, monthOf, addMonths,
} from '@/lib/goals/history'
import NotesFeed from '@/components/goals/NotesFeed'
import WeekStrip from '@/components/goals/WeekStrip'
import HistoryGrid from '@/components/goals/HistoryGrid'
import MetricTrend from '@/components/goals/MetricTrend'
import { logOccurrence, logUnprompted, toggleScheduleMute, setGoalStatus } from '../actions'

export const metadata: Metadata = {
  title: LABELS.goals.pageTitle,
  robots: { index: false, follow: false },   // private data, never indexed
}

type Props = {
  params: Promise<{ id: string }>
  /** `m` is the calendar month, `YYYY-MM`. Clamped to the goal's lifetime below. */
  searchParams: Promise<{ confirm?: string; msg?: string; saved?: string; m?: string }>
}

type GoalRow = {
  id: string; title: string; description: string | null; kind: string; status: string
  metric_key: string | null; metric_unit: string | null; direction: string | null
  baseline_value: number | null; target_value: number | null
  curve: string; step_every_days: number | null
  started_on: string; target_date: string | null
  identity_statement: string | null; identity_short: string | null
  template_slug: string | null
}
type ScheduleRow = {
  id: string; label: string | null; rrule: string; local_time: string
  timezone: string; muted: boolean; status: string; channels: string[]
}
type OccurrenceRow = {
  id: string; local_date: string; local_time: string; status: string
  target_value: number | null; due_at: string; shifted: boolean
}
type EntryRow = {
  id: string; local_date: string; kind: string; value: number | null; note: string | null
  // `occurrence_id` is null for an unprompted log. It's what lets the Log below
  // say which row was the scheduled day and which was an extra — without it, two
  // entries on the same date both read "Done" and the list can't be reconciled.
  occurrence_id: string | null
  observed_at: string
}
// PostgREST embeds a to-one relationship as an object (or null when RLS hides it).
type PlanRow = {
  slug: string
  guide_slug: string | null
  guides: { slug: string; title: string } | null
}

export default async function GoalDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { confirm, msg, saved, m } = await searchParams
  const confirmingDelete = confirm === 'delete'
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-14 space-y-6">
        <h1 className="text-2xl font-black text-prose">Sign in to see this goal.</h1>
        <LoginLink className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Sign in →
        </LoginLink>
      </div>
    )
  }

  const { data: goalRow } = await supabase
    .from('goals')
    .select('id, title, description, kind, status, metric_key, metric_unit, direction, baseline_value, target_value, curve, step_every_days, started_on, target_date, identity_statement, identity_short, template_slug')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  const goal = goalRow as unknown as GoalRow | null
  if (!goal) notFound()

  // The plan this came from, only to find out whether there's something to read.
  // Skipped entirely for a goal that wasn't started from a template, and the link
  // is hidden when the guide is unpublished — RLS on `guides` returns no embedded
  // row in that case, so the gate is the database's rather than a status check I
  // could forget to keep in sync.
  const plan = goal.template_slug
    ? ((await supabase
        .from('goal_templates')
        .select('slug, guide_slug, guides(slug, title)')
        .eq('slug', goal.template_slug)
        .maybeSingle()).data as unknown as PlanRow | null)
    : null
  const planGuide = plan?.guides?.slug ? plan.guides : null

  const [
    { data: scheduleRows }, { data: occurrenceRows }, { data: entryRows }, { data: statRow },
  ] = await Promise.all([
    supabase.from('goal_schedules')
      .select('id, label, rrule, local_time, timezone, muted, status, channels')
      .eq('goal_id', goal.id)
      .order('local_time', { ascending: true }),
    supabase.from('goal_occurrences')
      .select('id, local_date, local_time, status, target_value, due_at, shifted')
      .eq('goal_id', goal.id)
      .order('due_at', { ascending: true }),
    supabase.from('goal_entries')
      .select('id, local_date, kind, value, note, occurrence_id, observed_at')
      .eq('goal_id', goal.id)
      .order('local_date', { ascending: false })
      .limit(400),
    // The two numbers folded from FULL history rather than from the capped read
    // below. Missing row is fine — a goal the sweep hasn't reached yet falls back
    // to what this page can see, which is a floor, never a wrong high number.
    supabase.from('goal_stats')
      .select('longest_streak, kept_total')
      .eq('goal_id', goal.id)
      .maybeSingle(),
  ])

  const schedules = (scheduleRows ?? []) as unknown as ScheduleRow[]
  const occurrences = (occurrenceRows ?? []) as unknown as OccurrenceRow[]
  const entries = (entryRows ?? []) as unknown as EntryRow[]
  const stats = statRow as unknown as
    { longest_streak: number; kept_total: number } | null

  const zone = schedules[0]?.timezone ?? 'UTC'
  const now = new Date()
  const today = localDateInZone(now, zone)

  // SCHEDULE-AWARE. A MO/WE/FR goal keeps its run through Tuesday; the calendar
  // fold below is only for a goal whose schedules are gone, which has no scheduled
  // days to walk. Before this, "Days running" could never read above 1 on any
  // non-daily goal — including two of the seeded plans.
  const streak = occurrences.length
    ? computeScheduledStreak(occurrences, entries)
    : computeStreak(entries, today)
  // The stored figures win because they see all of history and longest_streak is
  // monotonic (migration 146); the local folds are the floor until the sweep writes.
  const bestRun = Math.max(
    stats?.longest_streak ?? 0,
    longestScheduledStreak(occurrences, entries),
  )
  const kept = Math.max(stats?.kept_total ?? 0, keptTotal(entries))

  const { done, total, pct } = adherenceRate(occurrences)
  const recent = recentAdherence(occurrences, today)
  const latest = latestValue(entries)

  // Built ONCE and shared: the calendar draws the
  // cells and the trend reads the values and stamped targets out of the same
  // array, so the picture and the heat map can never describe different days.
  // ── the calendar ──────────────────────────────────────────────────────────
  // Which month to show: `?m=YYYY-MM`, defaulting to the one we're in. CLAMPED to
  // the goal's own lifetime, so paging back can't walk into months that existed
  // before the goal did — an empty calendar you can scroll forever is worse than no
  // arrow at all. `started_on` is the floor, this month is the ceiling.
  const thisMonth = monthOf(today)!
  const firstMonth = monthOf(goal.started_on) ?? thisMonth
  const requested = typeof m === 'string' && /^\d{4}-\d{2}$/.test(m) ? m : thisMonth
  const shownMonth = requested < firstMonth ? firstMonth
    : requested > thisMonth ? thisMonth
    : requested

  const monthWindow = monthGridWindow(shownMonth)
  const monthCells = monthWindow
    ? buildHistoryGrid({
        occurrences, entries, fromYmd: monthWindow.from, toYmd: monthWindow.to,
      })
    : []
  const prevMonth = addMonths(shownMonth, -1)
  const nextMonth = addMonths(shownMonth, 1)

  // The strip is its own week, built from the same arrays by the same function — the
  // month on screen may not contain today, so it can't be sliced off the calendar.
  const weekWindow = gridWindow(today, 1)
  const weekCells = weekWindow
    ? buildHistoryGrid({
        occurrences, entries, fromYmd: weekWindow.from, toYmd: weekWindow.to,
      })
    : []
  // The trend follows the calendar, so paging months moves both together.
  const historyCells = monthCells
  const progress = progressToTarget(goal.baseline_value, goal.target_value, latest?.value ?? null)
  const unit = goal.metric_unit ? ` ${goal.metric_unit}` : ''

  const todays = occurrences.find((o) => o.local_date === today)
  const openOnes = occurrences.filter((o) =>
    (o.status === 'pending' || o.status === 'notified' || o.status === 'missed' || o.status === 'snoozed')
    && new Date(o.due_at).getTime() <= now.getTime(),
  )
  const actionable = todays && isOpen(todays.status) ? todays : openOnes[openOnes.length - 1]
  const upcoming = occurrences
    .filter((o) => new Date(o.due_at).getTime() > now.getTime())
    .slice(0, 3)

  const wantsNumber = Boolean(goal.metric_key)
  // A finished plan asks for nothing. Both log surfaces come off the page — logging
  // into a plan that's over would accrue entries outside its vote window, which is
  // the one place a number could quietly stop adding up. Reopening is one tap away.
  const finished = goal.status === 'completed'

  // Who can actually READ the notes feed, besides him. Partners on the goal are
  // not the same set: thread_access is orthogonal to tier (migration 145), and it
  // defaults to 'none', so a goal can be shared with three people and still have a
  // completely private journal. `head: true` transfers no rows.
  const { count: feedReaders } = await supabase
    .from('goal_participants')
    .select('id', { count: 'exact', head: true })
    .eq('goal_id', goal.id)
    .neq('thread_access', 'none')
  const feedReaderCount = feedReaders ?? 0

  // ── votes ─────────────────────────────────────────────────────────────────
  // Only for a goal that has an identity: without one there's nothing to vote
  // FOR, and the page falls back to plain process language with no other switch
  // to flip.
  //
  // Counted in the DATABASE rather than folded from `entries` above, which is
  // capped at 400 rows — that cap is fine for a streak (it only ever reads back
  // from today) but it would silently undercount votes on a plan longer than 400
  // logged days, and a vote count that quietly drops is the one thing this whole
  // layer must never do. `head: true` transfers no rows.
  const voteWindow = goal.identity_statement
    ? planWindow(goal.started_on, goal.target_date, today)
    : null
  let votes: number | null = null
  if (voteWindow) {
    const { count, error } = await supabase
      .from('goal_entries')
      .select('id', { count: 'exact', head: true })
      .eq('goal_id', goal.id)
      .in('kind', [...VOTE_KINDS])
      .gte('local_date', voteWindow.start)
      .lte('local_date', voteWindow.end)
    // A failed count renders nothing rather than a zero — "0 votes" on a goal
    // he's been keeping for three weeks would be a lie with a number on it.
    if (!error) votes = count ?? 0
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div>
        <Link href="/goals" className="inline-flex items-center py-3 text-xs text-prose-muted hover:text-prose">
          ← {LABELS.goals.short}
        </Link>
      </div>

      <header className="space-y-3">
        {/* The eyebrow carries the state AND the start date now. "Since" was a stat
            tile competing with three numbers that change; a start date never does. */}
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {LABELS.goals.kinds[goal.kind] ?? LABELS.goals.kinds.custom}
          {goal.status === 'paused' ? ' · Paused' : ''}
          {finished ? ' · Finished' : ''}
          <span className="text-prose-faint"> · since {goal.started_on}</span>
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-prose leading-[1.05] tracking-tight">
          {goal.title}
        </h1>
        {goal.description ? (
          <p className="text-base text-prose-muted leading-snug">{goal.description}</p>
        ) : null}

        {/* ── who this is making him ────────────────────────────────────────
            Stated, never scored. There is no number beside it and nothing here
            can go down: a missed day is silent by design, and identity framing
            that could be contradicted by a bad week would be worse than none.
            Absent when he never set one — the page then reads exactly as it did
            before this layer existed. */}
        {goal.identity_statement ? (
          <p className="border-l-2 border-strong pl-4 text-base text-prose-muted leading-snug">
            {goal.identity_statement}
          </p>
        ) : null}

        {planGuide ? (
          <Link
            href={`/guides/${planGuide.slug}`}
            className="inline-flex min-h-11 items-center text-xs font-semibold text-accent-text hover:text-prose"
          >
            Read the plan behind this →
          </Link>
        ) : null}

        {/* ⚠️ THESE BELONG TO THE GOAL, SO THEY LIVE WITH THE GOAL.
            Both links used to sit in the "Reminders" section heading, which read as
            "edit reminders" — so the goal's own fields (title, identity, baseline,
            target, PLAN LENGTH) had no discoverable way in at all, even though the
            edit page has carried a "The goal" section all along. Phase 2 made that
            worse: "Extend it" on a finished plan points at exactly those fields.
            The reminders section keeps its own link, named for reminders. */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pt-1">
          <Link
            href={`/goals/${goal.id}/edit`}
            className="min-h-11 inline-flex items-center text-xs font-semibold text-accent-text hover:text-prose"
          >
            Edit this goal →
          </Link>
          <Link
            href={`/goals/${goal.id}/share`}
            className="min-h-11 inline-flex items-center text-xs font-semibold text-accent-text hover:text-prose"
          >
            {LABELS.goals.shareCta} →
          </Link>
        </div>
      </header>

      {msg === 'delete_failed' ? (
        <p className="rounded-lg border border-strong bg-surface-raised px-4 py-3 text-sm text-accent-text">
          That didn&apos;t delete. Try again, or archive it instead.
        </p>
      ) : null}
      {saved === '1' ? (
        <p className="rounded-lg border border-soft bg-surface px-4 py-3 text-sm text-prose-muted">
          Saved.
        </p>
      ) : null}

      {/* ── finished ─────────────────────────────────────────────────────────
          Derived, never asserted: the sweep marks a plan complete once its end
          date has passed and nothing is left unresolved. Until this existed,
          `goals.status = 'completed'` was defined by migration 134 and unreachable
          from anywhere in the product, so an eight-week taper simply ran forever.

          Two ways forward, and deliberately not a third. "Start it again" makes a
          NEW goal from the same plan — a fresh window, a fresh curve, a vote count
          that starts over, which is what beginning again actually means. "Extend
          it" moves the end date on the goal he already has; the update route
          re-expands every schedule when target_date changes, so that path really
          works. Reopening without doing either is in Manage, where the caveat fits. */}
      {finished ? (
        <section className="rounded-xl border border-strong bg-surface-raised p-5 sm:p-6 space-y-3">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            Plan finished
          </p>
          <h2 className="text-xl font-bold text-prose">
            {goal.target_date ? <>You ran this to {goal.target_date}.</> : <>This one&apos;s done.</>}
          </h2>
          <p className="text-sm text-prose-muted leading-snug">
            {total > 0
              ? <>You kept {done} of {total} scheduled days{bestRun > 0 ? <>, with a best run of {bestRun}</> : null}.</>
              : <>{kept} {kept === 1 ? 'day' : 'days'} kept.</>}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href={goal.template_slug
                ? `/goals/new?t=${encodeURIComponent(goal.template_slug)}`
                : '/goals/new'}
              className="min-h-11 inline-flex items-center rounded-lg bg-accent px-5 py-3 text-sm font-bold text-white hover:bg-accent-hover transition-colors"
            >
              Start it again
            </Link>
            {goal.target_date ? (
              <Link
                href={`/goals/${goal.id}/edit`}
                className="min-h-11 inline-flex items-center rounded-lg border border-soft bg-surface px-5 py-3 text-sm font-semibold text-prose hover:bg-surface-hover transition-colors"
              >
                Extend it →
              </Link>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ── ACT ──────────────────────────────────────────────────────────────
          Where you are in the week, then the one thing to do about it. The strip
          replaced a sentence ("Nothing open right now. Next one lands 2026-08-17 at
          19:00.") that made the reader parse a date to learn something a row of
          seven chips says instantly. */}
      {finished ? null : weekCells.length === 7 ? (
        <WeekStrip cells={weekCells} todayLocal={today} unit={unit} />
      ) : null}

      {finished ? null : actionable ? (
        <section className="bg-surface-raised border border-strong rounded-xl p-5 sm:p-6">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {actionable.local_date === today ? 'Today' : `Open from ${actionable.local_date}`}
            {actionable.status === 'missed' ? ' · catch-up' : ''}
          </p>
          <h2 className="mt-1 text-xl font-bold text-prose">
            {actionable.target_value != null
              ? <>Target: {actionable.target_value}{unit}</>
              : LABELS.goals.logCta}
          </h2>
          {actionable.shifted ? (
            <p className="mt-2 text-xs text-accent-text">
              Clocks changed, so this one landed at {actionable.local_time.slice(0, 5)}.
            </p>
          ) : null}

          <form action={logOccurrence} className="mt-5 space-y-3">
            <input type="hidden" name="occurrenceId" value={actionable.id} />
            <input type="hidden" name="goalId" value={goal.id} />
            {wantsNumber ? (
              <label className="block">
                <span className="text-sm text-prose-muted">
                  {goal.metric_key}{unit ? ` (${goal.metric_unit})` : ''} — what actually happened
                </span>
                <input
                  type="number"
                  name="value"
                  step="any"
                  inputMode="decimal"
                  defaultValue={actionable.target_value ?? ''}
                  className="mt-2 w-full rounded-lg border border-soft bg-surface px-4 py-3 text-lg text-prose"
                />
              </label>
            ) : null}
            {/* Behind a disclosure so the fast path stays ONE TAP. An always-open
                text input above the button turns a ten-second log into a form, and
                this field is the exception rather than the habit. Inputs inside a
                closed <details> still submit — as empty — so the primary flow pays
                nothing for it.

                It applies to "Not today" too, which is the case it earns its keep
                on: a skip with a reason attached is worth considerably more than a
                bare skip, to him and to the Boss reading it back.

                NOT the notes feed. That's a conversation with edit, delete and
                partner access (migration 145); this is one line stapled to one day,
                withheld from every partner below teammate, and uneditable once
                written. The copy has to keep those two apart — hence "Add a note"
                and a placeholder that doesn't echo the feed's prompt. */}
            <details className="rounded-lg border border-soft bg-surface">
              <summary className="min-h-11 flex cursor-pointer items-center px-4 text-sm font-semibold text-prose-muted">
                Add a note
              </summary>
              <div className="px-4 pb-4">
                <input
                  type="text"
                  name="note"
                  maxLength={MAX_ENTRY_NOTE_LENGTH}
                  placeholder="Anything worth remembering about today"
                  className="w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
                />
              </div>
            </details>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                name="action"
                value="completed"
                className="flex-1 rounded-lg bg-accent px-6 py-3 font-bold text-white hover:bg-accent-hover transition-colors"
              >
                {LABELS.goals.logCta}
              </button>
              <button
                type="submit"
                name="action"
                value="skipped"
                className="rounded-lg border border-soft bg-surface px-6 py-3 text-sm font-semibold text-prose-muted hover:bg-surface-hover transition-colors"
              >
                Not today
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="bg-surface border border-soft rounded-xl p-5 sm:p-6">
          <p className="text-sm text-prose-muted">
            Nothing open right now.
            {upcoming[0] ? <> Next one lands {upcoming[0].local_date} at {upcoming[0].local_time.slice(0, 5)}.</> : null}
          </p>
        </section>
      )}

      {/* ── log something that wasn't scheduled ─────────────────────────── */}
      {/* Behind a <details> so it never competes with the primary action above,
          but present on every goal. An entry with no occurrence is a vote and
          counts in "kept all time"; it does NOT extend the streak, which walks
          scheduled days only. Before this existed, an honest log on an off day had
          nowhere to go at all. */}
      {finished ? null : (
      <details className="rounded-xl border border-soft bg-surface p-5">
        <summary className="min-h-11 flex cursor-pointer items-center text-sm font-semibold text-prose">
          Log something else
        </summary>
        <p className="mt-2 text-xs text-prose-faint">
          An extra workout, a weigh-in nobody asked for, an honest count on a day
          nothing was due.
        </p>
        <form action={logUnprompted} className="mt-4 space-y-3">
          <input type="hidden" name="goalId" value={goal.id} />

          {wantsNumber ? (
            <label className="block">
              <span className="text-sm text-prose-muted">
                {goal.metric_key}{unit ? ` (${goal.metric_unit})` : ''}
              </span>
              <input
                type="number" name="value" step="any" inputMode="decimal" required
                className="mt-2 w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-lg text-prose"
              />
            </label>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-prose-muted">Which day</span>
              <input
                type="date" name="localDate" defaultValue={today} max={today}
                className="mt-2 w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
              />
            </label>
            <label className="block">
              {/* Named for what it DOES now that the Log renders it: on a goal with
                  no metric this line is the only record of what the extra was. */}
              <span className="text-sm text-prose-muted">What it was (optional)</span>
              <input
                type="text" name="note" maxLength={MAX_ENTRY_NOTE_LENGTH}
                className="mt-2 w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
              />
            </label>
          </div>

          <button
            type="submit"
            className="min-h-11 w-full rounded-lg border border-strong bg-surface px-6 py-3 text-sm font-bold text-prose hover:bg-surface-hover transition-colors"
          >
            Log it
          </button>
        </form>
      </details>
      )}

      {/* ── where it stands ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-prose uppercase tracking-wide">Where it stands</h2>

        {progress != null ? (
          <div className="bg-surface border border-soft rounded-xl p-5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-3 text-sm text-prose-muted">
              Started at <span className="text-prose">{goal.baseline_value}{unit}</span>,
              headed for <span className="text-prose">{goal.target_value}{unit}</span>
              {goal.target_date ? <> by {goal.target_date}</> : null}.
              {latest ? <> Last logged <span className="text-prose">{latest.value}{unit}</span> on {latest.localDate}.</> : null}
            </p>
            {latest && todays?.target_value != null ? (
              <p className="mt-2 text-sm text-prose-muted">
                {verdictCopy(compareToTarget(latest.value, todays.target_value, goal.direction))}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* The same journey as the bar above, with the shape of it. Only for a goal
            that measures something and has at least two readings — one reading is a
            stat, and the grid above already carries "did it or didn't". */}
        {wantsNumber ? (
          <MetricTrend cells={historyCells} unit={unit} metricLabel={goal.metric_key} />
        ) : null}

        {/* ── votes ────────────────────────────────────────────────────────
            A PHRASE, NOT A STAT. It sits below the curve and outside the stat
            grid on purpose: in the grid it would read as a third score competing
            with adherence, and this number is not a score. It only ever holds
            still or goes up — a missed day adds nothing and subtracts nothing,
            because one day never gets to rewrite who he's becoming. */}
        {votes != null ? (
          <p className="text-sm text-prose-muted">
            {votes > 0 ? (
              <>
                <span className="font-bold text-prose">{votes}</span>
                {votes === 1 ? ' vote' : ' votes'} toward this plan
                {voteWindow?.planDays && voteWindow.dayInPlan > 0 ? (
                  <> · Day {voteWindow.dayInPlan} of {voteWindow.planDays}</>
                ) : null}
              </>
            ) : (
              // No zero. A "0 votes" scoreboard on day one is exactly the framing
              // this layer exists to avoid, so the empty state points forward.
              <>Your first vote is the next day you log.</>
            )}
          </p>
        ) : null}

        {/* Four numbers, and the order is the argument: where he is now, the best
            he's ever done, how the last month has gone, and since when.

            "Logged" LEADS WITH THE ROLLING WINDOW. A lifetime percentage is the
            one figure on this page that can't recover — six months in, a bad
            month costs a couple of points and a perfect fortnight wins them back,
            so it stops answering the question being asked. Lifetime is still
            here, as the fallback when nothing resolved in the window (a goal
            parked for a month, or a brand-new one), and the hint always names
            which of the two you're looking at.

            Best run is what makes a broken streak survivable: it's monotonic, so
            the day he loses a 40-day run he still has the 40. */}
        {/* NUMBER FIRST, LABEL UNDER IT. These read `Days running` in a loud
            uppercase micro-label with a text-lg value beside it, which is the
            emphasis exactly backwards — the label is chrome and the number is the
            point. Three tiles, not four: "Since" was the weakest of them and moved
            to the header meta line, where a start date belongs. */}
        <dl className="grid grid-cols-3 gap-3">
          <Stat
            value={streak > 0 ? String(streak) : '—'}
            label="running"
            hint={kept > streak ? `${kept} all time` : undefined}
          />
          <Stat value={bestRun > 0 ? String(bestRun) : '—'} label="best run" />
          <Stat
            value={recent.pct != null ? `${recent.pct}%` : pct != null ? `${pct}%` : '—'}
            label={recent.total > 0 ? `last ${RATE_WINDOW_DAYS} days` : 'all time'}
            hint={
              recent.total > 0
                ? `${recent.done} of ${recent.total}`
                : total > 0 ? `${done} of ${total}` : undefined
            }
          />
        </dl>
      </section>

      {/* ── the last twelve weeks ───────────────────────────────────────────
          After the numbers and before the machinery: this is the part he actually
          scrolls to, and it answers a question no single figure can ("which days do
          I keep dropping?"). Renders nothing until there's something to look at. */}
      <HistoryGrid
        cells={monthCells}
        month={shownMonth}
        unit={unit}
        prevHref={prevMonth && prevMonth >= firstMonth ? `/goals/${goal.id}?m=${prevMonth}` : null}
        nextHref={nextMonth && nextMonth <= thisMonth ? `/goals/${goal.id}?m=${nextMonth}` : null}
      />

      {/* ── reminders ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-prose uppercase tracking-wide">Reminders</h2>
          {/* Named for what it edits, and deep-linked to that part of the page.
              A bare "Edit →" here is what made the whole goal editor invisible. */}
          <Link
            href={`/goals/${goal.id}/edit#reminders`}
            className="min-h-11 inline-flex shrink-0 items-center text-xs font-semibold text-accent-text hover:text-prose"
          >
            Add or change →
          </Link>
        </div>
        {schedules.length === 0 ? (
          <p className="text-sm text-prose-faint">No schedule on this goal yet.</p>
        ) : schedules.map((schedule) => (
          <div key={schedule.id} className="bg-surface border border-soft rounded-xl p-5 flex items-start justify-between gap-4">
            {/* CHIPS, NOT A PARAGRAPH. This was three stacked lines of prose per
                reminder — label, then the schedule, then zone · channels — which on a
                goal with two reminders is six lines of small grey text describing
                settings. The same four facts as pills scan in one pass, and the label
                only appears when the user actually gave one (a bare "Reminder"
                heading above "Weekdays at 7:00 PM" was pure filler). */}
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {schedule.label?.trim() ? (
                <span className="text-sm font-semibold text-prose">
                  {schedule.label.trim()}
                </span>
              ) : null}
              <Chip>{describeRrule(schedule.rrule, schedule.local_time)}</Chip>
              <Chip>{schedule.timezone.split('/').pop()?.replace(/_/g, ' ')}</Chip>
              <Chip>{schedule.channels.join(' + ')}</Chip>
              {schedule.muted ? <Chip>muted</Chip> : null}
            </div>
            <form action={toggleScheduleMute} className="shrink-0">
              <input type="hidden" name="scheduleId" value={schedule.id} />
              <input type="hidden" name="goalId" value={goal.id} />
              <input type="hidden" name="muted" value={schedule.muted ? 'false' : 'true'} />
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-soft bg-surface px-5 py-3 text-xs font-semibold text-prose-muted hover:bg-surface-hover transition-colors"
              >
                {schedule.muted ? 'Unmute' : 'Mute'}
              </button>
            </form>
          </div>
        ))}
      </section>

      {/* ── history ─────────────────────────────────────────────────────── */}
      {/* COLLAPSED. The chain grid above now tells this story visually, so fourteen
          rows of dates and one-word verdicts were the same information twice — and
          the second telling was the one taking the vertical space. Still one tap
          away, because the note attached to a day only lives here. */}
      {entries.length > 0 ? (
        <details className="rounded-xl border border-soft bg-surface">
          <summary className="min-h-11 flex cursor-pointer items-center justify-between gap-3 px-5 py-3">
            <span className="text-sm font-bold text-prose uppercase tracking-wide">Log</span>
            <span className="text-xs text-prose-faint">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </summary>
          <div className="px-5 pb-5 space-y-3">
          {/* THE LOG HAS TO SAY WHAT WAS LOGGED. It showed a date and one word, so
              an unprompted entry was indistinguishable from the scheduled one —
              two rows reading "Done" on the same date — and the note typed into
              "Log something else" was written to the database and then never shown
              anywhere. For a goal with no metric, that note is the ONLY record of
              what the extra actually was.

              Three things distinguish the rows now: an "Extra" marker for an entry
              with no occurrence, the note underneath, and a clock — but only when
              the entry was logged ON the day it counts for. A backdated log carries
              the submit time, which belongs to a different day, so showing it there
              would be a wrong number rather than a helpful one. */}
          <ul className="divide-y divide-soft border border-soft rounded-xl overflow-hidden">
            {entries.slice(0, 14).map((entry) => {
              const loggedAt = new Date(entry.observed_at)
              // `zone` is already proven valid — localDateInZone(now, zone) ran above.
              const loggedSameDay = localDateInZone(loggedAt, zone) === entry.local_date
              return (
                <li key={entry.id} className="bg-surface px-5 py-3">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm text-prose">
                      {entry.local_date}
                      {loggedSameDay ? (
                        <span className="ml-2 text-xs text-prose-faint">{timeInZone(loggedAt, zone)}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm text-prose-muted">
                      {/* Trailing literal space for the same reason as ContactsCard:
                          `mr-2` alone reads "Extra195 lb" when copied or read aloud. */}
                      {entry.occurrence_id == null ? (
                        <>
                          <span className="mr-1 text-xs uppercase tracking-widest text-prose-faint">
                            Extra
                          </span>{' '}
                        </>
                      ) : null}
                      {entry.value != null ? `${entry.value}${unit}` : entryKindCopy(entry.kind)}
                    </span>
                  </div>
                  {entry.note ? (
                    <p className="mt-1 text-sm text-prose-muted leading-snug">{entry.note}</p>
                  ) : null}
                </li>
              )
            })}
          </ul>
          </div>
        </details>
      ) : null}

      {/* ── notes ───────────────────────────────────────────────────────────
          Sits after the log and before Manage on purpose: it's the thing you
          come back to, not an administrative afterthought. `readerCount` is what
          decides whether this renders as a private journal or a conversation —
          note that it counts partners who can actually READ THE FEED, not
          partners on the goal. Three cheer partners with no feed access is still
          a journal, and framing it as a conversation would imply an audience
          that isn't listening. */}
      <NotesFeed subject={{ type: 'goal', id: goal.id }} readerCount={feedReaderCount} isSubjectOwner />

      {/* ── manage: pause, archive, delete ──────────────────────────────── */}
      {/* ── MANAGE, COLLAPSED ───────────────────────────────────────────────
          Pause, archive and delete are things you do to a goal a handful of times in
          its life, and they sat permanently open at the foot of the page with a
          paragraph explaining what each one does. Behind a disclosure the paragraph
          becomes helpful instead of unavoidable — you only read it when you've
          already decided to do one of these things.

          Delete stays a two-step confirm INSIDE here; the caution lives in the
          confirm, not in hiding the button. */}
      <details className="rounded-xl border border-soft bg-surface">
        <summary className="min-h-11 flex cursor-pointer items-center justify-between gap-3 px-5 py-3">
          <span className="text-sm font-bold text-prose uppercase tracking-wide">Manage</span>
          <span className="text-xs text-prose-faint">
            {goal.status === 'archived' ? 'archived'
              : finished ? 'finished'
              : goal.status === 'paused' ? 'paused'
              : 'active'}
          </span>
        </summary>
        <div className="space-y-4 px-5 pb-5">

        {/* An archived goal gets Restore, not Pause — the old version showed
            "Pause" here, which would have quietly moved it from archived to
            paused and left the user with no way back to active at all. */}
        <div className="flex flex-wrap gap-3">
          <form action={setGoalStatus}>
            <input type="hidden" name="goalId" value={goal.id} />
            <input
              type="hidden"
              name="status"
              value={goal.status === 'active' ? 'paused' : 'active'}
            />
            <button
              type="submit"
              className="min-h-11 rounded-lg border border-soft bg-surface px-5 py-3 text-xs font-semibold text-prose hover:bg-surface-hover transition-colors"
            >
              {goal.status === 'archived' ? 'Restore'
                : goal.status === 'paused' ? 'Resume'
                : finished ? 'Reopen'
                : 'Pause'}
            </button>
          </form>

          {goal.status !== 'archived' ? (
            <form action={setGoalStatus}>
              <input type="hidden" name="goalId" value={goal.id} />
              <input type="hidden" name="status" value="archived" />
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-soft bg-surface px-5 py-3 text-xs font-semibold text-prose-muted hover:bg-surface-hover transition-colors"
              >
                Archive
              </button>
            </form>
          ) : null}

          {/* Sits WITH the other two rather than as faint text below the log.
              It was styled text-prose-faint/text-xs underlined to signal "destructive,
              tread carefully" and the result was that nobody could find it.
              Discoverability and caution aren't the same axis — the caution
              lives in the two-step confirm, not in low contrast. */}
          {!confirmingDelete ? (
            <Link
              href={`/goals/${goal.id}?confirm=delete`}
              className="min-h-11 inline-flex items-center rounded-lg border border-soft bg-surface px-5 py-3 text-xs font-semibold text-accent-text hover:bg-surface-hover transition-colors"
            >
              Delete
            </Link>
          ) : null}
        </div>

        {/* The finished case says the awkward part out loud rather than shipping a
            button that undoes itself: reopening a plan whose end date has passed
            puts it straight back in line to finish again on the next sweep, because
            finishing is derived from that date. Extending it first is the fix, and
            it's one tap from the panel at the top. */}
        <p className="text-xs text-prose-faint">
          {goal.status === 'archived'
            ? 'Archived goals sit out of the way. Restoring picks up where you left off — the sweep starts scheduling days again.'
            : finished
              ? 'Reopening puts it back on your list. If the end date has already passed it will finish again shortly — move that date on the edit page first, or start it again as a new plan.'
              : 'Pausing stops the nudges and stops new days being scheduled. Archiving hides it from your list. Either way the log stays put — you can come back to it.'}
        </p>

        {/* Deleting is a two-step confirm: it cascades through every occurrence
            and log entry with no undo, and a one-shot delete link would also be
            destroyable by a link prefetcher. The Delete button above only
            navigates here; this panel holds the only form that mutates. */}
        {confirmingDelete ? (
          <div className="rounded-xl border border-strong bg-surface-raised p-5">
            <p className="text-sm font-semibold text-prose">
              Delete &ldquo;{goal.title}&rdquo; for good?
            </p>
            <p className="mt-2 text-xs text-prose-muted">
              This removes the goal, its schedule, and all {entries.length} log
              {entries.length === 1 ? ' entry' : ' entries'}. It can&apos;t be undone.
              If you just want it out of the way, archive it instead.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <form action="/api/goals/delete" method="post">
                <input type="hidden" name="goalId" value={goal.id} />
                <input type="hidden" name="confirm" value="yes" />
                <button
                  type="submit"
                  className="min-h-11 rounded-lg border border-strong bg-surface px-5 py-3 text-xs font-bold text-accent-text hover:bg-surface-hover transition-colors"
                >
                  Yes, delete it
                </button>
              </form>
              <Link
                href={`/goals/${goal.id}`}
                className="min-h-11 inline-flex items-center rounded-lg px-5 py-3 text-xs font-semibold text-prose-muted hover:text-prose"
              >
                Keep it
              </Link>
            </div>
          </div>
        ) : null}
        </div>
      </details>
    </div>
  )
}

function isOpen(status: string): boolean {
  return status === 'pending' || status === 'notified' || status === 'missed' || status === 'snoozed'
}

// Deliberately gentle. "Over target" is information, not a verdict on the man —
// cessation and medication are edge-off topics (brand-guide §1.6).
function verdictCopy(verdict: 'better' | 'met' | 'over'): string {
  if (verdict === 'better') return 'Under the number. That counts.'
  if (verdict === 'met') return 'Right on the number.'
  return 'Over the number today. Tomorrow\'s a new one.'
}

/** Clock time in the GOAL's zone, never the server's. */
function timeInZone(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: 'numeric', minute: '2-digit',
  }).format(instant)
}

function entryKindCopy(kind: string): string {
  if (kind === 'skipped') return 'Skipped'
  if (kind === 'catchup') return 'Caught up'
  if (kind === 'relapse') return 'Logged'
  return 'Done'
}

/**
 * A fact as a pill. Deliberately neutral — a chip here is information, not a status,
 * so it takes no accent and no colour of its own. (Also: no pale bg-{colour}-50
 * chips on a dark canvas; that's the anti-pattern in feedback_dark_canvas.)
 */
function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-soft bg-surface-raised px-2.5 py-1 text-xs text-prose-muted">
      {children}
    </span>
  )
}

/**
 * A stat tile: the figure first, at a size you can read at arm's length, with the
 * label beneath it as a lower-case whisper.
 *
 * This was the other way round — a loud uppercase tracked label above a text-lg
 * value — which put the emphasis on the chrome and left three numbers looking like
 * three form fields. Proportional figures on purpose: `tabular-nums` on a large
 * standalone number makes "121" read loose, and these align with nothing.
 */
function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-soft bg-surface p-4">
      <dd className="text-3xl font-black leading-none text-prose">{value}</dd>
      <dt className="mt-1.5 text-xs text-prose-faint">{label}</dt>
      {hint ? <p className="text-[10px] text-prose-faint">{hint}</p> : null}
    </div>
  )
}

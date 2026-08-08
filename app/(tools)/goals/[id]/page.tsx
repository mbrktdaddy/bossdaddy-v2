// Goal detail. The one screen a dad actually looks at: what's due, where the
// curve sits today, and how to log it in one tap.
//
// Everything is a plain <form> bound to a Server Action, so this page works with
// JavaScript disabled and has no client bundle. Data comes through the session
// client, so RLS decides ownership — a goal that isn't yours is a 404, not a
// hand-written filter I could forget.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import { localDateInZone } from '@/lib/goals/recurrence'
import {
  computeStreak, adherenceRate, latestValue, progressToTarget, compareToTarget,
} from '@/lib/goals/progress'
import { describeRrule } from '@/lib/goals/schedule-input'
import { logOccurrence, logUnprompted, toggleScheduleMute, setGoalStatus } from '../actions'

export const metadata: Metadata = {
  title: LABELS.goals.pageTitle,
  robots: { index: false, follow: false },   // private data, never indexed
}

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ confirm?: string; msg?: string; saved?: string }>
}

type GoalRow = {
  id: string; title: string; description: string | null; kind: string; status: string
  metric_key: string | null; metric_unit: string | null; direction: string | null
  baseline_value: number | null; target_value: number | null
  curve: string; step_every_days: number | null
  started_on: string; target_date: string | null
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
}

export default async function GoalDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { confirm, msg, saved } = await searchParams
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
    .select('id, title, description, kind, status, metric_key, metric_unit, direction, baseline_value, target_value, curve, step_every_days, started_on, target_date')
    .eq('id', id)
    .maybeSingle()
  const goal = goalRow as unknown as GoalRow | null
  if (!goal) notFound()

  const [{ data: scheduleRows }, { data: occurrenceRows }, { data: entryRows }] = await Promise.all([
    supabase.from('goal_schedules')
      .select('id, label, rrule, local_time, timezone, muted, status, channels')
      .eq('goal_id', goal.id)
      .order('local_time', { ascending: true }),
    supabase.from('goal_occurrences')
      .select('id, local_date, local_time, status, target_value, due_at, shifted')
      .eq('goal_id', goal.id)
      .order('due_at', { ascending: true }),
    supabase.from('goal_entries')
      .select('id, local_date, kind, value, note')
      .eq('goal_id', goal.id)
      .order('local_date', { ascending: false })
      .limit(400),
  ])

  const schedules = (scheduleRows ?? []) as unknown as ScheduleRow[]
  const occurrences = (occurrenceRows ?? []) as unknown as OccurrenceRow[]
  const entries = (entryRows ?? []) as unknown as EntryRow[]

  const zone = schedules[0]?.timezone ?? 'UTC'
  const now = new Date()
  const today = localDateInZone(now, zone)

  const streak = computeStreak(entries, today)
  const { done, total, pct } = adherenceRate(occurrences)
  const latest = latestValue(entries)
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

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <div>
        <Link href="/goals" className="inline-flex items-center py-3 text-xs text-muted hover:text-prose">
          ← {LABELS.goals.short}
        </Link>
      </div>

      <header className="space-y-3">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {LABELS.goals.kinds[goal.kind] ?? LABELS.goals.kinds.custom}
          {goal.status === 'paused' ? ' · Paused' : ''}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-prose leading-[1.05] tracking-tight">
          {goal.title}
        </h1>
        {goal.description ? (
          <p className="text-base text-prose-muted leading-snug">{goal.description}</p>
        ) : null}
      </header>

      {msg === 'delete_failed' ? (
        <p className="rounded-lg border border-strong bg-surface-raised px-4 py-3 text-sm text-accent-text">
          That didn&apos;t delete. Try again, or archive it instead.
        </p>
      ) : null}
      {saved === '1' ? (
        <p className="rounded-lg border border-soft bg-surface px-4 py-3 text-sm text-muted">
          Saved.
        </p>
      ) : null}

      {/* ── the one thing to do ─────────────────────────────────────────── */}
      {actionable ? (
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
                <span className="text-sm text-muted">
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
                className="rounded-lg border border-soft bg-surface px-6 py-3 text-sm font-semibold text-muted hover:bg-surface-hover transition-colors"
              >
                Not today
              </button>
            </div>
          </form>
        </section>
      ) : (
        <section className="bg-surface border border-soft rounded-xl p-5 sm:p-6">
          <p className="text-sm text-muted">
            Nothing open right now.
            {upcoming[0] ? <> Next one lands {upcoming[0].local_date} at {upcoming[0].local_time.slice(0, 5)}.</> : null}
          </p>
        </section>
      )}

      {/* ── log something that wasn't scheduled ─────────────────────────── */}
      {/* Behind a <details> so it never competes with the primary action above,
          but present on every goal — an entry with no occurrence still counts
          toward the streak, because computeStreak folds by local date. Before
          this existed, an honest log on an off day had nowhere to go. */}
      <details className="rounded-xl border border-soft bg-surface p-5">
        <summary className="min-h-11 flex cursor-pointer items-center text-sm font-semibold text-prose">
          Log something else
        </summary>
        <p className="mt-2 text-xs text-faint">
          An extra workout, a weigh-in nobody asked for, an honest count on a day
          nothing was due.
        </p>
        <form action={logUnprompted} className="mt-4 space-y-3">
          <input type="hidden" name="goalId" value={goal.id} />

          {wantsNumber ? (
            <label className="block">
              <span className="text-sm text-muted">
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
              <span className="text-sm text-muted">Which day</span>
              <input
                type="date" name="localDate" defaultValue={today} max={today}
                className="mt-2 w-full rounded-lg border border-soft bg-surface-raised px-4 py-3 text-prose"
              />
            </label>
            <label className="block">
              <span className="text-sm text-muted">Note (optional)</span>
              <input
                type="text" name="note" maxLength={280}
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

      {/* ── where it stands ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-prose uppercase tracking-wide">Where it stands</h2>

        {progress != null ? (
          <div className="bg-surface border border-soft rounded-xl p-5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-3 text-sm text-muted">
              Started at <span className="text-prose">{goal.baseline_value}{unit}</span>,
              headed for <span className="text-prose">{goal.target_value}{unit}</span>
              {goal.target_date ? <> by {goal.target_date}</> : null}.
              {latest ? <> Last logged <span className="text-prose">{latest.value}{unit}</span> on {latest.localDate}.</> : null}
            </p>
            {latest && todays?.target_value != null ? (
              <p className="mt-2 text-sm text-muted">
                {verdictCopy(compareToTarget(latest.value, todays.target_value, goal.direction))}
              </p>
            ) : null}
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Days running" value={streak > 0 ? String(streak) : '—'} />
          <Stat label="Logged" value={pct != null ? `${pct}%` : '—'} hint={total > 0 ? `${done} of ${total}` : undefined} />
          <Stat label="Since" value={goal.started_on} />
        </dl>
      </section>

      {/* ── reminders ───────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-prose uppercase tracking-wide">Reminders</h2>
          <Link
            href={`/goals/${goal.id}/edit`}
            className="min-h-11 inline-flex items-center text-xs font-semibold text-accent-text hover:text-prose"
          >
            Edit goal &amp; reminders →
          </Link>
        </div>
        {schedules.length === 0 ? (
          <p className="text-sm text-faint">No schedule on this goal yet.</p>
        ) : schedules.map((schedule) => (
          <div key={schedule.id} className="bg-surface border border-soft rounded-xl p-5 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-prose">
                {schedule.label?.trim() || 'Reminder'}
              </p>
              <p className="mt-1 text-xs text-muted">
                {describeRrule(schedule.rrule, schedule.local_time)}
              </p>
              <p className="mt-1 text-xs text-faint">
                {schedule.timezone.replace(/_/g, ' ')} · {schedule.channels.join(' + ')}
              </p>
            </div>
            <form action={toggleScheduleMute} className="shrink-0">
              <input type="hidden" name="scheduleId" value={schedule.id} />
              <input type="hidden" name="goalId" value={goal.id} />
              <input type="hidden" name="muted" value={schedule.muted ? 'false' : 'true'} />
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-soft bg-surface px-5 py-3 text-xs font-semibold text-muted hover:bg-surface-hover transition-colors"
              >
                {schedule.muted ? 'Unmute' : 'Mute'}
              </button>
            </form>
          </div>
        ))}
      </section>

      {/* ── history ─────────────────────────────────────────────────────── */}
      {entries.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-prose uppercase tracking-wide">Log</h2>
          <ul className="divide-y divide-soft border border-soft rounded-xl overflow-hidden">
            {entries.slice(0, 14).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 bg-surface px-5 py-3">
                <span className="text-sm text-prose">{entry.local_date}</span>
                <span className="text-sm text-muted">
                  {entry.value != null ? `${entry.value}${unit}` : entryKindCopy(entry.kind)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── manage: pause, archive, delete ──────────────────────────────── */}
      <section className="space-y-4 border-t border-soft pt-6">
        <h2 className="text-sm font-bold text-prose uppercase tracking-wide">Manage</h2>

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
              {goal.status === 'archived' ? 'Restore' : goal.status === 'paused' ? 'Resume' : 'Pause'}
            </button>
          </form>

          {goal.status !== 'archived' ? (
            <form action={setGoalStatus}>
              <input type="hidden" name="goalId" value={goal.id} />
              <input type="hidden" name="status" value="archived" />
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-soft bg-surface px-5 py-3 text-xs font-semibold text-muted hover:bg-surface-hover transition-colors"
              >
                Archive
              </button>
            </form>
          ) : null}
        </div>

        <p className="text-xs text-faint">
          {goal.status === 'archived'
            ? 'Archived goals sit out of the way. Restoring picks up where you left off — the sweep starts scheduling days again.'
            : 'Pausing stops the nudges and stops new days being scheduled. Archiving hides it from your list. Either way the log stays put — you can come back to it.'}
        </p>

        {/* Deleting is a two-step confirm, not a one-tap button: it cascades
            through every occurrence and log entry, and there's no undo. A bare
            delete link would also be destroyable by a link prefetch. */}
        {confirmingDelete ? (
          <div className="rounded-xl border border-strong bg-surface-raised p-5">
            <p className="text-sm font-semibold text-prose">
              Delete &ldquo;{goal.title}&rdquo; for good?
            </p>
            <p className="mt-2 text-xs text-muted">
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
                className="min-h-11 inline-flex items-center rounded-lg px-5 py-3 text-xs font-semibold text-muted hover:text-prose"
              >
                Keep it
              </Link>
            </div>
          </div>
        ) : (
          <Link
            href={`/goals/${goal.id}?confirm=delete`}
            className="inline-flex items-center py-3 text-xs text-faint hover:text-muted underline"
          >
            Delete this goal
          </Link>
        )}
      </section>
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

function entryKindCopy(kind: string): string {
  if (kind === 'skipped') return 'Skipped'
  if (kind === 'catchup') return 'Caught up'
  if (kind === 'relapse') return 'Logged'
  return 'Done'
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-surface border border-soft rounded-xl p-4">
      <dt className="text-xs text-faint uppercase tracking-widest">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-prose">{value}</dd>
      {hint ? <p className="text-xs text-faint">{hint}</p> : null}
    </div>
  )
}

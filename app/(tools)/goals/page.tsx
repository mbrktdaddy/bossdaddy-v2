// Goals index. Authenticated-only surface: logged-out gets an explainer plus a
// sign-in CTA rather than a redirect — same shape as /tools/savings, and it
// avoids next/navigation's redirect() which this project's Sentry
// instrumentation swallows in Server Components.

import Link from 'next/link'
import type { Metadata } from 'next'
import { OG_SITE } from '@/lib/og'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import { computeStreak, adherenceRate, latestValue, progressToTarget } from '@/lib/goals/progress'
import { localDateInZone } from '@/lib/goals/recurrence'

export const metadata: Metadata = {
  title:       LABELS.goals.pageTitle,
  description: LABELS.goals.metaDescription,
  alternates:  { canonical: '/goals' },
  openGraph: {
    ...OG_SITE,
    title:       LABELS.goals.full,
    description: LABELS.goals.metaDescription,
  },
}

type GoalRow = {
  id: string
  title: string
  kind: string
  status: string
  metric_key: string | null
  metric_unit: string | null
  direction: string | null
  baseline_value: number | null
  target_value: number | null
  target_date: string | null
}

type ScheduleRow = { goal_id: string; timezone: string; local_time: string; muted: boolean }
type OccurrenceRow = { goal_id: string; local_date: string; status: string; target_value: number | null; due_at: string }
type EntryRow = { goal_id: string; local_date: string; kind: string; value: number | null }

type Props = { searchParams: Promise<{ archived?: string; deleted?: string }> }

export default async function GoalsIndexPage({ searchParams }: Props) {
  const { archived, deleted } = await searchParams
  const showArchived = archived === '1'
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (!user) return <SignedOut />

  // RLS scopes every one of these to the signed-in user — no user_id filter to
  // forget, and an admin browsing this page sees their own goals, not everyone's.
  const [{ data: goalRows }, { data: scheduleRows }] = await Promise.all([
    supabase.from('goals')
      .select('id, title, kind, status, metric_key, metric_unit, direction, baseline_value, target_value, target_date')
      .in('status', showArchived ? ['archived'] : ['active', 'paused'])
      .order('created_at', { ascending: false }),
    supabase.from('goal_schedules').select('goal_id, timezone, local_time, muted'),
  ])

  const goals = (goalRows ?? []) as unknown as GoalRow[]
  if (goals.length === 0) return <Empty showArchived={showArchived} deleted={deleted === '1'} />

  const schedules = (scheduleRows ?? []) as unknown as ScheduleRow[]
  const goalIds = goals.map((g) => g.id)

  const [{ data: occurrenceRows }, { data: entryRows }] = await Promise.all([
    supabase.from('goal_occurrences')
      .select('goal_id, local_date, status, target_value, due_at')
      .in('goal_id', goalIds)
      .order('due_at', { ascending: true }),
    supabase.from('goal_entries')
      .select('goal_id, local_date, kind, value')
      .in('goal_id', goalIds)
      .order('local_date', { ascending: false })
      .limit(2000),
  ])
  const occurrences = (occurrenceRows ?? []) as unknown as OccurrenceRow[]
  const entries = (entryRows ?? []) as unknown as EntryRow[]
  // `new Date()` rather than `Date.now()` — the React 19 purity lint flags the
  // latter in render. Same value, one call, reused below.
  const now = new Date()
  const nowMs = now.getTime()

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-3">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {LABELS.goals.spokeRole} · {LABELS.goals.short}
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-prose leading-[1.05] tracking-tight">
            {LABELS.goals.short}
          </h1>
        </div>
        <Link
          href="/goals/new"
          className="min-h-11 shrink-0 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
        >
          {LABELS.goals.newCta}
        </Link>
      </header>

      <ul className="space-y-4">
        {goals.map((goal) => {
          const schedule = schedules.find((s) => s.goal_id === goal.id)
          const zone = schedule?.timezone ?? 'UTC'
          const today = localDateInZone(now, zone)

          const mine = occurrences.filter((o) => o.goal_id === goal.id)
          const myEntries = entries.filter((e) => e.goal_id === goal.id)
          const streak = computeStreak(myEntries, today)
          const { pct } = adherenceRate(mine)
          const latest = latestValue(myEntries)
          const progress = progressToTarget(goal.baseline_value, goal.target_value, latest?.value ?? null)

          const todays = mine.find((o) => o.local_date === today)
          const next = mine.find((o) => new Date(o.due_at).getTime() > nowMs)
          const needsAction = todays && (todays.status === 'pending' || todays.status === 'notified' || todays.status === 'missed')

          return (
            <li key={goal.id}>
              <Link
                href={`/goals/${goal.id}`}
                className="block bg-surface border border-soft hover:border-strong rounded-xl p-5 sm:p-6 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
                      {LABELS.goals.kinds[goal.kind] ?? LABELS.goals.kinds.custom}
                      {goal.status === 'paused' ? ' · Paused' : ''}
                      {schedule?.muted ? ' · Muted' : ''}
                    </p>
                    <h2 className="mt-1 text-lg sm:text-xl font-bold text-prose truncate">
                      {goal.title}
                    </h2>
                  </div>
                  {needsAction ? (
                    <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">
                      Due
                    </span>
                  ) : null}
                </div>

                {progress != null ? (
                  <div className="mt-4">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-faint">
                      {goal.baseline_value}{unitOf(goal)} → {goal.target_value}{unitOf(goal)}
                      {latest ? <> · now at <span className="text-prose">{latest.value}{unitOf(goal)}</span></> : null}
                    </p>
                  </div>
                ) : null}

                <p className="mt-4 text-sm text-muted">
                  {streak > 0 ? <>{streak} day{streak === 1 ? '' : 's'} running</> : 'No run going yet'}
                  {pct != null ? <> · {pct}% logged</> : null}
                  {todays?.target_value != null ? <> · today: {todays.target_value}{unitOf(goal)}</> : null}
                  {!todays && next ? <> · next {next.local_date}</> : null}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="space-y-2 border-t border-soft pt-6">
        <p className="text-xs text-faint">
          Reminders arrive by push and email. Tap the link in either one to log
          without opening the app.
        </p>
        <Link
          href={showArchived ? '/goals' : '/goals?archived=1'}
          className="inline-flex items-center py-3 text-xs text-muted hover:text-prose underline"
        >
          {showArchived ? '← Back to active goals' : 'See archived goals'}
        </Link>
      </div>
    </div>
  )
}

function unitOf(goal: { metric_unit: string | null }): string {
  return goal.metric_unit ? ` ${goal.metric_unit}` : ''
}

function SignedOut() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
      <header className="space-y-3">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {LABELS.goals.spokeRole} · {LABELS.goals.short}
        </p>
        <h1 className="text-3xl sm:text-5xl font-black text-prose leading-[1.05] tracking-tight">
          {LABELS.goals.h1}
        </h1>
        <p className="text-base sm:text-lg text-prose-muted leading-snug max-w-xl">
          {LABELS.goals.tagline}
        </p>
      </header>

      <section className="bg-surface border border-soft rounded-xl p-6 sm:p-8 space-y-4">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          How it works
        </p>
        <ul className="space-y-3 text-prose-muted text-sm sm:text-base leading-snug">
          <li>1. Set the target — cut to zero over eight weeks, lift three times a week, take the vitamin.</li>
          <li>2. Pick when you want the nudge. Your clock, your timezone, not ours.</li>
          <li>3. Tap once to log it. From the notification, the email, or here.</li>
          <li>4. Miss a day and nothing yells at you. Catch up whenever.</li>
        </ul>
      </section>

      <LoginLink className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
        Sign in to start →
      </LoginLink>
    </div>
  )
}

function Empty({ showArchived, deleted }: { showArchived: boolean; deleted: boolean }) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">
      {deleted ? (
        <p className="rounded-lg border border-soft bg-surface px-4 py-3 text-sm text-muted">
          Gone. Log and all.
        </p>
      ) : null}
      <header className="space-y-3">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {LABELS.goals.spokeRole} · {LABELS.goals.short}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black text-prose leading-tight tracking-tight">
          {showArchived ? 'Nothing archived.' : LABELS.goals.emptyHeading}
        </h1>
        <p className="text-base text-prose-muted leading-snug max-w-xl">
          {showArchived
            ? 'Goals you archive show up here so nothing gets lost.'
            : LABELS.goals.emptyBody}
        </p>
      </header>
      {showArchived ? (
        <Link href="/goals" className="inline-flex items-center py-3 text-sm text-muted hover:text-prose underline">
          ← Back to active goals
        </Link>
      ) : (
        <Link
          href="/goals/new"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 font-semibold text-white hover:bg-accent-hover transition-colors"
        >
          {LABELS.goals.newCta} →
        </Link>
      )}
    </div>
  )
}

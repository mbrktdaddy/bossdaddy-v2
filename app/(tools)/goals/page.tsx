// Goals index. Authenticated-only surface: logged-out gets an explainer plus a
// sign-in CTA rather than a redirect — same shape as /tools/savings, and it
// avoids next/navigation's redirect() which this project's Sentry
// instrumentation swallows in Server Components.
//
// READS PRE-COMPUTED STATS. This page used to load up to 2,000 log entries across
// every goal and fold streaks in memory: correct, and O(all history) on a page a
// dad opens daily. `goal_stats` (mig 135) is written on every log and at the end
// of every sweep tick, so the fold happens where the writes already are and this
// page reads one row per goal.
//
// A goal with no stats row yet still renders — it just shows less. Stats are
// derived, never authoritative.

import Link from 'next/link'
import type { Metadata } from 'next'
import { OG_SITE } from '@/lib/og'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import { progressToTarget } from '@/lib/goals/progress'
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
  metric_unit: string | null
  baseline_value: number | null
  target_value: number | null
  identity_short: string | null
}

type ScheduleRow = { goal_id: string; timezone: string; muted: boolean }

type StatRow = {
  goal_id: string
  streak: number
  logged_done: number
  logged_total: number
  latest_value: number | null
  open_count: number
  next_due_at: string | null
  today_local_date: string | null
  today_target: number | null
}

type Props = {
  searchParams: Promise<{
    archived?: string; deleted?: string; msg?: string; confirmDelete?: string
  }>
}

export default async function GoalsIndexPage({ searchParams }: Props) {
  const { archived, deleted, msg, confirmDelete } = await searchParams
  const showArchived = archived === '1'
  // Ids arrive comma-separated from the bulk route's first POST. Capped so a
  // hand-edited URL cannot make this page render a thousand rows.
  const pendingDeleteIds = (confirmDelete ?? '').split(',').filter(Boolean).slice(0, 200)
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (!user) return <SignedOut />

  // RLS scopes every one of these to the signed-in user — no user_id filter to
  // forget, and an admin browsing this page sees their own goals, not everyone's.
  const [{ data: goalRows }, { data: scheduleRows }, { data: statRows }] = await Promise.all([
    supabase.from('goals')
      .select('id, title, kind, status, metric_unit, baseline_value, target_value, identity_short')
      .in('status', showArchived ? ['archived'] : ['active', 'paused'])
      .order('created_at', { ascending: false }),
    supabase.from('goal_schedules').select('goal_id, timezone, muted'),
    supabase.from('goal_stats')
      .select('goal_id, streak, logged_done, logged_total, latest_value, open_count, next_due_at, today_local_date, today_target'),
  ])

  const goals = (goalRows ?? []) as unknown as GoalRow[]
  if (goals.length === 0) return <Empty showArchived={showArchived} deleted={deleted === '1'} />

  const schedules = (scheduleRows ?? []) as unknown as ScheduleRow[]
  const stats = new Map(
    ((statRows ?? []) as unknown as StatRow[]).map((s) => [s.goal_id, s]),
  )
  const now = new Date()

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

      {msg ? (
        <p className="rounded-lg border border-soft bg-surface px-4 py-3 text-sm text-muted">
          {msg.slice(0, 200)}
        </p>
      ) : null}

      {/* Bulk delete confirm. Driven by ids in the query string rather than
          session state, so a refresh cannot silently re-fire it. */}
      {pendingDeleteIds.length ? (
        <section className="rounded-xl border border-strong bg-surface-raised p-5">
          <p className="text-sm font-semibold text-prose">
            Delete {pendingDeleteIds.length} goal{pendingDeleteIds.length === 1 ? '' : 's'} for good?
          </p>
          <ul className="mt-3 space-y-1 text-xs text-muted">
            {goals.filter((g) => pendingDeleteIds.includes(g.id)).map((g) => (
              <li key={g.id}>&middot; {g.title}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Their schedules, every logged day, and all history go with them. This
            cannot be undone &mdash; archive instead if you just want them out of the way.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action="/api/goals/bulk" method="post">
              <input type="hidden" name="op" value="delete" />
              <input type="hidden" name="confirm" value="yes" />
              <input type="hidden" name="scope" value="selected" />
              <input type="hidden" name="view" value={showArchived ? 'archived' : 'active'} />
              {pendingDeleteIds.map((gid) => (
                <input key={gid} type="hidden" name="goalIds" value={gid} />
              ))}
              <button
                type="submit"
                className="min-h-11 rounded-lg border border-strong bg-surface px-5 py-3 text-xs font-bold text-accent-text hover:bg-surface-hover transition-colors"
              >
                Yes, delete {pendingDeleteIds.length === 1 ? 'it' : 'them'}
              </button>
            </form>
            <Link
              href={showArchived ? '/goals?archived=1' : '/goals'}
              className="min-h-11 inline-flex items-center rounded-lg px-5 py-3 text-xs font-semibold text-muted hover:text-prose"
            >
              Keep them
            </Link>
          </div>
        </section>
      ) : null}

      <form action="/api/goals/bulk" method="post" className="space-y-4">
        <input type="hidden" name="view" value={showArchived ? 'archived' : 'active'} />

      <ul className="space-y-4">
        {goals.map((goal) => {
          const schedule = schedules.find((s) => s.goal_id === goal.id)
          const stat = stats.get(goal.id)
          const zone = schedule?.timezone ?? 'UTC'
          const today = safeToday(now, zone)

          const pct = stat && stat.logged_total > 0
            ? Math.round((stat.logged_done / stat.logged_total) * 100)
            : null
          const progress = progressToTarget(
            goal.baseline_value, goal.target_value, stat?.latest_value ?? null,
          )
          // A materialized "today" is wrong the moment the day rolls over, so the
          // stamped target only shows when its date agrees with this reader's.
          const todayTarget = stat && stat.today_local_date === today
            ? stat.today_target
            : null
          // open_count covers ANYTHING unresolved and due — including yesterday's
          // missed day, which the old today-only check stayed silent about.
          const openCount = stat?.open_count ?? 0

          return (
            <li key={goal.id} className="flex items-stretch gap-2">
              {/* Sibling of the anchor, never a child &mdash; a checkbox inside a
                  link is invalid HTML and unclickable. This keeps the whole card
                  tappable while still allowing selection. */}
              <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-soft bg-surface">
                <input
                  type="checkbox" name="goalIds" value={goal.id}
                  className="accent-accent"
                  aria-label={`Select ${goal.title}`}
                />
              </label>
              <Link
                href={`/goals/${goal.id}`}
                className="block flex-1 min-w-0 bg-surface border border-soft hover:border-strong rounded-xl p-4 sm:p-6 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
                      {LABELS.goals.kinds[goal.kind] ?? LABELS.goals.kinds.custom}
                      {goal.status === 'paused' ? ' · Paused' : ''}
                      {schedule?.muted ? ' · Muted' : ''}
                    </p>
                    {/* line-clamp-2, not truncate: the checkbox column costs ~52px
                        of card width, which leaves roughly 13 characters beside a
                        "Due" badge at 320px. Two lines fits a real goal name; one
                        clipped line reads like a bug. */}
                    <h2 className="mt-1 text-lg sm:text-xl font-bold text-prose line-clamp-2">
                      {goal.title}
                    </h2>
                    {/* The short identity, which is the only form that fits here —
                        a 160-character sentence would swamp the card. Absent for
                        goals with no identity set, and it never carries a count:
                        this row is who he's becoming, not how he's scoring. */}
                    {goal.identity_short ? (
                      <p className="mt-1 truncate text-xs text-muted">
                        {LABELS.goals.votingFor}: {goal.identity_short}
                      </p>
                    ) : null}
                  </div>
                  {openCount > 0 && goal.status === 'active' ? (
                    <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">
                      {openCount > 1 ? `${openCount} open` : 'Due'}
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
                      {stat?.latest_value != null ? (
                        <> · now at <span className="text-prose">{stat.latest_value}{unitOf(goal)}</span></>
                      ) : null}
                    </p>
                  </div>
                ) : null}

                <p className="mt-4 text-sm text-muted">
                  {stat && stat.streak > 0
                    ? <>{stat.streak} day{stat.streak === 1 ? '' : 's'} running</>
                    : 'No run going yet'}
                  {pct != null ? <> · {pct}% logged</> : null}
                  {todayTarget != null ? <> · today: {todayTarget}{unitOf(goal)}</> : null}
                  {openCount === 0 && stat?.next_due_at
                    ? <> · next {stat.next_due_at.slice(0, 10)}</>
                    : null}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>

        <fieldset className="rounded-xl border border-soft bg-surface p-5">
          <legend className="px-1 text-xs text-muted">Do this to several at once</legend>

          {/* Scope is a radio, not a "select all" checkbox: ticking every box from
              one control needs JavaScript, and the server already knows what is
              in this view. */}
          <div className="mt-1 space-y-2">
            {[
              { value: 'selected', label: 'Just the ones I check' },
              { value: 'all', label: showArchived ? 'Everything archived' : 'Every goal on this page' },
            ].map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-soft bg-surface-raised px-4 py-3"
              >
                <input
                  type="radio" name="scope" value={option.value}
                  defaultChecked={option.value === 'selected'}
                  className="accent-accent"
                />
                <span className="text-sm text-prose">{option.label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            {showArchived ? (
              <BulkButton op="restore" label="Restore" />
            ) : (
              <>
                <BulkButton op="pause" label="Pause" />
                <BulkButton op="resume" label="Resume" />
                <BulkButton op="archive" label="Archive" />
              </>
            )}
            <BulkButton op="delete" label="Delete" destructive />
          </div>

          <p className="mt-3 text-xs text-faint">
            Delete asks once more before anything goes. Pause and archive are
            reversible &mdash; your log survives either way.
          </p>
        </fieldset>
      </form>

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

function BulkButton({ op, label, destructive }: { op: string; label: string; destructive?: boolean }) {
  return (
    <button
      type="submit"
      name="op"
      value={op}
      className={`min-h-11 rounded-lg border px-5 py-3 text-xs font-semibold transition-colors hover:bg-surface-hover ${
        destructive
          ? 'border-strong bg-surface text-accent-text'
          : 'border-soft bg-surface text-prose'
      }`}
    >
      {label}
    </button>
  )
}

function unitOf(goal: { metric_unit: string | null }): string {
  return goal.metric_unit ? ` ${goal.metric_unit}` : ''
}

/** A bad stored zone must never blank the whole index. */
function safeToday(now: Date, zone: string): string {
  try {
    return localDateInZone(now, zone)
  } catch {
    return localDateInZone(now, 'UTC')
  }
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
        <Link
          href="/goals"
          className="inline-flex items-center py-3 text-sm text-muted hover:text-prose underline"
        >
          ← Back to active goals
        </Link>
      ) : (
        <Link
          href="/goals/new"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-white hover:bg-accent-hover transition-colors"
        >
          {LABELS.goals.newCta} →
        </Link>
      )}
    </div>
  )
}

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
import { OG_SITE, SITE_URL } from '@/lib/og'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import { progressToTarget } from '@/lib/goals/progress'
import { localDateInZone } from '@/lib/goals/recurrence'
import { unreadNoteCounts } from '@/lib/goals/notes'
import TodayCard from '@/components/goals/TodayCard'

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
  rate_30d_done: number
  rate_30d_total: number
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

  // ⚠️ EVERY ONE OF THESE FILTERS BY user_id EXPLICITLY. Do not remove them on
  // the grounds that RLS already scopes the rows — it no longer does what that
  // sentence used to mean, and this comment previously said "no user_id filter to
  // forget", which is how the bug shipped.
  //
  // Migration 137 added `goals_teammate_read` (plus the same on goal_schedules,
  // goal_stats, goal_occurrences and goal_entries) so a teammate can see the goal
  // they're supporting. Correct for that feature — and it means RLS no longer
  // equals "mine". An unfiltered read here put somebody else's goal in this list
  // as though the reader owned it, with edit and share controls attached.
  //
  // RLS stays the backstop. The filter is the app saying which rows it MEANT.
  const [{ data: goalRows }, { data: scheduleRows }, { data: statRows }, { count: sharedRaw }] = await Promise.all([
    supabase.from('goals')
      .select('id, title, kind, status, metric_unit, baseline_value, target_value, identity_short')
      .eq('user_id', user.id)
      // `completed` sits in the DEFAULT view, not the archive. A plan that just
      // finished is the last thing to hide from someone — he should see it, look at
      // it, and archive it himself when he's done with it. (Without this it would
      // vanish from both views the moment the sweep finished it.)
      .in('status', showArchived ? ['archived'] : ['active', 'paused', 'completed'])
      .order('created_at', { ascending: false }),
    supabase.from('goal_schedules').select('goal_id, timezone, muted').eq('user_id', user.id),
    supabase.from('goal_stats')
      .select('goal_id, streak, logged_done, logged_total, rate_30d_done, rate_30d_total, latest_value, open_count, next_due_at, today_local_date, today_target')
      .eq('user_id', user.id),
    // Goals OTHER people share with him. Counted against the definer view (mig
    // 137), which returns nothing unless he's a participant — head:true so this
    // costs no rows on a page that already does three reads.
    supabase.from('goal_share_summary').select('goal_id', { count: 'exact', head: true }),
  ])
  const sharedCount = sharedRaw ?? 0

  const goals = (goalRows ?? []) as unknown as GoalRow[]
  if (goals.length === 0) return <Empty showArchived={showArchived} deleted={deleted === '1'} />

  const schedules = (scheduleRows ?? []) as unknown as ScheduleRow[]
  const stats = new Map(
    ((statRows ?? []) as unknown as StatRow[]).map((s) => [s.goal_id, s]),
  )
  const now = new Date()

  // The page-level open count is GONE. It folded `goal_stats.open_count` across the
  // active goals — a second source for a number TodayCard reads from live occurrences,
  // and a stats row is only as fresh as the last sweep tick. One source now; the
  // per-card "Due" badges below still read open_count, which is correct for a badge
  // that describes one goal's own row.

  // The calendar subscription, if he's made one. Read here rather than in the panel
  // so the whole page stays one render pass with no nested async component.
  const { data: calendarRow } = await supabase
    .from('goal_calendar_tokens')
    .select('token')
    .maybeSingle()
  const calendarToken = (calendarRow as { token: string } | null)?.token ?? null

  // Unread notes per goal, in ONE call rather than one per card. The RPC applies
  // the same access check the feed does, so a badge can never advertise notes this
  // reader can't open.
  const unreadNotes = await unreadNoteCounts(supabase, 'goal', goals.map((g) => g.id))
  // webcal:// is what makes a tap on a phone offer to subscribe instead of
  // downloading a file. Same URL, different scheme — so the host comes from the
  // canonical SITE_URL rather than being rebuilt by hand.
  const calendarFeedUrl = calendarToken
    ? `webcal://${new URL(SITE_URL).host}/api/goals/calendar/${calendarToken}`
    : null

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
        <p className="rounded-lg border border-soft bg-surface px-4 py-3 text-sm text-prose-muted">
          {msg.slice(0, 200)}
        </p>
      ) : null}

      {/* Straight to the day's work. Above the goal list on purpose: this page is
          for managing goals, /today is for doing them, and "doing" is the common
          errand.

          NOW THE SHARED CARD. This was a bespoke panel here, which is how /tools and
          /account ended up with no equivalent at all — and it read its count from
          `openTotal`, folded out of goal_stats, while /today counts live occurrences.
          Two sources for one number is how a card comes to claim two things waiting
          and link to a page listing three.

          COMPACT HERE, and for the same reason. The full card lists the next four
          items; every goal below it already carries its own "Due" / "N open" badge and
          today's target — so the preview rows said it twice on one screen, and the two
          halves don't even share a source (the card counts live occurrences, the badges
          read goal_stats). The verdict, the week and the way through are what this page
          can't say for itself. */}
      <TodayCard userId={user.id} variant="compact" />

      {/* Only when someone actually shared something. An always-on link would be
          clutter for the many people nobody has invited. */}
      {sharedCount > 0 ? (
        <Link
          href="/goals/shared"
          className="flex items-center justify-between gap-3 rounded-xl border border-soft bg-surface px-4 py-3 hover:border-strong transition-colors"
        >
          <span className="text-sm text-prose">
            {LABELS.goals.sharedHeading}
            <span className="text-prose-muted"> · {sharedCount} shared with you</span>
          </span>
          <span className="text-xs font-semibold text-accent-text">Look →</span>
        </Link>
      ) : null}

      {/* Bulk delete confirm. Driven by ids in the query string rather than
          session state, so a refresh cannot silently re-fire it. */}
      {pendingDeleteIds.length ? (
        <section className="rounded-xl border border-strong bg-surface-raised p-5">
          <p className="text-sm font-semibold text-prose">
            Delete {pendingDeleteIds.length} goal{pendingDeleteIds.length === 1 ? '' : 's'} for good?
          </p>
          <ul className="mt-3 space-y-1 text-xs text-prose-muted">
            {goals.filter((g) => pendingDeleteIds.includes(g.id)).map((g) => (
              <li key={g.id}>&middot; {g.title}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-prose-muted">
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
              className="min-h-11 inline-flex items-center rounded-lg px-5 py-3 text-xs font-semibold text-prose-muted hover:text-prose"
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

          // Rolling 30 days, falling back to lifetime when nothing resolved in the
          // window. The card has no room to name which one it's showing — the
          // detail page's hint does that — so the rule is "the most current number
          // available", never a lifetime figure when a recent one exists.
          const pct = stat && stat.rate_30d_total > 0
            ? Math.round((stat.rate_30d_done / stat.rate_30d_total) * 100)
            : stat && stat.logged_total > 0
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
              {/* The CARD is this div, not the anchor. Splitting them is what lets
                  a labelled Share row live inside the card border — a link can't
                  nest inside a link, same constraint that puts the checkbox
                  outside. The upper area stays one big tap target for opening. */}
              <div className="flex-1 min-w-0 overflow-hidden rounded-xl border border-soft bg-surface transition-colors hover:border-strong">
              <Link
                href={`/goals/${goal.id}`}
                className="block p-4 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
                      {LABELS.goals.kinds[goal.kind] ?? LABELS.goals.kinds.custom}
                      {goal.status === 'paused' ? ' · Paused' : ''}
                      {goal.status === 'completed' ? ' · Finished' : ''}
                      {/* Mute is about nudges, and a finished plan sends none — so
                          saying "Muted" there would describe a setting that no
                          longer does anything. */}
                      {schedule?.muted && goal.status !== 'completed' ? ' · Muted' : ''}
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
                      <p className="mt-1 truncate text-xs text-prose-muted">
                        {LABELS.goals.votingFor}: {goal.identity_short}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {openCount > 0 && goal.status === 'active' ? (
                      <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">
                        {openCount > 1 ? `${openCount} open` : 'Due'}
                      </span>
                    ) : null}
                    {/* Unread notes. Shown on PAUSED and ARCHIVED goals too, unlike
                        the Due badge: a paused goal isn't asking anything of you,
                        but a person who wrote in it is, and that's the one thing
                        worth surfacing on a goal you've set down. */}
                    {(unreadNotes.get(goal.id) ?? 0) > 0 ? (
                      <span className="rounded-full border border-strong bg-surface-raised px-3 py-1 text-xs font-bold text-accent-text">
                        {unreadNotes.get(goal.id)} new
                      </span>
                    ) : null}
                  </div>
                </div>

                {progress != null ? (
                  <div className="mt-4">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${Math.round(progress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-prose-faint">
                      {goal.baseline_value}{unitOf(goal)} → {goal.target_value}{unitOf(goal)}
                      {stat?.latest_value != null ? (
                        <> · now at <span className="text-prose">{stat.latest_value}{unitOf(goal)}</span></>
                      ) : null}
                    </p>
                  </div>
                ) : null}

                <p className="mt-4 text-sm text-prose-muted">
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

              {/* LABELLED, not an icon in the rail. The first attempt was an
                  icon-only button beside the checkbox, which read as a second
                  selection control and made the reader guess at a person-plus
                  glyph. A word costs nothing here and takes no width from the
                  title, which is already under pressure from the checkbox column.

                  Reachable without opening the goal: sharing used to sit one level
                  down, so bringing three people into three goals meant six
                  navigations. */}
              {showArchived ? null : (
                <Link
                  href={`/goals/${goal.id}/share`}
                  aria-label={`${LABELS.goals.shareShort} ${goal.title}`}
                  className="flex min-h-11 items-center gap-2 border-t border-soft px-4 text-xs font-semibold text-prose-muted transition-colors hover:bg-surface-hover hover:text-accent-text sm:px-6"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-1a4 4 0 00-3-3.87M9 20H4v-1a4 4 0 013-3.87m10-4.63a3 3 0 11-6 0 3 3 0 016 0zM19 8v6m3-3h-6" />
                  </svg>
                  {LABELS.goals.shareCta}
                </Link>
              )}
              </div>
            </li>
          )
        })}
      </ul>

        <fieldset className="rounded-xl border border-soft bg-surface p-5">
          <legend className="px-1 text-xs text-prose-muted">Do this to several at once</legend>

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

          <p className="mt-3 text-xs text-prose-faint">
            Delete asks once more before anything goes. Pause and archive are
            reversible &mdash; your log survives either way.
          </p>
        </fieldset>
      </form>

      {/* ── calendar subscription ───────────────────────────────────────────
          Collapsed: useful, but not what anyone came here for. Anchored so the
          route handler can bring him back to it opened after minting a link. */}
      <details id="calendar" className="rounded-xl border border-soft bg-surface p-5">
        <summary className="min-h-11 flex cursor-pointer items-center text-sm font-semibold text-prose">
          Put these in your calendar
        </summary>

        {calendarToken ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-prose-muted">
              Subscribe to this in Google Calendar, Apple Calendar or Outlook. It
              updates itself when you change a reminder.
            </p>
            {/* Selectable text, not a copy button — a button needs client JS, and
                long-press-to-copy is native on the phone this is built for. */}
            <p className="break-all rounded-lg border border-soft bg-surface-raised px-4 py-3 font-mono text-[11px] text-accent-text">
              {calendarFeedUrl}
            </p>
            <p className="text-xs text-prose-faint">
              Anyone with that link can read your goal titles and times without
              signing in — that&apos;s how calendar subscriptions work. Reset it if
              it gets out.
            </p>
            <div className="flex flex-wrap gap-2">
              <form action="/api/goals/calendar" method="post">
                <input type="hidden" name="op" value="reset" />
                <button
                  type="submit"
                  className="min-h-11 rounded-lg border border-soft bg-surface px-4 py-3 text-xs font-semibold text-prose hover:bg-surface-hover transition-colors"
                >
                  Reset the link
                </button>
              </form>
              <form action="/api/goals/calendar" method="post">
                <input type="hidden" name="op" value="remove" />
                <button
                  type="submit"
                  className="min-h-11 rounded-lg border border-soft bg-surface px-4 py-3 text-xs font-semibold text-accent-text hover:bg-surface-hover transition-colors"
                >
                  Turn it off
                </button>
              </form>
            </div>
          </div>
        ) : (
          <form action="/api/goals/calendar" method="post" className="mt-4 space-y-3">
            <input type="hidden" name="op" value="create" />
            <p className="text-xs text-prose-muted">
              You&apos;ll get a private link to subscribe to. Your active goals show
              up as recurring events — <span className="text-prose">under their real
              names</span>, so bear that in mind if the calendar you add it to is one
              you share. No alarms: your push and email reminders already cover that.
            </p>
            <button
              type="submit"
              className="min-h-11 w-full rounded-lg border border-strong bg-surface-raised px-5 py-3 text-xs font-bold text-prose hover:bg-surface-hover transition-colors"
            >
              Make me a calendar link
            </button>
          </form>
        )}
      </details>

      <div className="space-y-2 border-t border-soft pt-6">
        <p className="text-xs text-prose-faint">
          Reminders arrive by push and email. Tap the link in either one to log
          without opening the app.
        </p>
        <Link
          href={showArchived ? '/goals' : '/goals?archived=1'}
          className="inline-flex items-center py-3 text-xs text-prose-muted hover:text-prose underline"
        >
          {showArchived ? '← Active goals' : 'See archived goals'}
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
        <p className="rounded-lg border border-soft bg-surface px-4 py-3 text-sm text-prose-muted">
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
          className="inline-flex items-center py-3 text-sm text-prose-muted hover:text-prose underline"
        >
          ← Active goals
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

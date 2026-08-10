// One goal someone has shared with you.
//
// Reads `goal_share_summary` and `goal_share_days` and NOTHING ELSE. The calendar
// comes back empty for a cheer-level partner because the view's WHERE clause
// refuses them — there is no tier branch in this file to get wrong, which is the
// point of doing the filtering in SQL.
//
// What you will not find here, at any tier below teammate: a number, a LOG note,
// a reminder time, or his identity statement. A partner is here to notice, not to
// audit.
//
// ⚠️ THE NOTES FEED AT THE BOTTOM IS NOT AN EXCEPTION TO THAT. Two different
//    things are called "notes" in this domain and they are gated by two different
//    columns. `goal_entries.note` is what he wrote NEXT TO A LOGGED DOSE — data
//    the system collected, withheld from everyone below teammate, and still
//    withheld here. `goal_notes` is what he chose to SAY TO YOU, gated by
//    thread_access, which is orthogonal to tier on purpose (migration 145). A
//    cheer partner who can see no numbers and no calendar can still be in the
//    conversation, and for a lot of people that combination is the whole point.
//    NotesFeed renders nothing at all when thread_access is 'none'.
//
// And the leave button. Stepping out takes nobody's permission and tells nobody.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import { getSharedGoal, listSharedDays, TIER_COPY } from '@/lib/goals/participants'
import NotesFeed from '@/components/goals/NotesFeed'
import { planWindow } from '@/lib/goals/progress'

export const metadata: Metadata = {
  title: `${LABELS.goals.sharedHeading} — ${LABELS.goals.short}`,
  robots: { index: false, follow: false },
}

type Props = { params: Promise<{ id: string }> }

const DAY_STYLE: Record<string, { dot: string; label: string }> = {
  // No red. A missed day on someone else's cessation goal is not a scoreboard for
  // the watcher, and colouring it like a failure invites exactly the wrong reaction.
  done:    { dot: 'bg-accent',            label: 'done' },
  missed:  { dot: 'bg-surface-hover',     label: 'missed' },
  skipped: { dot: 'bg-surface-raised',    label: 'skipped' },
  open:    { dot: 'bg-surface-raised/50', label: 'not yet' },
}

export default async function SharedGoalPage({ params }: Props) {
  const { id } = await params

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return (
      <Wrap>
        <h1 className="text-2xl font-black text-prose">Sign in to see this.</h1>
        <LoginLink className="mt-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Sign in →
        </LoginLink>
      </Wrap>
    )
  }

  // The view returns nothing for a non-participant, so this is a 404 rather than a
  // "you don't have access" page — which would confirm the goal exists.
  const goal = await getSharedGoal(supabase, id)
  if (!goal) notFound()

  const days = await listSharedDays(supabase, id, 42)
  const win = planWindow(goal.startedOn, goal.targetDate, todayIsh(goal.startedOn))

  return (
    <Wrap>
      <Link href="/goals/shared" className="inline-flex items-center py-3 text-xs text-muted hover:text-prose">
        ← {LABELS.goals.sharedHeading}
      </Link>

      <header className="mt-4 space-y-2">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {TIER_COPY[goal.myTier].label}
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-prose leading-tight tracking-tight">
          {goal.title}
        </h1>
        {goal.status === 'paused' ? (
          <p className="text-sm text-muted">He&apos;s got this one paused right now.</p>
        ) : null}
      </header>

      {/* ── where it stands ─────────────────────────────────────────────────── */}
      <dl className="mt-8 grid grid-cols-2 gap-3">
        <Stat
          label="Days running"
          value={goal.streak && goal.streak > 0 ? String(goal.streak) : '—'}
        />
        <Stat
          label={win?.planDays ? 'Day of plan' : 'Going since'}
          value={win?.planDays && win.dayInPlan > 0 ? `${win.dayInPlan} of ${win.planDays}` : goal.startedOn}
        />
      </dl>

      {/* ── the calendar, for witness and up ────────────────────────────────── */}
      {days.length > 0 ? (
        <section className="mt-10 space-y-3">
          <h2 className="text-sm font-bold text-prose uppercase tracking-wide">Last few weeks</h2>
          <div className="flex flex-wrap gap-1.5">
            {[...days].reverse().map((day) => {
              const style = DAY_STYLE[day.state] ?? DAY_STYLE.open
              return (
                <span
                  key={day.localDate}
                  title={`${day.localDate} — ${style.label}`}
                  className={`h-6 w-6 rounded ${style.dot}`}
                />
              )
            })}
          </div>
          <p className="text-xs text-faint">
            One square a day. Filled means he did it. Nothing here shows numbers or
            anything he wrote down.
          </p>
        </section>
      ) : (
        <section className="mt-10">
          <p className="text-sm text-muted">
            {TIER_COPY[goal.myTier].sees}
          </p>
          <p className="mt-2 text-xs text-faint">{TIER_COPY[goal.myTier].blind}</p>
        </section>
      )}

      {/* ── the conversation ────────────────────────────────────────────────
          Renders nothing unless the owner granted thread_access. readerCount is
          1 rather than a query: from a partner's seat the owner is always on the
          other end, so this is never the journal face. */}
      <div className="mt-10">
        <NotesFeed subject={{ type: 'goal', id: goal.goalId }} readerCount={1} isSubjectOwner={false} />
      </div>

      {/* ── step out ────────────────────────────────────────────────────────── */}
      <section className="mt-12 border-t border-soft pt-6">
        <form action="/api/goals/share" method="post">
          <input type="hidden" name="op" value="end_share" />
          <input type="hidden" name="goalId" value={goal.goalId} />
          <input type="hidden" name="participantUserId" value={user.id} />
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-soft bg-surface px-5 py-3 text-xs font-semibold text-accent-text hover:bg-surface-hover transition-colors"
          >
            Step out of this
          </button>
        </form>
        <p className="mt-3 text-xs text-faint">
          Takes effect right away. He isn&apos;t told, and you don&apos;t need his
          say-so — if he wants you back in, he&apos;ll send a fresh invite.
        </p>
      </section>
    </Wrap>
  )
}

/** See the note in /goals/shared — the view withholds the goal's timezone. */
function todayIsh(startedOn: string): string {
  const now = new Date()
  const ymd = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`
  return ymd < startedOn ? startedOn : ymd
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-soft bg-surface p-4">
      <dt className="text-xs text-faint uppercase tracking-widest">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-prose">{value}</dd>
    </div>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</div>
}

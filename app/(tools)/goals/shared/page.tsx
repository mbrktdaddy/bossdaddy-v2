// Goals other people have shared with you.
//
// EVERY FIGURE ON THIS PAGE COMES FROM `goal_share_summary`, the definer view from
// migration 137 — never from `goals` or `goal_stats`. That's not stylistic: the
// base tables carry the numbers, the notes and the identity statement, and the
// whole tier system is a column filter the view performs. Reaching past it here
// would hand a cheer-level partner the contents of a medication log.
//
// Nothing on this page is ever pushed to you. You look when you want to.

import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { LoginLink } from '@/components/LoginLink'
import { listSharedWithMe, TIER_COPY } from '@/lib/goals/participants'
import { planWindow } from '@/lib/goals/progress'

export const metadata: Metadata = {
  title: `In your corner — ${LABELS.goals.short}`,
  robots: { index: false, follow: false },
}

type Props = { searchParams: Promise<{ declined?: string }> }

export default async function SharedGoalsPage({ searchParams }: Props) {
  const { declined } = await searchParams

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) {
    return (
      <Wrap>
        <h1 className="text-2xl font-black text-prose">Sign in to see what&apos;s shared with you.</h1>
        <LoginLink className="mt-6 inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
          Sign in →
        </LoginLink>
      </Wrap>
    )
  }

  const shared = await listSharedWithMe(supabase)

  return (
    <Wrap>
      <Link href="/goals" className="inline-flex items-center py-3 text-xs text-muted hover:text-prose">
        ← {LABELS.goals.short}
      </Link>

      <header className="mt-4 space-y-2">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {LABELS.goals.sharedEyebrow}
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-prose leading-tight tracking-tight">
          {LABELS.goals.sharedHeading}
        </h1>
      </header>

      {declined === '1' ? (
        <p className="mt-6 rounded-lg border border-soft bg-surface px-4 py-3 text-sm text-muted">
          Turned that one down. Nobody was told.
        </p>
      ) : null}

      {shared.length === 0 ? (
        <p className="mt-8 rounded-xl border border-soft bg-surface p-5 text-sm text-muted">
          {LABELS.goals.sharedEmpty}
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {shared.map((g) => {
            const win = planWindow(g.startedOn, g.targetDate, todayIsh(g))
            const facts: string[] = []
            if (g.status === 'paused') facts.push('Paused')
            if (win?.planDays && win.dayInPlan > 0) facts.push(`Day ${win.dayInPlan} of ${win.planDays}`)
            if (g.streak && g.streak > 0) facts.push(`${g.streak} day${g.streak === 1 ? '' : 's'} running`)
            if (!facts.length) facts.push('Just getting going')

            return (
              <li key={g.goalId}>
                <Link
                  href={`/goals/shared/${g.goalId}`}
                  className="block rounded-xl border border-soft bg-surface p-5 hover:border-strong transition-colors"
                >
                  <p className="text-base font-bold text-prose">{g.title}</p>
                  <p className="mt-1 text-sm text-muted">{facts.slice(0, 2).join(' · ')}</p>
                  <p className="mt-2 text-xs text-faint">{TIER_COPY[g.myTier].label}</p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-8 text-xs text-faint">
        You can step out of any of these whenever you want, and you don&apos;t need
        to ask. Nobody gets told either way.
      </p>
    </Wrap>
  )
}

/**
 * The view deliberately doesn't expose the goal's timezone — that's the owner's
 * reminder plumbing — so "which day of the plan is it" is computed against the
 * server's date here. Off by at most a day at the edges, which is the right
 * trade for not leaking where a man lives.
 */
function todayIsh(g: { startedOn: string }): string {
  const now = new Date()
  const ymd = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`
  return ymd < g.startedOn ? g.startedOn : ymd
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">{children}</div>
}

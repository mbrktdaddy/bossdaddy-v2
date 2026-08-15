// "What you're working on" — one list on the profile for both kinds of goal.
//
// WHY THE TWO KINDS SHARE A SURFACE BUT NOT A TABLE.
// `savings_goals` (078) and the goals spine (134) are separate schemas on purpose:
// savings carries multi-participant sharing, invitations, kid links and money
// destinations, and folding that onto the spine was the "doubled surface"
// migration 134 declined. But a dad doesn't have two mental categories — he has
// things he's working on. Before this section the profile showed savings goals and
// nothing else, which made the whole goals spine invisible from the one page every
// member actually visits.
//
// So: two tables underneath, one list on top. When savings eventually folds into
// the spine as kind='savings', this component collapses to a single query and
// nothing above it changes.
//
// Compact rows only. The real state — the curve, the log, votes, reminders — lives
// on each goal's own page; this is for scanning.

import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { loadPickableGoals, loadStatsFor } from '@/lib/goals/pick'
import { planWindow } from '@/lib/goals/progress'
import { getGoals } from '@/lib/dad-tools/savings-actions'
import { fmtUsdWhole } from '@/lib/dad-tools/savings'

const ROW_CAP = 8

/**
 * `userId` is optional and skips an auth round trip when the caller already has it.
 * Both surfaces that render this resolve the user anyway, and getUserSafe is a real
 * network call to Supabase Auth — the same round trip the tools layout was rewritten
 * to stop paying on every page. Falls back to resolving it, so the component still
 * works dropped anywhere.
 */
export default async function WorkingOnSection({ userId }: { userId?: string } = {}) {
  const supabase = await createClient()
  let ownerId = userId
  if (!ownerId) {
    const { user } = await getUserSafe(supabase)
    ownerId = user?.id
  }
  if (!ownerId) return null
  const user = { id: ownerId }

  const goals = await loadPickableGoals(supabase, user.id)
  const [stats, savings] = await Promise.all([
    loadStatsFor(supabase, goals.map((g) => g.id)),
    // RLS scopes this to owned + joined goals, archived excluded.
    getGoals(),
  ])

  const total = goals.length + savings.length
  const goalRows = goals.slice(0, ROW_CAP)
  const savingsRows = savings.slice(0, Math.max(0, ROW_CAP - goalRows.length))
  const hidden = total - goalRows.length - savingsRows.length

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-prose-faint font-medium uppercase tracking-widest">
          {LABELS.goals.workingOnHeading}
        </p>
        {total > 0 && (
          <Link
            href="/goals/new"
            className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
          >
            + {LABELS.goals.newCta}
          </Link>
        )}
      </div>

      {total === 0 ? (
        <Link
          href="/goals/new"
          className="block bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-xl p-4 transition-colors group"
        >
          <p className="text-sm font-semibold text-prose group-hover:text-accent-text-soft transition-colors">
            {LABELS.goals.emptyHeading}
          </p>
          <p className="text-xs text-prose-faint mt-1">{LABELS.goals.emptyBody}</p>
        </Link>
      ) : (
        <div className="space-y-1.5">
          {goalRows.map((goal) => {
            const stat = stats.get(goal.id)
            const win = planWindow(goal.started_on, goal.target_date, stat?.today_local_date ?? goal.started_on)

            // Two facts, chosen by what's actually informative: where he is in the
            // plan if it has an end, otherwise how long the run is.
            const facts: string[] = []
            if (goal.status === 'paused') facts.push('Paused')
            if (win?.planDays && win.dayInPlan > 0) facts.push(`Day ${win.dayInPlan} of ${win.planDays}`)
            if (stat && stat.streak > 0) facts.push(`${stat.streak} day${stat.streak === 1 ? '' : 's'} running`)
            if (!facts.length) facts.push(goal.identity_short || 'Just started')

            const due = goal.status === 'active' && (stat?.open_count ?? 0) > 0

            return (
              <Row
                key={goal.id}
                href={`/goals/${goal.id}`}
                title={goal.title}
                sub={facts.slice(0, 2).join(' · ')}
                badge={due ? 'Due' : null}
              />
            )
          })}

          {savingsRows.map(({ goal, stats: s }) => (
            <Row
              key={goal.id}
              href={`/tools/savings/${goal.id}`}
              title={goal.name}
              sub={LABELS.tools.savings.short}
              // The dollar figure IS the state of a savings goal — it earns the
              // right-hand slot the way "Due" does on a scheduled one.
              value={fmtUsdWhole(s.runningTotal)}
            />
          ))}

          {/* GATED AGAIN — same shape as the original, for a different and now-valid
              reason. It was gated on `hidden > 0`, which stranded anyone with eight or
              fewer goals: this was the ONLY route to /goals on the page, so hiding it
              hid the exit. The launcher row at the top of /tools now owns navigation,
              which leaves this link exactly one job — "the list is cut off, see the
              rest" — and that job genuinely only exists when it IS cut off.

              ⚠️ If this section is ever placed on a surface WITHOUT the launcher, the
              exit disappears again. That's the trap the first version fell into. */}
          {hidden > 0 && (
            <Link
              href="/goals"
              className="block text-center text-xs font-semibold text-accent hover:text-accent-hover py-2 transition-colors"
            >
              See all {total} →
            </Link>
          )}

          {/* "Start a savings goal →" removed. This is a STATUS LIST, and that link was
              advertising a product line inside it to anybody who hadn't opted in — the
              one thing on the page that wasn't about what he's already carrying. The
              Savings tile is in the launcher at the top, and /tools/savings has its own
              create CTA, so nothing is unreachable. */}
        </div>
      )}
    </section>
  )
}

function Row({
  href, title, sub, badge, value,
}: {
  href: string
  title: string
  sub: string
  badge?: string | null
  value?: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2.5 bg-surface-sunken border border-soft hover:border-accent-border/60 rounded-lg transition-colors group min-h-[44px]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-prose group-hover:text-accent-text-soft transition-colors truncate">
          {title}
        </p>
        <p className="text-[11px] text-prose-faint truncate">{sub}</p>
      </div>
      {badge && (
        <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
      {value && (
        <p className="shrink-0 text-sm font-black text-prose tabular-nums">{value}</p>
      )}
      <svg className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

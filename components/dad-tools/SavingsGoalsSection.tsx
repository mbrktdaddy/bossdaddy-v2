// Compact single-line list of the user's active savings goals on account
// pages. Each row → /tools/savings/[id] where the full state (streak, banked
// days, history, withdrawal, catch-up plan) lives. Heavy detail stays off
// the settings page; this section just scans.

import Link from 'next/link'
import { getGoals } from '@/lib/dad-tools/savings-actions'
import { getKids } from '@/lib/dad-tools/kid-actions'
import { LABELS } from '@/lib/labels'
import { fmtUsdWhole, cadenceUnitLabel } from '@/lib/dad-tools/savings'

const ROW_CAP = 6

export default async function SavingsGoalsSection() {
  const [goals, kids] = await Promise.all([getGoals(), getKids()])
  const kidNameById = new Map(kids.map((k) => [k.id, k.name?.trim() || 'Unnamed kid']))

  const visibleGoals = goals.slice(0, ROW_CAP)
  const hiddenCount = Math.max(0, goals.length - ROW_CAP)

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-prose-faint font-medium uppercase tracking-widest">
          {LABELS.tools.savings.full}
        </p>
        {goals.length > 0 && (
          <Link
            href="/tools/savings/new"
            className="text-xs font-semibold text-accent hover:text-accent-hover transition-colors"
          >
            + New goal
          </Link>
        )}
      </div>

      {goals.length === 0 ? (
        <Link
          href="/tools/savings/new"
          className="block bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-xl p-4 transition-colors group"
        >
          <p className="text-sm font-semibold text-prose group-hover:text-accent-text-soft transition-colors">
            {LABELS.tools.savings.indexEmptyTitle}
          </p>
          <p className="text-xs text-prose-faint mt-1">
            {LABELS.tools.savings.indexEmptyBody}
          </p>
        </Link>
      ) : (
        <div className="space-y-1.5">
          {visibleGoals.map(({ goal, stats }) => {
            const kidName = goal.kid_profile_id ? kidNameById.get(goal.kid_profile_id) : null
            return (
              <Link
                key={goal.id}
                href={`/tools/savings/${goal.id}`}
                className="flex items-center gap-3 px-3 py-2.5 bg-surface-sunken border border-soft hover:border-accent-border/60 rounded-lg transition-colors group min-h-[44px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-prose group-hover:text-accent-text-soft transition-colors truncate">
                    {goal.name}
                  </p>
                  <p className="text-[11px] text-prose-faint truncate">
                    {kidName ? `For ${kidName}` : 'Personal'}
                    {goal.cadence && ` · ${fmtUsdWhole(Number(goal.amount_per_cadence) || 0)}/${goal.cadence}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-black text-prose tabular-nums">
                    {fmtUsdWhole(stats.runningTotal)}
                  </p>
                  {goal.cadence && stats.streak != null && stats.streak > 0 && (
                    <p className="text-[10px] text-prose-faint">
                      {cadenceUnitLabel(goal.cadence, stats.streak)}
                    </p>
                  )}
                </div>
                <svg className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )
          })}
          {hiddenCount > 0 && (
            <Link
              href="/tools/savings"
              className="block text-center text-xs font-semibold text-accent hover:text-accent-hover py-2 transition-colors"
            >
              See all {goals.length} goals →
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

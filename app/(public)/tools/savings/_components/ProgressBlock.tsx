// The big stats panel on a goal's detail page. Total saved, streak,
// banked days, ahead/behind, last activity. Server Component.

import { LABELS } from '@/lib/labels'
import type { SavingsGoal, GoalStats } from '@/lib/dad-tools/savings'
import { fmtUsdWhole, fmtUsd, cadenceUnitLabel } from '@/lib/dad-tools/savings'

interface Props {
  goal:  SavingsGoal
  stats: GoalStats
}

export default function ProgressBlock({ goal, stats }: Props) {
  const labels = LABELS.tools.savings.result
  const targetPct = goal.target_amount != null
    ? Math.min(100, Math.max(0, (stats.runningTotal / Number(goal.target_amount)) * 100))
    : null

  return (
    <section className="bg-surface border border-soft rounded-xl p-6 space-y-5">

      {/* Top — saved + target */}
      <div>
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">
          {labels.savedLabel}
        </p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-5xl font-black text-prose">{fmtUsdWhole(stats.runningTotal)}</p>
          {goal.target_amount != null && (
            <p className="text-sm text-prose-faint">
              of {fmtUsdWhole(goal.target_amount)} {labels.targetLabel.toLowerCase()}
            </p>
          )}
        </div>

        {targetPct != null && (
          <div className="mt-4 h-2 bg-surface-sunken rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${targetPct}%` }}
            />
          </div>
        )}

        {stats.totalWithdrawn > 0 && (
          <p className="text-xs text-prose-faint mt-3">
            {fmtUsdWhole(stats.totalContributed)} contributed · {fmtUsdWhole(stats.totalWithdrawn)} withdrawn
          </p>
        )}
      </div>

      {/* Stat grid — 3 across on mobile so Streak/Banked/Ahead-by fit on one
          row. Falls to 4 across on sm+ when the projected-at-target stat is
          present. Compact gap on mobile so the values stay tight. */}
      {goal.cadence && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-4 pt-2 border-t border-soft">
          {stats.streak != null && (
            <Stat
              label={labels.streakLabel}
              value={cadenceUnitLabel(goal.cadence, stats.streak)}
              tone="default"
            />
          )}
          {stats.bankedUnits != null && stats.bankedUnits > 0 && (
            <Stat
              label={labels.bankedLabel}
              value={cadenceUnitLabel(goal.cadence, stats.bankedUnits)}
              tone="success"
            />
          )}
          {stats.aheadByUnits != null && stats.aheadByUnits !== 0 && (
            <Stat
              label={stats.aheadByUnits > 0 ? labels.aheadByLabel : labels.behindByLabel}
              value={cadenceUnitLabel(goal.cadence, Math.abs(stats.aheadByUnits))}
              tone={stats.aheadByUnits > 0 ? 'success' : 'warn'}
            />
          )}
          {stats.projectedAtTarget != null && goal.target_date && (
            <Stat
              label={labels.projectedLabel}
              value={fmtUsd(stats.projectedAtTarget)}
              tone="default"
            />
          )}
        </div>
      )}

      {/* Last-activity line */}
      {stats.lastEntryAt && (
        <p className="text-xs text-prose-faint pt-2 border-t border-soft">
          {labels.lastContribLabel}: {new Date(stats.lastEntryAt).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
          })}
        </p>
      )}
    </section>
  )
}

function Stat({ label, value, tone }: {
  label: string
  value: string
  tone: 'default' | 'success' | 'warn'
}) {
  const valueClass =
    tone === 'success' ? 'text-success-ink'
    : tone === 'warn' ? 'text-warn-ink'
    : 'text-prose'
  return (
    <div className="min-w-0">
      <p className="text-xs text-prose-faint uppercase tracking-widest mb-1 truncate">{label}</p>
      <p className={`text-lg sm:text-xl font-black truncate ${valueClass}`}>{value}</p>
    </div>
  )
}

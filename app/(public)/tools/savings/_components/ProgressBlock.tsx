// The big stats panel on a goal's detail page. Total saved, streak,
// banked days, ahead/behind, last activity. Server Component.

import { LABELS } from '@/lib/labels'
import type { SavingsGoal, GoalStats } from '@/lib/dad-tools/savings'
import { fmtUsdWhole, fmtUsd, cadenceUnitLabel } from '@/lib/dad-tools/savings'
import { ProgressBar } from '@/components/ui/ProgressBar'

interface Props {
  goal:  SavingsGoal
  stats: GoalStats
}

export default function ProgressBlock({ goal, stats }: Props) {
  const labels = LABELS.tools.savings.result

  return (
    // The ONE black panel on the detail screen (Hard Goods) — tokens invert inside the zone.
    <section aria-label="Progress" data-theme="dark" className="bg-chrome text-prose border-t-4 border-accent rounded-xl p-6 sm:p-8 space-y-5">

      {/* Top — saved + target */}
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-widest font-semibold text-accent-text">{labels.savedLabel}</p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <p className="text-5xl font-black text-accent tabular-nums leading-none">{fmtUsdWhole(stats.runningTotal)}</p>
          {goal.target_amount != null && (
            <p className="text-sm text-prose-faint">
              of {fmtUsdWhole(goal.target_amount)} {labels.targetLabel.toLowerCase()}
            </p>
          )}
        </div>

        {goal.target_amount != null && (
          <ProgressBar
            className="mt-4"
            label="Savings progress"
            value={stats.runningTotal}
            max={Number(goal.target_amount)}
            valueText={`${fmtUsdWhole(stats.runningTotal)} of ${fmtUsdWhole(goal.target_amount)}`}
          />
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
      <p className={`text-lg sm:text-xl font-black tabular-nums truncate ${valueClass}`}>{value}</p>
    </div>
  )
}

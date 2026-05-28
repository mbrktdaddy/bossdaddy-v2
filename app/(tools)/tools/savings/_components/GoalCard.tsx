// Index-page row for a savings goal. Shows the most-important number (total)
// + streak chip + kid tag + status badge. Server Component — no interactivity
// needed since the whole card is a link.

import Link from 'next/link'
import { LABELS } from '@/lib/labels'
import type { GoalWithStats } from '@/lib/dad-tools/savings-actions'
import { fmtUsdWhole, cadenceUnitLabel } from '@/lib/dad-tools/savings'

const STATUS_PILL: Record<string, string> = {
  active:    'bg-accent-tint text-accent-text-soft border-accent-border/60',
  paused:    'bg-warn-bg text-warn-ink border-warn-line',
  completed: 'bg-info-bg text-info-ink border-info-line',
  archived:  'bg-surface-raised text-prose-muted border-strong',
}

interface Props {
  data: GoalWithStats
  kidName?: string | null
}

export default function GoalCard({ data, kidName }: Props) {
  const { goal, stats } = data
  const statusClass = STATUS_PILL[goal.status] ?? STATUS_PILL.active

  return (
    <Link
      href={`/tools/savings/${goal.id}`}
      className="block bg-surface border border-soft hover:border-accent-border/60 rounded-xl p-5 transition-colors group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">
            {kidName ? `For ${kidName}` : (goal.cadence ?? 'Free-form')}
          </p>
          <p className="text-base font-black text-prose group-hover:text-accent-text-soft transition-colors truncate">
            {goal.name}
          </p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border shrink-0 capitalize ${statusClass}`}>
          {goal.status}
        </span>
      </div>

      <div className="flex items-baseline gap-3 mb-3">
        <p className="text-3xl font-black text-prose">
          {fmtUsdWhole(stats.runningTotal)}
        </p>
        {goal.target_amount != null && (
          <p className="text-xs text-prose-faint">
            of {fmtUsdWhole(goal.target_amount)}
          </p>
        )}
      </div>

      {goal.target_amount != null && (
        <div className="h-1.5 bg-surface-sunken rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-accent transition-all"
            style={{
              width: `${Math.min(100, Math.max(0, (stats.runningTotal / Number(goal.target_amount)) * 100))}%`,
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs text-prose-faint">
        {goal.cadence && stats.streak != null ? (
          <span>
            {LABELS.tools.savings.result.streakLabel}:{' '}
            <span className="text-prose-muted font-semibold">
              {cadenceUnitLabel(goal.cadence, stats.streak)}
            </span>
          </span>
        ) : (
          <span>
            {stats.daysContributed} contributions
          </span>
        )}
        {goal.cadence && stats.aheadByUnits != null && stats.aheadByUnits !== 0 && (
          <span className={stats.aheadByUnits > 0 ? 'text-success-ink' : 'text-warn-ink'}>
            {stats.aheadByUnits > 0
              ? `${LABELS.tools.savings.result.aheadByLabel} ${cadenceUnitLabel(goal.cadence, stats.aheadByUnits)}`
              : `${LABELS.tools.savings.result.behindByLabel} ${cadenceUnitLabel(goal.cadence, -stats.aheadByUnits)}`}
          </span>
        )}
      </div>
    </Link>
  )
}

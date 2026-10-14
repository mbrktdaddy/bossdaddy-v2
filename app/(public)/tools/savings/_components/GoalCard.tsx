// Index-page row for a savings goal. Shows the most-important number (total)
// + streak + kid tag; a status chip only when the goal is NOT in its default
// (active) state. Server Component — the whole card is a link, the owner menu
// floats beside it.

import Link from 'next/link'
import { LABELS } from '@/lib/labels'
import type { GoalWithStats } from '@/lib/dad-tools/savings-actions'
import { fmtUsdWhole, cadenceUnitLabel } from '@/lib/dad-tools/savings'
import GoalCardMenu from './GoalCardMenu'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { ProgressBar } from '@/components/ui/ProgressBar'

// Active is the default and gets no chip (continuity plan Phase 7).
const STATUS_TONE: Record<string, BadgeTone> = {
  paused:    'warn',
  completed: 'info',
  archived:  'neutral',
}

interface Props {
  data: GoalWithStats
  kidName?: string | null
  isOwner?: boolean
  /** Unread notes in this goal's feed. 0 renders nothing. */
  unreadNotes?: number
}

export default function GoalCard({ data, kidName, isOwner = false, unreadNotes = 0 }: Props) {
  const { goal, stats } = data
  const statusTone = STATUS_TONE[goal.status]

  return (
    // focus-within:z-20 — the open options menu must paint over the next card.
    <Card tone="chrome" className="relative focus-within:z-20 hover:border-accent transition-colors">
      {isOwner && (
        <div className="absolute top-2 right-2 z-10">
          <GoalCardMenu goalId={goal.id} goalName={goal.name} status={goal.status} />
        </div>
      )}
      <Link href={`/tools/savings/${goal.id}`} className="block rounded-xl p-5 group">
        <div className={`mb-3 ${isOwner ? 'pr-10' : ''}`}>
          <Eyebrow className="mb-1">
            {kidName ? `For ${kidName}` : (goal.cadence ?? 'Free-form')}
          </Eyebrow>
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-base font-black text-prose group-hover:text-accent-text transition-colors truncate min-w-0">
              {goal.name}
            </p>
            {statusTone && (
              <Badge tone={statusTone} size="sm" className="capitalize">
                {goal.status}
              </Badge>
            )}
            {/* Someone said something here — about a person, not a number. */}
            {unreadNotes > 0 && (
              <Badge tone="accent" size="sm">{unreadNotes} new</Badge>
            )}
          </div>
        </div>

        <div className="flex items-baseline gap-3 mb-3">
          <p className="text-3xl font-black text-prose tabular-nums">
            {fmtUsdWhole(stats.runningTotal)}
          </p>
          {goal.target_amount != null && (
            <p className="text-xs text-prose-faint">
              of {fmtUsdWhole(goal.target_amount)}
            </p>
          )}
        </div>

        {goal.target_amount != null && (
          <ProgressBar
            size="sm"
            className="mb-3"
            label={`${goal.name} progress`}
            value={stats.runningTotal}
            max={Number(goal.target_amount)}
            valueText={`${fmtUsdWhole(stats.runningTotal)} of ${fmtUsdWhole(goal.target_amount)}`}
          />
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
    </Card>
  )
}

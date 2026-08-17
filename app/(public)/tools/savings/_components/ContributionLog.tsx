// History list. Newest-first (entries already ordered server-side in getGoal).
// Shows date, amount, kind, optional note. Phase 2 single-user: no attribution
// chips yet — the only contributor is the owner. Multi-participant attribution
// arrives in Phase 3.

import type { SavingsEntry } from '@/lib/dad-tools/savings'
import { fmtUsd, fmtYMDForDisplay } from '@/lib/dad-tools/savings'

const KIND_BADGE: Record<SavingsEntry['kind'], { label: string; className: string; sign: '+' | '-' | '' }> = {
  contribution:      { label: 'Contribution', className: 'bg-accent-tint text-accent-text-soft border-accent-border/60', sign: '+' },
  catchup:           { label: 'Catch-up',     className: 'bg-info-bg text-info-ink border-info-line',                    sign: '+' },
  withdrawal:        { label: 'Withdrawal',   className: 'bg-danger-bg text-danger-ink border-danger-line',              sign: '-' },
  adjustment_credit: { label: 'Adjustment',   className: 'bg-success-bg text-success-ink border-success-line',           sign: '+' },
  adjustment_debit:  { label: 'Adjustment',   className: 'bg-danger-bg text-danger-ink border-danger-line',              sign: '-' },
  skip:              { label: 'Skip',         className: 'bg-surface-raised text-prose-muted border-strong',             sign: '' },
}

export interface ContributorProfile {
  id:            string
  display_name:  string | null
  username:      string | null
}

interface Props {
  entries:        SavingsEntry[]
  emptyMessage?:  string
  // Map from contributor user_id → profile. Used to surface "who did this?"
  // attribution on multi-participant goals. Solo goals get no attribution
  // chip (would just clutter the entries with redundant "you" labels).
  profileById?:   Map<string, ContributorProfile>
  showAttribution?: boolean
}

function attributionFor(
  profileById: Map<string, ContributorProfile> | undefined,
  contributorId: string,
): string {
  const p = profileById?.get(contributorId)
  if (!p) return 'Unknown'
  return p.display_name?.trim() || (p.username ? `@${p.username}` : 'Unknown')
}

export default function ContributionLog({ entries, emptyMessage, profileById, showAttribution }: Props) {
  if (entries.length === 0) {
    return (
      <section className="bg-surface border border-soft rounded-xl p-6 text-center">
        <p className="text-sm text-prose-faint">
          {emptyMessage ?? 'No activity yet. Tap "Yes" above when you make your first contribution.'}
        </p>
      </section>
    )
  }

  return (
    <section className="bg-surface border border-soft rounded-xl p-6">
      <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">
        History
      </p>
      <div className="space-y-2">
        {entries.map((e) => {
          const meta = KIND_BADGE[e.kind] ?? KIND_BADGE.contribution
          const dateLabel = fmtYMDForDisplay(e.contributed_on)
          return (
            <div
              key={e.id}
              className="flex items-center gap-3 p-3 bg-surface-sunken border border-soft rounded-xl"
            >
              <span className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border font-medium shrink-0 ${meta.className}`}>
                {meta.label}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-prose">
                  {meta.sign && (
                    <span className={meta.sign === '+' ? 'text-success-ink font-semibold' : 'text-danger-ink font-semibold'}>
                      {meta.sign}{fmtUsd(Number(e.amount) || 0)}
                    </span>
                  )}
                  {e.kind === 'skip' && (
                    <span className="text-prose-muted">Skipped</span>
                  )}
                  {e.note && (
                    <span className="text-prose-faint"> — {e.note}</span>
                  )}
                </p>
                <p className="text-xs text-prose-faint">
                  {dateLabel}
                  {showAttribution && (
                    <>
                      <span className="mx-1.5">·</span>
                      <span>by {attributionFor(profileById, e.contributor_id)}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

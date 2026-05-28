// Catch-up suggestion. Shows ONLY when the goal is behind plan (catchUp-
// Suggestion is non-null). Symmetric mode: repay the deficit over the same
// number of cadence-units that the deficit represents, by doubling the
// per-unit contribution during that window. Informational — no auto-apply
// in Phase 2; user manually contributes more via the Custom-amount button.

import { LABELS } from '@/lib/labels'
import type { CatchUpSuggestion, SavingsCadence } from '@/lib/dad-tools/savings'
import { fmtUsd, cadenceUnitLabel, fmtYMDForDisplay } from '@/lib/dad-tools/savings'

interface Props {
  cadence:    SavingsCadence
  suggestion: CatchUpSuggestion
}

export default function CatchUpPanel({ cadence, suggestion }: Props) {
  const copy = LABELS.tools.savings.catchUp
  const cadenceWordSingular = cadence === 'daily' ? 'day' : cadence === 'weekly' ? 'week' : 'month'
  const dateLabel = fmtYMDForDisplay(suggestion.catchUpUntilDate)

  return (
    <section className="bg-warn-bg border border-warn-line rounded-xl p-5">
      <p className="text-xs text-warn-ink uppercase tracking-widest font-semibold mb-2">
        {copy.eyebrow}
      </p>
      <p className="text-base font-black text-prose mb-2">{copy.title}</p>
      <p className="text-sm text-prose-muted leading-snug">
        Add an extra <span className="font-semibold text-prose">{fmtUsd(suggestion.extraPerUnit)}</span>
        {' '}per {cadenceWordSingular} for{' '}
        <span className="font-semibold text-prose">{cadenceUnitLabel(cadence, suggestion.unitsToCatchUp)}</span>
        {' '}to catch up by <span className="font-semibold text-prose">{dateLabel}</span>.
      </p>
      <p className="text-xs text-prose-faint mt-3">
        Total during catch-up: {fmtUsd(suggestion.totalPerUnit)}/{cadenceWordSingular}.
        Hit &quot;Custom amount&quot; below to log it.
      </p>
    </section>
  )
}

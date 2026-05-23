import type { VerdictChange } from '@/lib/reviews'

interface Props {
  verdictChange: VerdictChange
  previousRating: number | null
  currentRating: number | null
  milestoneLabel: string
}

function styleFor(v: VerdictChange): { bg: string; text: string; border: string; icon: string; label: string } {
  switch (v) {
    case 'improved':
      return { bg: 'bg-green-50', text: 'text-forest', border: 'border-green-200', icon: '↑', label: 'Improved' }
    case 'unchanged':
      return { bg: 'bg-surface-raised/60', text: 'text-prose-muted', border: 'border-strong/60', icon: '→', label: 'Unchanged' }
    case 'declined':
      return { bg: 'bg-amber-950/40', text: 'text-amber-200', border: 'border-amber-900/60', icon: '↓', label: 'Declined' }
    case 'complete_reversal':
      return { bg: 'bg-red-50', text: 'text-red-200', border: 'border-red-200', icon: '↓↓', label: 'Complete reversal' }
  }
}

// Prominent header signal on follow-up review pages — "this article updates an
// earlier verdict, here's the delta at a glance." Format:
//   Initial 9.0/10 → 6-Month Update 7.5/10 ↓ Declined
export function VerdictChangeBadge({
  verdictChange,
  previousRating,
  currentRating,
  milestoneLabel,
}: Props) {
  const s = styleFor(verdictChange)
  const prev = previousRating != null ? Number(previousRating).toFixed(1) : '—'
  const curr = currentRating != null ? Number(currentRating).toFixed(1) : '—'

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 rounded-xl border ${s.bg} ${s.border} ${s.text}`}
      role="status"
      aria-label={`Verdict ${s.label.toLowerCase()} from ${prev} out of 10 to ${curr} out of 10`}
    >
      <span className="text-xs font-medium text-prose-muted uppercase tracking-widest">Initial</span>
      <span className="text-sm font-black tabular-nums text-prose">{prev}<span className="text-xs text-prose-faint">/10</span></span>
      <span aria-hidden className="text-prose-faint">→</span>
      <span className="text-xs font-medium uppercase tracking-widest">{milestoneLabel}</span>
      <span className="text-sm font-black tabular-nums">{curr}<span className="text-xs opacity-60">/10</span></span>
      <span className={`text-sm font-bold ml-1`} aria-hidden>{s.icon}</span>
      <span className="text-xs font-bold uppercase tracking-wider">{s.label}</span>
    </div>
  )
}

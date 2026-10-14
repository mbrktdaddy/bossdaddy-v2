import type { VerdictChange } from '@/lib/reviews'
import { Badge } from '@/components/ui/Badge'

interface Props {
  verdictChange: VerdictChange
  previousRating: number | null
  currentRating: number | null
  milestoneLabel: string
}

function labelFor(v: VerdictChange): { icon: string; label: string } {
  switch (v) {
    case 'improved':          return { icon: '↑', label: 'Improved' }
    case 'unchanged':         return { icon: '→', label: 'Unchanged' }
    case 'declined':          return { icon: '↓', label: 'Declined' }
    case 'complete_reversal': return { icon: '↓↓', label: 'Complete reversal' }
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
  const s = labelFor(verdictChange)
  const prev = previousRating != null ? Number(previousRating).toFixed(1) : '—'
  const curr = currentRating != null ? Number(currentRating).toFixed(1) : '—'

  return (
    <div
      className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2 rounded-xl border-2 border-chrome bg-surface text-prose"
      role="status"
      aria-label={`Verdict ${s.label.toLowerCase()} from ${prev} out of 10 to ${curr} out of 10`}
    >
      <span className="text-xs font-medium text-prose-muted uppercase tracking-widest">Initial</span>
      <span className="text-sm font-black tabular-nums text-prose">{prev}<span className="text-xs text-prose-faint">/10</span></span>
      <span aria-hidden className="text-prose-faint">→</span>
      <span className="text-xs font-medium uppercase tracking-widest">{milestoneLabel}</span>
      <span className="text-sm font-black tabular-nums">{curr}<span className="text-xs opacity-60">/10</span></span>
      <Badge tone={verdictChange === 'unchanged' ? 'neutral' : 'accent'} className="ml-1">
        <span aria-hidden>{s.icon}</span> {s.label}
      </Badge>
    </div>
  )
}

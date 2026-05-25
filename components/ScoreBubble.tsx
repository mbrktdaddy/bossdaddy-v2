interface Props {
  rating: number | null
  /** Position the bubble inside a parent with `position: relative`. */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

function fmt(r: number | null): string {
  if (r == null) return '—'
  return r % 1 === 0 ? `${r}.0` : String(r)
}

const POSITIONS: Record<NonNullable<Props['position']>, string> = {
  'top-left':     'top-2.5 left-2.5',
  'top-right':    'top-2.5 right-2.5',
  'bottom-left':  'bottom-2.5 left-2.5',
  'bottom-right': 'bottom-2.5 right-2.5',
}

/**
 * Score badge overlaid on card images. Orange container with white number —
 * guarantees legibility regardless of underlying image content.
 *
 * Pair with [ScoreBlock] for hero treatments where the score sits on a
 * controlled background.
 */
export default function ScoreBubble({ rating, position = 'bottom-left' }: Props) {
  return (
    <div className={`absolute ${POSITIONS[position]} bg-accent rounded-lg px-2.5 py-1.5 flex items-baseline gap-0.5 shadow-md shadow-black/20`}>
      <span className="text-2xl font-black leading-none text-white tabular-nums" style={{ letterSpacing: '-1px' }}>
        {fmt(rating)}
      </span>
      <span className="text-[10px] font-bold text-white/60 tabular-nums">
        /10
      </span>
    </div>
  )
}

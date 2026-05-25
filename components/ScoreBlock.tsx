interface Props {
  rating: number | null
  /** Heading element variant — h1 by default. */
  size?: 'lg' | 'md'
}

function fmt(r: number | null): string {
  if (r == null) return '—'
  return r % 1 === 0 ? `${r}.0` : String(r)
}

/**
 * Free-floating hero score — no container. Brand orange number sits on the
 * controlled page background. Used in featured-review hero treatments
 * where the surrounding zinc-100 surface guarantees legibility.
 *
 * Pair with [ScoreBubble] when the score must overlay an image — the
 * orange container variant guarantees contrast against unpredictable
 * image content.
 */
export default function ScoreBlock({ rating, size = 'lg' }: Props) {
  const sizeClass = size === 'lg' ? 'text-7xl md:text-8xl' : 'text-6xl'
  const tracking  = size === 'lg' ? '-3px' : '-2px'

  return (
    <div className="text-center shrink-0" style={{ minWidth: size === 'lg' ? 96 : 80 }}>
      <div
        className={`${sizeClass} font-black text-accent leading-none tabular-nums`}
        style={{ letterSpacing: tracking }}
      >
        {fmt(rating)}
      </div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-prose-muted">
        / 10
      </div>
    </div>
  )
}

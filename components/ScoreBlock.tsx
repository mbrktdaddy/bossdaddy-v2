interface Props {
  rating: number | null
  /** Number scale. */
  size?: 'lg' | 'md' | 'sm'
  /**
   * 'plain'  — free-floating orange number (default). Sits on a controlled bg.
   * 'ring'   — Manifesto "hero moment" score dial: accent arc fills to the
   *            rating, number centered. Use on Cover Story / Featured review /
   *            review-detail headers ONLY. Grids/leaderboards keep plain/numeric.
   */
  variant?: 'plain' | 'ring'
  /** Ring only — bg utility for the inner disc; match the surface behind it. */
  innerClassName?: string
}

function fmt(r: number | null): string {
  if (r == null) return '—'
  return r % 1 === 0 ? `${r}.0` : String(r)
}

/**
 * Score display. `plain` is the free-floating orange number used since the
 * dark-first makeover. `ring` is the Manifesto v2 dial (docs/home-manifesto-
 * spec.md) — one component, tiered by surface: ring on the big moments, plain
 * or a raw numeric chip in dense grids. Pair with [ScoreBubble] when a score
 * must overlay an unpredictable image.
 */
export default function ScoreBlock({
  rating,
  size = 'lg',
  variant = 'plain',
  innerClassName = 'bg-surface',
}: Props) {
  if (variant === 'ring') {
    const pct = rating != null ? Math.max(0, Math.min(100, rating * 10)) : 0
    const dim = size === 'lg' ? 92 : size === 'md' ? 72 : 56
    const numClass = size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-lg'
    return (
      <div
        className="shrink-0 rounded-full grid place-items-center relative"
        style={{
          width: dim,
          height: dim,
          background: `conic-gradient(var(--bd-orange) ${pct}%, var(--bd-surface-hover) 0)`,
        }}
        role="img"
        aria-label={`Score ${fmt(rating)} out of 10`}
      >
        <div className={`absolute inset-[5px] rounded-full grid place-items-center ${innerClassName}`}>
          <span className={`${numClass} font-black text-prose leading-none tabular-nums`}>
            {fmt(rating)}
          </span>
        </div>
      </div>
    )
  }

  const sizeClass = size === 'lg' ? 'text-7xl md:text-8xl' : size === 'md' ? 'text-6xl' : 'text-5xl'
  const tracking = size === 'lg' ? '-3px' : '-2px'

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

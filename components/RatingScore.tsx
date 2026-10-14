interface Props {
  rating: number
  size?: 'sm' | 'lg'
  /**
   * 'text' — the colour-coded number + "/10" (default; rows, lists, dense grids).
   * 'chip' — the square solid orange score chip (Hard Goods, 2026-10-14): white
   *          Montserrat black on `bg-accent`, one size. Product tiles and boards.
   */
  variant?: 'text' | 'chip'
}

function scoreColor(r: number) {
  if (r >= 8) return 'text-forest'
  if (r >= 7) return 'text-accent-text-soft'
  if (r >= 5) return 'text-amber-700'
  return 'text-red-700'
}

function fmt(r: number) {
  return r % 1 === 0 ? `${r}.0` : String(r)
}

export default function RatingScore({ rating, size = 'sm', variant = 'text' }: Props) {
  if (variant === 'chip') {
    return (
      <span className="inline-grid place-items-center min-w-[40px] h-[30px] px-1.5 bg-accent text-white font-display font-black text-[13px] rounded-sm tabular-nums">
        {fmt(rating)}
        <span className="sr-only"> out of 10</span>
      </span>
    )
  }

  const color = scoreColor(rating)

  if (size === 'lg') {
    return (
      <div className="flex items-baseline gap-1 tabular-nums">
        <span className={`text-3xl font-black tracking-tight ${color}`}>{fmt(rating)}</span>
        <span className="text-sm text-prose-faint font-bold uppercase tracking-widest">/10</span>
      </div>
    )
  }

  return (
    <div className="flex items-baseline gap-0.5 tabular-nums">
      <span className={`text-sm font-black tracking-tight ${color}`}>{fmt(rating)}</span>
      <span className="text-[10px] text-prose-faint font-bold uppercase tracking-widest">/10</span>
    </div>
  )
}

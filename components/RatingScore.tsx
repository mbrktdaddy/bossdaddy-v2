interface Props {
  rating: number
  size?: 'sm' | 'lg'
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

export default function RatingScore({ rating, size = 'sm' }: Props) {
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

interface Props {
  rating: number
  size?: 'sm' | 'lg'
}

function scoreColor(r: number) {
  if (r >= 8) return 'text-green-400'
  if (r >= 7) return 'text-orange-400'
  if (r >= 5) return 'text-yellow-500'
  return 'text-red-400'
}

function fmt(r: number) {
  return r % 1 === 0 ? `${r}.0` : String(r)
}

export default function RatingScore({ rating, size = 'sm' }: Props) {
  const color = scoreColor(rating)

  if (size === 'lg') {
    return (
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-black ${color}`}>{fmt(rating)}</span>
        <span className="text-base text-gray-600 font-semibold">/10</span>
      </div>
    )
  }

  return (
    <div className="flex items-baseline gap-0.5">
      <span className={`text-sm font-bold ${color}`}>{fmt(rating)}</span>
      <span className="text-xs text-gray-600">/10</span>
    </div>
  )
}

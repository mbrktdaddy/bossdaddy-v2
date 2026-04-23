export function ScoreRing({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex flex-col items-center">
        <div className="w-16 h-16 rounded-full border-4 border-gray-800 flex items-center justify-center">
          <span className="text-xs text-gray-600 font-mono">—</span>
        </div>
        <p className="text-xs text-gray-600 mt-1">Pending</p>
      </div>
    )
  }

  const level = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  const config = {
    high:   { color: 'text-red-400',    ring: '#ef4444', label: 'High Risk' },
    medium: { color: 'text-yellow-400', ring: '#eab308', label: 'Needs Review' },
    low:    { color: 'text-green-400',  ring: '#22c55e', label: 'Low Risk' },
  }[level]

  const pct = score * 100
  const circumference = 2 * Math.PI * 20
  const dash = (pct / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-16 h-16">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 48 48">
          <circle cx="24" cy="24" r="20" fill="none" stroke="#1f2937" strokeWidth="4" />
          <circle
            cx="24" cy="24" r="20" fill="none"
            stroke={config.ring} strokeWidth="4"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-black font-mono ${config.color}`}>{score.toFixed(2)}</span>
        </div>
      </div>
      <p className={`text-xs font-medium mt-1 ${config.color}`}>{config.label}</p>
    </div>
  )
}

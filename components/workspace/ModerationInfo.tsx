interface Props {
  score: number | null
  flags: string[]
  onAddressFlag?: (flag: string) => void
}

export function ModerationInfo({ score, flags, onAddressFlag }: Props) {
  if (score === null && (!flags || flags.length === 0)) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold mb-1">Moderation</p>
        <p className="text-sm text-gray-500">No moderation data yet. It will populate after Claude scans submitted content.</p>
      </div>
    )
  }

  const level = score === null ? null
    : score >= 0.7 ? 'high'
    : score >= 0.4 ? 'medium'
    : 'low'

  const levelConfig = {
    high:   { label: 'High Risk',      bg: 'bg-red-950/40',    border: 'border-red-900/60',    text: 'text-red-400'    },
    medium: { label: 'Needs Review',   bg: 'bg-yellow-950/40', border: 'border-yellow-900/60', text: 'text-yellow-400' },
    low:    { label: 'Low Risk',       bg: 'bg-green-950/40',  border: 'border-green-900/60',  text: 'text-green-400'  },
    null:   { label: 'Unscored',       bg: 'bg-gray-900',      border: 'border-gray-800',      text: 'text-gray-500'   },
  }[level ?? 'null']

  return (
    <div className={`border rounded-xl p-4 ${levelConfig.bg} ${levelConfig.border}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs uppercase tracking-wider font-semibold text-gray-400">Moderation</p>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${levelConfig.text}`}>{levelConfig.label}</span>
          {score !== null && (
            <span className={`text-xs font-mono ${levelConfig.text} opacity-70`}>{score.toFixed(2)}</span>
          )}
        </div>
      </div>
      {flags && flags.length > 0 && (
        <div className="space-y-2 mt-2">
          {flags.map((f, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 text-sm text-gray-300 flex-1">
                <span className={`${levelConfig.text} mt-0.5 shrink-0`}>⚑</span>
                {f}
              </div>
              {onAddressFlag && (
                <button
                  type="button"
                  onClick={() => onAddressFlag(f)}
                  className="shrink-0 text-xs px-2 py-1 bg-gray-800 hover:bg-orange-950/50 text-gray-400 hover:text-orange-400 border border-gray-700 hover:border-orange-800/50 rounded-lg transition-colors"
                >
                  ✨ Fix with AI
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-gray-600 mt-2">
        Advisory only — you can still publish regardless of flags.
      </p>
    </div>
  )
}

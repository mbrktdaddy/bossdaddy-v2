'use client'

interface Props {
  scheduledAt: string | null
  onChange: (iso: string | null) => void
  disabled?: boolean
}

function toDateTimeLocal(iso: string): string {
  // HTML datetime-local expects "YYYY-MM-DDTHH:mm" in local time
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDateTimeLocal(local: string): string {
  // Treat value as local time, convert to ISO (UTC)
  return new Date(local).toISOString()
}

export function SchedulePanel({ scheduledAt, onChange, disabled }: Props) {
  const localValue = scheduledAt ? toDateTimeLocal(scheduledAt) : ''
  const isScheduled = !!scheduledAt
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null
  // eslint-disable-next-line react-hooks/purity
  const isPast = scheduledDate ? scheduledDate.getTime() < Date.now() : false

  return (
    <details className="bg-gray-900 border border-gray-800 rounded-xl" open={isScheduled}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold flex items-center justify-between">
        <span className="flex items-center gap-2">
          <span className="text-purple-400">📅</span> Schedule
        </span>
        {isScheduled ? (
          <span className={`text-xs font-mono ${isPast ? 'text-yellow-500' : 'text-purple-400'}`}>
            {isPast ? 'overdue' : scheduledDate!.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        ) : (
          <span className="text-xs text-gray-600">Publish at a specific time</span>
        )}
      </summary>

      <div className="px-4 pb-4 space-y-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Publish date & time (local)</label>
          <input
            type="datetime-local"
            value={localValue}
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value
              onChange(v ? fromDateTimeLocal(v) : null)
            }}
            className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>
        {isScheduled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            Clear schedule
          </button>
        )}
        <p className="text-xs text-gray-600">
          Content will publish automatically at the scheduled time. The cron runs once daily at
          noon UTC — your scheduled item will go live on the next daily run after the scheduled
          time passes. (Vercel Hobby plan limitation; upgrade to Pro for more frequent checks.)
        </p>
      </div>
    </details>
  )
}

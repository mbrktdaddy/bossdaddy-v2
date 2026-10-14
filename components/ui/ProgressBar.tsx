// The one progress bar (continuity plan P18) — goal cards, savings, the
// progress block. Three were hand-rolled: two rounded-full pills (Hard Goods
// is square — `rounded-sm`, the 4px scale's small step) and one with no
// role, so a screen reader got nothing. Track = the sunken surface (visible on
// white AND inside a dark zone), fill = the accent.

interface ProgressBarProps {
  value: number
  max?: number
  /** Accessible name ("Savings progress"). */
  label: string
  /** Spoken value when a percentage isn't the point ("$420 of $1,000"). */
  valueText?: string
  size?: 'sm' | 'md'
  className?: string
}

export function ProgressBar({ value, max = 100, label, valueText, size = 'md', className = '' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(max, Math.max(0, value))}
      aria-valuetext={valueText}
      className={`w-full overflow-hidden rounded-sm bg-surface-sunken ${size === 'sm' ? 'h-1.5' : 'h-2.5'} ${className}`}
    >
      <div className="h-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

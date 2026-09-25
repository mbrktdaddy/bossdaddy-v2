// The one status/label pill. Tones map to the semantic role tokens so every
// status vocabulary (content, bench, orders, merch, outreach…) reads the same:
//   neutral — default / draft / not-yet     muted   — passed / inactive
//   info    — in flight (sent, processing)  success — live / done / shipped
//   warn    — needs attention (pending)     danger  — rejected / cancelled
//   accent  — brand-highlighted (reviewed, follow-up)
// Domain files own a status → { label, tone } map; this file owns the look.
// Never pale `bg-{colour}-50` chips — they glow on the dark canvas.

export type BadgeTone = 'neutral' | 'muted' | 'info' | 'success' | 'warn' | 'danger' | 'accent'

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-surface-raised text-prose-muted border-strong',
  muted:   'bg-surface text-prose-faint border-soft',
  info:    'bg-info-bg text-info-ink border-info-line',
  success: 'bg-success-bg text-forest border-success-line',
  warn:    'bg-warn-bg text-warn-ink border-warn-line',
  danger:  'bg-danger-bg text-danger-ink border-danger-line',
  accent:  'bg-accent-tint text-accent-text-soft border-accent-border/50',
}

interface BadgeProps {
  tone?: BadgeTone
  size?: 'sm' | 'md'
  /** Live-activity dot (e.g. "Testing now"). */
  pulse?: boolean
  className?: string
  children: React.ReactNode
}

export function Badge({ tone = 'neutral', size = 'md', pulse = false, className = '', children }: BadgeProps) {
  const sizing = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
  return (
    <span className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border text-xs font-semibold ${sizing} ${TONE[tone]} ${className}`}>
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden />}
      {children}
    </span>
  )
}

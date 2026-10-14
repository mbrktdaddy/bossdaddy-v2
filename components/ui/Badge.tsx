// The one status/label chip. Tones map to the semantic role tokens so every
// status vocabulary (content, bench, orders, merch, outreach…) reads the same:
//   neutral — default / draft / not-yet     muted   — passed / inactive
//   info    — in flight (sent, processing)  success — live / done / shipped
//   warn    — needs attention (pending)     danger  — rejected / cancelled
//   accent  — brand-highlighted (testing now, reviewed, follow-up, top pick)
// Domain files own a status → { label, tone } map; this file owns the look.
//
// Hard Goods (2026-10-14, brand-guide §6): the chip is SQUARE and solid —
// uppercase Montserrat 10px, `rounded-sm`. `neutral` is the inverted stamp
// (black on the page, white inside dark zones via prose/background); `accent`
// is the orange block. The four state tones keep the bg/line/ink token recipe
// because it inverts correctly inside dark zones (admin, dashboard) — a solid
// "ink" fill would not. Never pale `bg-{colour}-50` chips.

export type BadgeTone = 'neutral' | 'muted' | 'info' | 'success' | 'warn' | 'danger' | 'accent'

const TONE: Record<BadgeTone, string> = {
  neutral: 'bg-prose text-background',
  accent:  'bg-accent text-white',
  muted:   'bg-surface-raised text-prose-muted',
  info:    'bg-info-bg text-info-ink border border-info-line',
  success: 'bg-success-bg text-success-ink border border-success-line',
  warn:    'bg-warn-bg text-warn-ink border border-warn-line',
  danger:  'bg-danger-bg text-danger-ink border border-danger-line',
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
  const sizing = size === 'sm' ? 'px-2 py-1' : 'px-2.5 py-1.5'
  return (
    <span className={`inline-flex items-center gap-1.5 shrink-0 rounded-sm font-display font-black text-[10px] uppercase tracking-[0.14em] leading-none ${sizing} ${TONE[tone]} ${className}`}>
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" aria-hidden />}
      {children}
    </span>
  )
}

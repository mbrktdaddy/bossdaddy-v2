// UtilityBox — the one utility module shell (the bench box generalised, 2026-11-13).
//
// A 2px chrome-black box. The black header strip names the module (and carries
// its one action), rows inside are hairline-divided, and state is a solid chip
// (`StatusChip`). Used by the signed-in /tools page.
//
// Conventions for what goes inside:
//   - rows:   <ul className="divide-y divide-soft">, each row
//             `px-4 py-3 min-h-[56px] hover:bg-surface-raised transition-colors`
//   - padded content (empty states, intro copy): `p-4`
//
// The header is a `data-theme="dark"` zone, so role tokens invert there. Never
// use `border-chrome` INSIDE it — chrome is always #09090b and vanishes on black.

import Link from 'next/link'

interface UtilityBoxProps {
  /** The module's name, uppercase in the black header strip. */
  label: string
  /** A count shown in orange after the label (omit or null to hide). */
  count?: number | string | null
  /** The one action in the header, right-aligned, orange tracked caps. */
  link?: { label: string; href: string }
  /** The live-testing dot before the label (the bench uses it). */
  live?: boolean
  className?: string
  /** Accessible name; defaults to `label`. */
  ariaLabel?: string
  children: React.ReactNode
}

export function UtilityBox({
  label,
  count,
  link,
  live,
  className = '',
  ariaLabel,
  children,
}: UtilityBoxProps) {
  return (
    <section
      aria-label={ariaLabel ?? label}
      className={`border-2 border-chrome app:border-strong rounded-xl overflow-hidden bg-surface ${className}`}
    >
      <div data-theme="dark" className="bg-chrome app:bg-surface-raised text-prose flex items-center gap-2.5 px-4 min-h-[44px]">
        {live && (
          <span aria-hidden className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shadow-[0_0_0_4px_rgba(229,90,26,0.25)]" />
        )}
        <span className="font-display font-black text-xs uppercase tracking-[0.16em]">{label}</span>
        {count !== null && count !== undefined && (
          <span className="font-display font-black text-xs tabular-nums text-accent-text">{count}</span>
        )}
        {link && (
          <Link
            href={link.href}
            className="ml-auto shrink-0 inline-flex items-center min-h-[44px] font-display font-extrabold text-[11px] uppercase tracking-[0.1em] text-accent-text hover:text-prose transition-colors whitespace-nowrap"
          >
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}

/** The solid chip: orange = active / due / testing, black = queued / paused. */
export function StatusChip({
  tone = 'chrome',
  className = '',
  children,
}: {
  tone?: 'chrome' | 'accent'
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={`shrink-0 font-display font-black text-[10px] uppercase tracking-[0.14em] px-2.5 py-1.5 rounded-sm text-white whitespace-nowrap ${tone === 'accent' ? 'bg-accent' : 'bg-chrome app:bg-prose app:text-background'} ${className}`}
    >
      {children}
    </span>
  )
}

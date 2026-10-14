// Shared chrome for the money calculators (docs/money-tools-plan.md). Same
// shell Dad Math uses — eyebrow · H1 · tagline, the tool, a disclosure
// footer — factored out so five calculators can't drift into five layouts.
//
// No 'use client': nothing here holds state, so these render on the server
// from a page and on the client from a tool alike.

import Link from 'next/link'
import PageHeader from '@/components/PageHeader'
import { LABELS } from '@/lib/labels'
import { buttonVariants } from '@/components/ui/Button'

export function CalculatorPage({
  role, short, h1, tagline, disclosure, children,
}: {
  role:       string
  short:      string
  h1:         string
  tagline:    string
  disclosure: string
  children:   React.ReactNode
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* The app-page lockup (continuity plan D3/P6) — the tool column governs its width. */}
      <PageHeader
        size="compact"
        back={{ href: '/tools', label: LABELS.tools.short }}
        eyebrow={`${role} · ${short}`}
        title={h1}
        deck={tagline}
      />

      {children}

      <footer className="pt-6 mt-2 border-t border-soft">
        <p className="text-xs text-prose-faint leading-relaxed">{disclosure}</p>
      </footer>
    </div>
  )
}

// ONE NUMBER PER PAGE: `headline` is the big number, `label` names it, and
// everything in `stats` is supporting.
//
// RENDER IT FROM FIRST PAINT (continuity plan P12). Before the first input,
// pass no headline (an em dash holds the slot) and no voice — the voice line
// is always mounted with two lines reserved, so the panel never jumps when
// the first number lands, and never jumps again when the verdict wraps.
// `subhead`: omit it entirely for a tool that never has one; pass '' to hold
// its line while empty. The headline + voice are a polite live region — a
// screen reader hears the new answer without the stats being re-read.
export function ResultCard({
  label, headline, subhead, voice, stats, children,
}: {
  label:     string
  headline?: string
  subhead?:  string
  voice?:    string
  stats?:    { label: string; value: string }[]
  /** Share / save / opt-in / ResultLinks — under the stats. */
  children?: React.ReactNode
}) {
  // The ONE black panel per screen (Hard Goods): tokens invert inside the zone.
  return (
    <section aria-label={label} data-theme="dark" className="bg-chrome text-prose border-t-4 border-accent rounded-xl p-6 sm:p-8 space-y-5">
      <div aria-live="polite" className="space-y-5">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-semibold text-accent-text">{label}</p>
          <p className="mt-1 text-4xl sm:text-5xl font-black text-accent tabular-nums leading-none">
            {headline || '—'}
          </p>
          {subhead !== undefined && <p className="mt-2 min-h-5 text-sm text-prose-muted">{subhead}</p>}
        </div>

        <p className="min-h-[2lh] text-lg sm:text-xl font-black text-prose leading-snug">{voice}</p>
      </div>

      {stats && stats.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-soft">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-[10px] uppercase tracking-widest font-semibold text-prose-faint">
                {s.label}
              </dt>
              <dd className="mt-1 text-lg font-black text-prose tabular-nums">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {children}
    </section>
  )
}

// Links at the foot of a result. `next` is the path-forward step; `handoffs`
// carry this tool's numbers into another one.
export function ResultLinks({
  links,
}: {
  links: { href: string; label: string; note?: string; eyebrow?: string }[]
}) {
  if (links.length === 0) return null
  return (
    <div className="border-t border-soft pt-4 space-y-4">
      {links.map((l) => (
        <div key={l.href}>
          {l.eyebrow && (
            <p className="text-[10px] uppercase tracking-widest font-semibold text-eyebrow mb-1">
              {l.eyebrow}
            </p>
          )}
          <Link
            href={l.href}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            {l.label}
            <span aria-hidden>→</span>
          </Link>
          {l.note && <p className="text-xs text-prose-faint mt-0.5 leading-snug">{l.note}</p>}
        </div>
      ))}
    </div>
  )
}

// Segmented moved to components/ui (continuity plan P10); re-exported so the
// calculators' imports didn't churn.
export { Segmented } from '@/components/ui/Segmented'

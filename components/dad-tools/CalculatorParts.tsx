// Shared chrome for the money calculators (docs/money-tools-plan.md). Same
// shell Dad Math uses — eyebrow · H1 · tagline, the tool, a disclosure
// footer — factored out so five calculators can't drift into five layouts.
//
// No 'use client': nothing here holds state, so these render on the server
// from a page and on the client from a tool alike.

import Link from 'next/link'

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
      <header className="space-y-3">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-medium">
          {role} · {short}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">{h1}</h1>
        <p className="text-prose-faint text-base sm:text-lg leading-snug">{tagline}</p>
      </header>

      {children}

      <footer className="pt-6 mt-2 border-t border-soft">
        <p className="text-xs text-prose-faint leading-relaxed">{disclosure}</p>
      </footer>
    </div>
  )
}

// ONE NUMBER PER PAGE: `headline` is the big number, `label` names it, and
// everything in `stats` is supporting.
export function ResultCard({
  label, headline, subhead, voice, stats, tone = 'neutral', children,
}: {
  label:     string
  headline:  string
  subhead?:  string
  voice?:    string
  stats?:    { label: string; value: string }[]
  tone?:     'good' | 'neutral' | 'warn'
  children?: React.ReactNode
}) {
  const border =
    tone === 'good' ? 'border-accent/40' :
    tone === 'warn' ? 'border-strong' :
                      'border-soft'
  return (
    <section className={`bg-surface rounded-2xl p-6 sm:p-8 space-y-5 border-2 ${border}`}>
      <div>
        <p className="text-[10px] uppercase tracking-widest font-semibold text-prose-faint">{label}</p>
        <p className="mt-1 text-4xl sm:text-5xl font-black text-accent tabular-nums leading-none">
          {headline}
        </p>
        {subhead && <p className="mt-2 text-sm text-prose-muted">{subhead}</p>}
      </div>

      {voice && (
        <p className="text-lg sm:text-xl font-black text-prose leading-snug">{voice}</p>
      )}

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
            className="inline-flex items-center gap-2 py-1 text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
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

// Two-or-three-way pill toggle (Car/Personal, Snowball/Avalanche…).
export function Segmented<T extends string>({
  value, options, onChange, label,
}: {
  value:    T
  options:  { value: T; label: string }[]
  onChange: (v: T) => void
  label:    string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 p-1 bg-surface border border-soft rounded-full">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
            value === o.value ? 'bg-accent text-white' : 'text-prose-faint hover:text-prose'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

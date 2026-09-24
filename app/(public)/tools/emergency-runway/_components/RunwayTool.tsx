'use client'

// Emergency Runway interactive surface. Headline: months of runway. The
// 3–6 month target band is drawn under it so the number has something to be
// measured against.
//
// Essentials come in two modes: one number (most dads know it roughly) or a
// line-item split (for the ones who don't). The split is a convenience for
// arriving at the total; only the total travels in the URL/handoff.

import { useState } from 'react'
import NumberField from '@/components/dad-tools/NumberField'
import { ResultCard, ResultLinks, Segmented } from '@/components/dad-tools/CalculatorParts'
import { LABELS } from '@/lib/labels'
import { fmtUsd } from '@/lib/dad-tools/dad-math'
import { runRunway, RUNWAY_TARGET_MIN, RUNWAY_TARGET_MAX, type RunwayResult } from '@/lib/dad-tools/finance'
import { toQuery } from '@/lib/dad-tools/url-params'

const SPLIT_FIELDS = [
  { key: 'housing',   label: 'Rent / mortgage' },
  { key: 'food',      label: 'Groceries' },
  { key: 'utilities', label: 'Utilities & phone' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'transport', label: 'Car & gas' },
  { key: 'debt',      label: 'Debt minimums' },
  { key: 'childcare', label: 'Childcare' },
  { key: 'other',     label: 'Everything else you can’t cut' },
] as const

type SplitKey = (typeof SPLIT_FIELDS)[number]['key']

function fmtMonths(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 100) return '99+'
  return n < 10 ? n.toFixed(1).replace(/\.0$/, '') : String(Math.floor(n))
}

function voiceFor(r: RunwayResult, months: string): string {
  switch (r.band) {
    case 'no_expenses':
      return 'Put in what a month of essentials costs you, and the runway shows up.'
    case 'crisis':
      return `Under a month. That’s not a verdict, it’s a starting line. The first ${fmtUsd(1_000)} is the hardest and the one that matters most.`
    case 'thin':
      return `${months} months. One layoff away from the credit cards. ${fmtUsd(r.toTargetMin)} more gets you to three.`
    case 'target':
      return `${months} months. You’re in the band. Hold it there and move to the next step.`
    case 'strong':
      return `${months} months. That’s solid ground. Past six, the extra cash may do more work clearing debt or growing for the kids.`
  }
}

export default function RunwayTool({ initial }: { initial: { cash?: number; expenses?: number } }) {
  const [cash, setCash] = useState(initial.cash ?? 0)
  const [mode, setMode] = useState<'total' | 'split'>('total')
  const [total, setTotal] = useState(initial.expenses ?? 0)
  const [split, setSplit] = useState<Record<SplitKey, number>>(
    () => Object.fromEntries(SPLIT_FIELDS.map((f) => [f.key, 0])) as Record<SplitKey, number>,
  )

  const splitTotal = SPLIT_FIELDS.reduce((s, f) => s + split[f.key], 0)
  const expenses = mode === 'split' ? splitTotal : total

  // Switching modes carries the number across so nobody retypes it: split →
  // total keeps the sum; total → split starts blank (a split of a guess is
  // still a guess), and the total field keeps its value for switching back.
  function changeMode(next: 'total' | 'split') {
    if (next === 'total' && mode === 'split' && splitTotal > 0) setTotal(splitTotal)
    setMode(next)
  }

  const r = runRunway(cash, expenses)
  const months = fmtMonths(r.months)
  const hasResult = cash > 0 || expenses > 0

  // Band bar: scale to at least 9 months so the 3–6 band always sits in view.
  const scaleMax = Math.max(9, Number.isFinite(r.months) ? Math.ceil(r.months) : 9)
  const pct = (n: number) => `${Math.min(100, (n / scaleMax) * 100)}%`

  const stats = r.band === 'no_expenses' ? [] : [
    { label: 'Monthly essentials', value: fmtUsd(expenses) },
    { label: `To reach ${RUNWAY_TARGET_MIN} months`, value: r.toTargetMin > 0 ? fmtUsd(r.toTargetMin) : 'There' },
    { label: `To reach ${RUNWAY_TARGET_MAX} months`, value: r.toTargetMax > 0 ? fmtUsd(r.toTargetMax) : 'There' },
  ]

  const links = expenses > 0
    ? [{
        eyebrow: `Next step · ${LABELS.tools.lifeInsurance.spokeRole}`,
        href:  `/tools/life-insurance${toQuery({ exp: expenses })}`,
        label: LABELS.tools.lifeInsurance.full,
        note:  `Runway covers a lost paycheck. This covers a lost dad. Your ${fmtUsd(expenses)}/mo carries over.`,
      }]
    : []

  return (
    <div className="space-y-7">
      <section className="grid grid-cols-1 gap-4">
        <NumberField
          label="Cash you could reach this week"
          help="Checking, savings, money market. Not retirement accounts, not the kids’ 529."
          prefix="$" value={cash} placeholder="0" onChange={setCash}
        />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-prose-faint uppercase tracking-widest">Monthly essentials</p>
          <Segmented
            label="How to enter essentials"
            value={mode}
            onChange={changeMode}
            options={[{ value: 'total', label: 'One number' }, { value: 'split', label: 'Break it down' }]}
          />
        </div>
        {mode === 'total' ? (
          <NumberField
            label="Essentials per month"
            help="What the house costs to run if every extra stopped: housing, food, utilities, insurance, minimums."
            prefix="$" suffix="/mo" value={total} placeholder="0" onChange={setTotal}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SPLIT_FIELDS.map((f) => (
              <NumberField
                key={f.key}
                label={f.label}
                prefix="$" suffix="/mo" value={split[f.key]} placeholder="0"
                onChange={(n) => setSplit((s) => ({ ...s, [f.key]: n }))}
              />
            ))}
            <p className="sm:col-span-2 text-sm text-prose-muted">
              Total: <span className="font-semibold text-prose tabular-nums">{fmtUsd(splitTotal)}/mo</span>
            </p>
          </div>
        )}
      </section>

      {hasResult && (
        <ResultCard
          label="Runway"
          headline={r.band === 'no_expenses' ? '—' : `${months} ${months === '1' ? 'month' : 'months'}`}
          subhead={`Target: ${RUNWAY_TARGET_MIN}–${RUNWAY_TARGET_MAX} months of essentials`}
          voice={voiceFor(r, months)}
          stats={stats}
          tone={r.band === 'target' || r.band === 'strong' ? 'good' : 'warn'}
        >
          {r.band !== 'no_expenses' && (
            <div aria-hidden className="space-y-1.5">
              <div className="relative h-3 rounded-full bg-surface-sunken border border-soft overflow-hidden">
                <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: pct(r.months) }} />
                {[RUNWAY_TARGET_MIN, RUNWAY_TARGET_MAX].map((t) => (
                  <div key={t} className="absolute inset-y-0 w-0.5 bg-prose" style={{ left: pct(t) }} />
                ))}
              </div>
              <div className="relative h-4 text-[10px] text-prose-faint tabular-nums">
                {[RUNWAY_TARGET_MIN, RUNWAY_TARGET_MAX].map((t) => (
                  <span key={t} className="absolute -translate-x-1/2" style={{ left: pct(t) }}>{t} mo</span>
                ))}
              </div>
            </div>
          )}
          <ResultLinks links={links} />
        </ResultCard>
      )}
    </div>
  )
}

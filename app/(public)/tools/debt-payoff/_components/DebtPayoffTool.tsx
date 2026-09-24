'use client'

// Debt Payoff Planner interactive surface.
//
//   debts list → strategy toggle → extra-payment slider → result
//
// Headline: the debt-free date. Supporting: interest, interest saved vs.
// minimums only, payoff order, and snowball vs. avalanche side by side so
// the toggle is a choice with the trade-off visible, not a guess.

import { useState } from 'react'
import NumberField from '@/components/dad-tools/NumberField'
import { ResultCard, ResultLinks, Segmented } from '@/components/dad-tools/CalculatorParts'
import { LABELS } from '@/lib/labels'
import { fmtUsd } from '@/lib/dad-tools/dad-math'
import {
  runDebtPlan, addMonths, fmtMonthYear, fmtDuration,
  type Debt, type PayoffStrategy, type PayoffResult,
} from '@/lib/dad-tools/finance'
import { toQuery } from '@/lib/dad-tools/url-params'
import type { DebtRow } from '@/lib/dad-tools/debt-params'

const EXTRA_MAX = 2_000
const EXTRA_STEP = 25

type Row = DebtRow & { id: number }

const STRATEGY_COPY: Record<PayoffStrategy, string> = {
  snowball:  'Smallest balance first. Quick wins keep you in the fight.',
  avalanche: 'Highest rate first. Pays the least interest, full stop.',
}

interface Props {
  today: string
  initial: { debts: DebtRow[]; extra?: number; strategy?: PayoffStrategy }
}

export default function DebtPayoffTool({ today, initial }: Props) {
  const seed: DebtRow[] = initial.debts.length > 0
    ? initial.debts
    : [{ name: '', balance: 0, aprPct: 0, minPayment: 0 }]
  const [rows, setRows] = useState<Row[]>(() => seed.map((d, i) => ({ ...d, id: i })))
  const [nextId, setNextId] = useState(seed.length)
  const [strategy, setStrategy] = useState<PayoffStrategy>(initial.strategy ?? 'avalanche')
  const [extra, setExtra] = useState(Math.min(EXTRA_MAX, initial.extra ?? 0))

  function update(id: number, patch: Partial<DebtRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }
  function addRow() {
    setRows((rs) => [...rs, { id: nextId, name: '', balance: 0, aprPct: 0, minPayment: 0 }])
    setNextId((n) => n + 1)
  }
  function removeRow(id: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.id !== id) : rs))
  }

  const label = (r: Row, i: number) => r.name.trim() || `Debt ${i + 1}`
  const debts: Debt[] = rows
    .map((r, i) => ({ name: label(r, i), balance: r.balance, apr: r.aprPct / 100, minPayment: r.minPayment }))
    .filter((d) => d.balance > 0)
  const missingMin = rows.some((r) => r.balance > 0 && r.minPayment <= 0)
  const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
  const ready = debts.length > 0 && debts.some((d) => d.minPayment > 0 || extra > 0)

  const [y, m] = today.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const dateAt = (months: number) => fmtMonthYear(addMonths(start, months))

  const plan = ready ? runDebtPlan(debts, extra, strategy) : null

  return (
    <div className="space-y-7">
      {/* ── Debts ───────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-xs text-prose-faint uppercase tracking-widest">What you owe</p>
        {rows.map((r, i) => (
          <div key={r.id} className="bg-surface border border-soft rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={r.name}
                maxLength={40}
                placeholder={`Debt ${i + 1} — e.g. Visa, car, student loan`}
                onChange={(e) => update(r.id, { name: e.target.value })}
                aria-label={`Name for debt ${i + 1}`}
                className="flex-1 min-w-0 px-3 py-2.5 bg-surface-sunken border border-strong focus:border-accent rounded-xl text-prose text-sm placeholder:text-prose-faint focus:outline-none transition-colors"
              />
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRow(r.id)}
                  aria-label={`Remove ${label(r, i)}`}
                  className="shrink-0 h-11 w-11 flex items-center justify-center rounded-xl text-prose-faint hover:text-prose hover:bg-surface-raised transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <NumberField label="Balance" prefix="$" value={r.balance} placeholder="0"
                onChange={(n) => update(r.id, { balance: n })} />
              <NumberField label="APR" suffix="%" decimal value={r.aprPct} placeholder="0"
                onChange={(n) => update(r.id, { aprPct: n })} />
              <NumberField label="Minimum" prefix="$" suffix="/mo" value={r.minPayment} placeholder="0"
                onChange={(n) => update(r.id, { minPayment: n })} />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addRow}
          disabled={rows.length >= 12}
          className="w-full py-3 rounded-2xl border border-dashed border-strong text-sm font-semibold text-prose-muted hover:text-prose hover:border-accent disabled:opacity-40 transition-colors"
        >
          + Add a debt
        </button>
        {missingMin && (
          <p className="text-xs text-prose-muted">
            A debt with no minimum only gets paid from the extra. Check the statement for the real number.
          </p>
        )}
      </section>

      {/* ── Plan ────────────────────────────────────────────────────────── */}
      <section className="space-y-5">
        <div className="space-y-2">
          <Segmented
            label="Payoff strategy"
            value={strategy}
            onChange={setStrategy}
            options={[{ value: 'avalanche', label: 'Avalanche' }, { value: 'snowball', label: 'Snowball' }]}
          />
          <p className="text-sm text-prose-muted">{STRATEGY_COPY[strategy]}</p>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3 mb-1.5">
            <label htmlFor="extra" className="text-xs text-prose-faint uppercase tracking-widest">
              Extra per month
            </label>
            <span className="text-sm font-black text-prose tabular-nums">{fmtUsd(extra)}</span>
          </div>
          <input
            id="extra"
            type="range"
            min={0}
            max={EXTRA_MAX}
            step={EXTRA_STEP}
            value={extra}
            onChange={(e) => setExtra(Number(e.target.value))}
            className="w-full h-11 accent-[var(--bd-orange)] cursor-pointer"
          />
          <p className="text-xs text-prose-faint">
            On top of the minimums{plan ? ` (${fmtUsd(plan.minimums)}/mo)` : ''}. Every freed-up minimum rolls into the next debt.
          </p>
        </div>
      </section>

      {/* ── Result ──────────────────────────────────────────────────────── */}
      {plan && (
        <ResultCard
          label="Debt-free"
          headline={plan.plan.paysOff ? dateAt(plan.plan.months) : 'Not yet'}
          subhead={plan.plan.paysOff
            ? `${fmtDuration(plan.plan.months)} from now · ${fmtUsd(plan.budget)}/mo toward debt`
            : `At ${fmtUsd(plan.budget)}/mo the interest keeps up with the payments`}
          voice={voiceFor(plan.plan, plan.interestSaved, extra, debts)}
          stats={[
            { label: 'Total interest', value: plan.plan.paysOff ? fmtUsd(plan.plan.totalInterest) : '—' },
            {
              label: 'Saved vs. minimums',
              value: plan.interestSaved === null ? 'Minimums never finish' : fmtUsd(plan.interestSaved),
            },
            {
              label: 'Minimums only',
              value: plan.minimumsOnly.paysOff ? dateAt(plan.minimumsOnly.months) : 'Never',
            },
          ]}
          tone={plan.plan.paysOff ? 'good' : 'warn'}
        >
          {plan.plan.paysOff && (
            <>
              <Compare strategy={strategy} chosen={plan.plan} other={plan.other} dateAt={dateAt} />

              <div className="border-t border-soft pt-4">
                <p className="text-[10px] uppercase tracking-widest font-semibold text-prose-faint mb-2">
                  Payoff order
                </p>
                <ol className="space-y-1.5">
                  {plan.plan.order.map((o, i) => (
                    <li key={`${o.name}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-prose">
                        <span className="text-prose-faint tabular-nums mr-2">{i + 1}.</span>
                        {o.name}
                      </span>
                      <span className="text-prose-muted tabular-nums">{dateAt(o.month)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}

          <ResultLinks
            links={[
              {
                eyebrow: 'Carries over',
                href:  `/tools/life-insurance${toQuery({ debt: totalDebt })}`,
                label: 'Use this in your life insurance number',
                note:  `Your ${fmtUsd(totalDebt)} becomes the D in DIME. Leave the mortgage off this list — it has its own line there.`,
              },
              {
                eyebrow: `Next step · ${LABELS.tools.loanMath.spokeRole}`,
                href:  '/tools/loan-math',
                label: LABELS.tools.loanMath.full,
                note:  'Before you sign the next one, see what it really costs.',
              },
            ]}
          />
        </ResultCard>
      )}
    </div>
  )
}

function voiceFor(p: PayoffResult, saved: number | null, extra: number, debts: Debt[]): string {
  if (!p.paysOff) {
    const worst = [...debts].sort((a, b) => b.apr - a.apr)[0]
    return `The balance is outrunning the payments. Push the extra up, or call about the rate on ${worst?.name ?? 'the worst one'} — that call is worth making today.`
  }
  // At $0 extra the plan still rolls each cleared minimum into the next debt,
  // which is why it can beat "minimums only" before the slider moves.
  if (extra === 0) {
    return saved && saved >= 1
      ? `Rolling each paid-off minimum into the next already saves ${fmtUsd(saved)}. Slide the extra up and watch the date move.`
      : 'Slide the extra up and watch the date move.'
  }
  if (saved === null) {
    return 'On minimums alone this never ends. The extra is what turns it into a date.'
  }
  return `${fmtUsd(saved)} less interest than minimums only. That money stays in your house.`
}

function Compare({
  strategy, chosen, other, dateAt,
}: {
  strategy: PayoffStrategy
  chosen:   PayoffResult
  other:    PayoffResult
  dateAt:   (m: number) => string
}) {
  const cols: { key: PayoffStrategy; r: PayoffResult }[] = strategy === 'avalanche'
    ? [{ key: 'avalanche', r: chosen }, { key: 'snowball', r: other }]
    : [{ key: 'snowball', r: chosen }, { key: 'avalanche', r: other }]
  const byKey = Object.fromEntries(cols.map((c) => [c.key, c.r])) as Record<PayoffStrategy, PayoffResult>
  const interestDiff = byKey.snowball.totalInterest - byKey.avalanche.totalInterest
  const firstWinDiff = (byKey.avalanche.order[0]?.month ?? 0) - (byKey.snowball.order[0]?.month ?? 0)

  let note: string
  if (Math.round(interestDiff) <= 0 && firstWinDiff <= 0) {
    note = 'Same result either way with these debts. Pick the one you’ll stick with.'
  } else {
    const parts: string[] = []
    if (Math.round(interestDiff) > 0) parts.push(`Avalanche saves ${fmtUsd(interestDiff)}`)
    if (firstWinDiff > 0) parts.push(`snowball clears your first debt ${fmtDuration(firstWinDiff)} sooner`)
    note = parts.join('; ') + '.'
    note = note.charAt(0).toUpperCase() + note.slice(1)
  }

  return (
    <div className="border-t border-soft pt-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {cols.map(({ key, r }) => (
          <div
            key={key}
            className={`rounded-xl p-3 border ${key === strategy ? 'border-accent/40 bg-surface-raised' : 'border-soft'}`}
          >
            <p className="text-[10px] uppercase tracking-widest font-semibold text-prose-faint">
              {key === 'avalanche' ? 'Avalanche' : 'Snowball'}
            </p>
            <p className="mt-1 text-base font-black text-prose tabular-nums">{dateAt(r.months)}</p>
            <p className="text-xs text-prose-muted tabular-nums">{fmtUsd(r.totalInterest)} interest</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-prose-muted">{note}</p>
    </div>
  )
}

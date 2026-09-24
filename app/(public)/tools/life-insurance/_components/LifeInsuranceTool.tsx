'use client'

// Life Insurance Needs interactive surface — DIME:
//   Debt + Income × years + Mortgage + Education − (coverage + savings)
//
// Headline: the coverage gap, or "You're covered". EDGE OFF throughout
// (brand-guide §1.6) — steady, warm, plain. Educational only: no carriers,
// no products, no "buy now". The next move it points to is an independent
// agent, because one quotes across carriers instead of selling one.

import { useState } from 'react'
import Link from 'next/link'
import NumberField from '@/components/dad-tools/NumberField'
import { ResultCard, ResultLinks } from '@/components/dad-tools/CalculatorParts'
import { LABELS } from '@/lib/labels'
import { fmtUsd, fmtUsdCompact } from '@/lib/dad-tools/dad-math'
import { runDime } from '@/lib/dad-tools/finance'
import { toQuery } from '@/lib/dad-tools/url-params'

const DEFAULT_YEARS = 10

interface Props {
  initial: {
    debt?:         number
    income?:       number
    fromExpenses?: number   // Runway handoff: monthly essentials
    years?:        number
    mortgage?:     number
    education?:    number
    coverage?:     number
    savings?:      number
  }
}

export default function LifeInsuranceTool({ initial }: Props) {
  const incomeFromRunway = initial.income === undefined && initial.fromExpenses ? initial.fromExpenses * 12 : undefined
  const [debt, setDebt]           = useState(initial.debt ?? 0)
  const [income, setIncome]       = useState(initial.income ?? incomeFromRunway ?? 0)
  const [years, setYears]         = useState(initial.years ?? DEFAULT_YEARS)
  const [mortgage, setMortgage]   = useState(initial.mortgage ?? 0)
  const [education, setEducation] = useState(initial.education ?? 0)
  const [coverage, setCoverage]   = useState(initial.coverage ?? 0)
  const [savings, setSavings]     = useState(initial.savings ?? 0)

  const r = runDime({
    debt, annualIncome: income, incomeYears: years, mortgage, education,
    existingCoverage: coverage, savings,
  })

  // Everything on this page, as a query — carried through Dad Math and back
  // so the education round-trip doesn't cost the other six inputs.
  const state = toQuery({ debt, inc: income, yrs: years, mort: mortgage, edu: education, cov: coverage, sav: savings })
  const dadMathHref = `/tools/dad-math${toQuery({ li: state.slice(1) })}`

  const voice = r.need === 0
    ? 'Fill in what your family would need, and the number comes together below.'
    : r.covered
      ? 'On these numbers, your family would be taken care of. Look at it again when life changes — a new baby, a new house, a new job.'
      : 'That’s the gap between what your family would need and what’s in place today. Term life is usually the least expensive way to close a gap like this. An independent agent can price it across several companies, so you’re comparing, not being sold.'

  const stats = r.need === 0 ? [] : [
    { label: 'Debt',        value: fmtUsdCompact(r.parts.debt) },
    { label: `Income × ${years}`, value: fmtUsdCompact(r.parts.income) },
    { label: 'Mortgage',    value: fmtUsdCompact(r.parts.mortgage) },
    { label: 'Education',   value: fmtUsdCompact(r.parts.education) },
    { label: 'Total need',  value: fmtUsdCompact(r.need) },
    { label: 'In place',    value: fmtUsdCompact(r.have) },
  ]

  return (
    <div className="space-y-7">
      <section className="space-y-4">
        <p className="text-xs text-prose-faint uppercase tracking-widest">What your family would need</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            label="Debt" prefix="$" value={debt} placeholder="0" onChange={setDebt}
            help="Cards, car loans, student loans — everything except the mortgage."
          />
          <NumberField
            label="Mortgage balance" prefix="$" value={mortgage} placeholder="0" onChange={setMortgage}
            help="What it would take to pay the house off."
          />
          <NumberField
            label="Yearly income to replace" prefix="$" suffix="/yr" value={income} placeholder="0" onChange={setIncome}
            help={incomeFromRunway !== undefined
              ? `From your runway: ${fmtUsd(initial.fromExpenses ?? 0)}/mo essentials × 12. Raise it to your take-home pay if you want more than the basics covered.`
              : 'Often your take-home pay, or what the house needs to keep running.'}
          />
          <NumberField
            label="For how many years" suffix="yrs" value={years} placeholder={String(DEFAULT_YEARS)} onChange={setYears}
            help="A common choice: until your youngest is on their own."
          />
          <div className="sm:col-span-2">
            <NumberField
              label="Education" prefix="$" value={education} placeholder="0" onChange={setEducation}
              help="College or trade school for the kids, in today’s dollars."
            />
            <Link href={dadMathHref} className="inline-flex items-center gap-1.5 py-2 text-xs font-semibold text-accent hover:text-accent-hover transition-colors">
              Figure your college number in {LABELS.tools.dadMath.full} <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <p className="text-xs text-prose-faint uppercase tracking-widest">What’s already in place</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumberField
            label="Life insurance you have" prefix="$" value={coverage} placeholder="0" onChange={setCoverage}
            help="Term policies plus coverage through work. Work coverage usually ends when the job does."
          />
          <NumberField
            label="Savings & investments" prefix="$" value={savings} placeholder="0" onChange={setSavings}
            help="What your family could actually draw on. Leave out the emergency fund if it’s spoken for."
          />
        </div>
      </section>

      <ResultCard
        label={r.covered ? 'Coverage' : 'Coverage gap'}
        headline={r.need === 0 ? '—' : r.covered ? 'You’re covered' : fmtUsd(r.gap)}
        subhead={r.need === 0 ? undefined : `Estimated need ${fmtUsd(r.need)} · In place ${fmtUsd(r.have)}`}
        voice={voice}
        stats={stats}
        tone={r.covered ? 'good' : 'neutral'}
      >
        <ResultLinks
          links={[{
            eyebrow: `Next step · ${LABELS.tools.debtPayoff.spokeRole}`,
            href:  '/tools/debt-payoff',
            label: LABELS.tools.debtPayoff.full,
            note:  'Every dollar of debt cleared is a dollar less your family would need.',
          }]}
        />
      </ResultCard>
    </div>
  )
}

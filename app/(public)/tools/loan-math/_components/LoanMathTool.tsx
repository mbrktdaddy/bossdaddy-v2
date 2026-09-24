'use client'

// Loan Math interactive surface. Car and personal loans are ONE tool with a
// toggle (docs/money-tools-plan.md) — the amortization is identical; Car
// just adds the dealer-side inputs that change what's financed.
//
// Headline: the monthly payment — the number the dealer sells you. The voice
// line is about the number they don't: total interest, measured in something
// a dad actually buys.

import { useState } from 'react'
import NumberField from '@/components/dad-tools/NumberField'
import { ResultCard, ResultLinks, Segmented } from '@/components/dad-tools/CalculatorParts'
import { LABELS } from '@/lib/labels'
import { fmtUsd } from '@/lib/dad-tools/dad-math'
import {
  runLoanMath, interestYardstick, addMonths, fmtMonthYear, fmtDuration, type LoanKind,
} from '@/lib/dad-tools/finance'
import { toQuery } from '@/lib/dad-tools/url-params'
import { encodeDebtParam } from '@/lib/dad-tools/debt-params'

const DEFAULTS = {
  car:      { amount: 35_000, aprPct: 7,  term: 60 },
  personal: { amount: 10_000, aprPct: 12, term: 36 },
} as const

interface Props {
  today: string   // YYYY-MM-DD from the server — keeps Date out of render
  initial: {
    kind?:    LoanKind
    amount?:  number
    aprPct?:  number
    term?:    number
    down?:    number
    tradeIn?: number
    taxPct?:  number
    fees?:    number
  }
}

export default function LoanMathTool({ today, initial }: Props) {
  const startKind: LoanKind = initial.kind ?? 'car'
  const [kind, setKind]       = useState<LoanKind>(startKind)
  const [amount, setAmount]   = useState(initial.amount ?? DEFAULTS[startKind].amount)
  const [aprPct, setAprPct]   = useState(initial.aprPct ?? DEFAULTS[startKind].aprPct)
  const [term, setTerm]       = useState(initial.term ?? DEFAULTS[startKind].term)
  const [down, setDown]       = useState(initial.down ?? 0)
  const [tradeIn, setTradeIn] = useState(initial.tradeIn ?? 0)
  const [taxPct, setTaxPct]   = useState(initial.taxPct ?? 6)
  const [fees, setFees]       = useState(initial.fees ?? 0)

  const isCar = kind === 'car'
  const r = runLoanMath({
    kind, amount, apr: aprPct / 100, termMonths: Math.round(term),
    down, tradeIn, taxRate: taxPct / 100, fees,
  })

  const [y, m] = today.split('-').map(Number)
  const payoff = addMonths(new Date(y, m - 1, 1), Math.round(term))
  const hasLoan = r.financed > 0 && term > 0

  const interest = Math.round(r.totalInterest)
  const yardstick = interestYardstick(r.totalInterest)
  const voice = !hasLoan
    ? (isCar ? 'Nothing to finance. That’s the cheapest car loan there is.' : 'Nothing borrowed, nothing owed.')
    : interest === 0
      ? 'Zero interest. Read every line of that 0% offer — then take it.'
      : `${fmtUsd(interest)} in interest.${yardstick ? ` That’s about ${yardstick}.` : ''}`

  const stats = hasLoan
    ? [
        { label: 'Total interest', value: fmtUsd(r.totalInterest) },
        { label: isCar ? 'Total cost of the car' : 'Total repaid', value: fmtUsd(r.totalCost) },
        { label: 'Paid off', value: fmtMonthYear(payoff) },
        ...(isCar ? [{ label: 'Amount financed', value: fmtUsd(r.financed) }] : []),
        ...(isCar && r.salesTax > 0 ? [{ label: 'Sales tax', value: fmtUsd(r.salesTax) }] : []),
      ]
    : []

  const debtName = isCar ? 'Car loan' : 'Personal loan'
  const links = hasLoan
    ? [
        {
          eyebrow: 'Already signed?',
          href:  `/tools/debt-payoff${toQuery({ d: encodeDebtParam({ name: debtName, balance: r.financed, aprPct, minPayment: r.monthlyPayment }) })}`,
          label: 'Add this to a payoff plan',
          note:  'Drops this loan into the Debt Payoff Planner alongside everything else you owe.',
        },
        {
          eyebrow: `Next step · ${LABELS.tools.dadMath.spokeRole}`,
          href:  '/tools/dad-math',
          label: LABELS.tools.dadMath.full,
          note:  'Debt handled? Point the money at your kid’s future.',
        },
      ]
    : []

  return (
    <div className="space-y-7">
      <Segmented
        label="Loan type"
        value={kind}
        onChange={setKind}
        options={[{ value: 'car', label: 'Car' }, { value: 'personal', label: 'Personal' }]}
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumberField
          label={isCar ? 'Price of the car' : 'Amount to borrow'}
          help={isCar ? 'The out-the-door price you negotiated, before tax.' : 'What you actually need, not what they’ll approve.'}
          prefix="$" value={amount} placeholder={String(DEFAULTS[kind].amount)} onChange={setAmount}
        />
        <NumberField
          label="APR" help="The annual rate on the offer. Check your credit union too."
          suffix="%" decimal value={aprPct} placeholder={String(DEFAULTS[kind].aprPct)} onChange={setAprPct}
        />
        <NumberField
          label="Term" help={term > 0 ? `${fmtDuration(term)}. Longer terms lower the payment and raise the interest.` : 'Length of the loan in months.'}
          suffix="mo" value={term} placeholder={String(DEFAULTS[kind].term)} onChange={setTerm}
        />
        {isCar && (
          <>
            <NumberField label="Down payment" help="Cash at signing." prefix="$" value={down} placeholder="0" onChange={setDown} />
            <NumberField label="Trade-in value" help="What they’re giving you for the old one." prefix="$" value={tradeIn} placeholder="0" onChange={setTradeIn} />
            <NumberField
              label="Sales tax" help="Charged on price minus trade-in in most states. A few tax the full price."
              suffix="%" decimal value={taxPct} placeholder="6" onChange={setTaxPct}
            />
            <NumberField label="Fees rolled in" help="Doc, title and registration fees added to the loan." prefix="$" value={fees} placeholder="0" onChange={setFees} />
          </>
        )}
      </section>

      <ResultCard
        label="Monthly payment"
        headline={hasLoan ? fmtUsd(r.monthlyPayment) : '$0'}
        subhead={hasLoan ? `for ${fmtDuration(term)} at ${aprPct}% APR` : undefined}
        voice={voice}
        stats={stats}
        tone={hasLoan && interest > 0 ? 'warn' : 'good'}
      >
        <ResultLinks links={links} />
      </ResultCard>
    </div>
  )
}

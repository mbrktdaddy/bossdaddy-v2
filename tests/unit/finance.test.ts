import { describe, it, expect } from 'vitest'
import {
  monthlyPayment, amortize, addMonths, fmtDuration,
  runLoanMath, interestYardstick,
  runRunway,
  payoffOrder, simulatePayoff, runDebtPlan, PAYOFF_MONTH_CAP, type Debt,
  runDime,
} from '@/lib/dad-tools/finance'

// The money calculators print one number per page, and a dad may act on it.
// These pin the math to known-good values from standard amortization tables.

describe('amortization', () => {
  it('matches the textbook payment for a 60-month car loan', () => {
    // $30,000 at 6% over 60 months → $579.98/mo
    expect(monthlyPayment(30_000, 0.06, 60)).toBeCloseTo(579.98, 2)
  })

  it('is linear at 0% APR', () => {
    expect(monthlyPayment(12_000, 0, 48)).toBe(250)
    expect(amortize(12_000, 0, 48).totalInterest).toBe(0)
  })

  it('returns zeros for nothing borrowed', () => {
    expect(amortize(0, 0.07, 60)).toMatchObject({ monthlyPayment: 0, totalInterest: 0, totalPaid: 0 })
  })

  it('total interest = payments − principal', () => {
    const a = amortize(30_000, 0.06, 60)
    expect(a.totalPaid).toBeCloseTo(579.98 * 60, 0)
    expect(a.totalInterest).toBeCloseTo(a.totalPaid - 30_000, 6)
  })

  it('addMonths anchors to the 1st (no Jan-31 overflow)', () => {
    const d = addMonths(new Date(2026, 0, 31), 1)
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 1, 1])
    expect(addMonths(new Date(2026, 10, 15), 3).getFullYear()).toBe(2027)
  })

  it('formats durations', () => {
    expect(fmtDuration(8)).toBe('8 mo')
    expect(fmtDuration(12)).toBe('1 yr')
    expect(fmtDuration(51)).toBe('4 yrs 3 mo')
  })
})

describe('Loan Math', () => {
  const car = {
    kind: 'car' as const, amount: 35_000, apr: 0.07, termMonths: 72,
    down: 3_000, tradeIn: 5_000, taxRate: 0.06, fees: 500,
  }

  it('taxes price minus trade-in and rolls fees into the loan', () => {
    const r = runLoanMath(car)
    expect(r.salesTax).toBeCloseTo(1_800, 6)             // 6% of 30,000
    expect(r.financed).toBeCloseTo(35_000 + 1_800 + 500 - 3_000 - 5_000, 6)
    expect(r.upfront).toBe(8_000)
    expect(r.totalCost).toBeCloseTo(r.totalPaid + 8_000, 6)
  })

  it('personal loans ignore the car-only fields', () => {
    const r = runLoanMath({ ...car, kind: 'personal', amount: 10_000 })
    expect(r.financed).toBe(10_000)
    expect(r.salesTax).toBe(0)
    expect(r.upfront).toBe(0)
  })

  it('never finances a negative amount (cash deal)', () => {
    const r = runLoanMath({ ...car, amount: 5_000, down: 10_000 })
    expect(r.financed).toBe(0)
    expect(r.monthlyPayment).toBe(0)
  })

  it('yardstick picks the largest unit that fits twice', () => {
    expect(interestYardstick(9_400)).toBe('2.5 years of travel-ball fees')
    expect(interestYardstick(3_000)).toBe('2.5 months of groceries')
    expect(interestYardstick(100)).toBe('2.5 Friday pizza nights')
    expect(interestYardstick(50)).toBe('a Friday pizza night')
    expect(interestYardstick(10)).toBeNull()
  })
})

describe('Emergency Runway', () => {
  it('computes months and bands', () => {
    expect(runRunway(500, 4_000).band).toBe('crisis')
    expect(runRunway(8_000, 4_000)).toMatchObject({ months: 2, band: 'thin', toTargetMin: 4_000, toTargetMax: 16_000 })
    expect(runRunway(12_000, 4_000).band).toBe('target')
    expect(runRunway(24_000, 4_000).band).toBe('target')     // 6 is inside the band
    expect(runRunway(30_000, 4_000)).toMatchObject({ band: 'strong', toTargetMin: 0, toTargetMax: 0 })
  })

  it('handles zero expenses without dividing by zero', () => {
    expect(runRunway(1_000, 0)).toMatchObject({ months: Infinity, band: 'no_expenses' })
  })
})

describe('Debt Payoff', () => {
  const debts: Debt[] = [
    { name: 'Visa',     balance: 6_000, apr: 0.24, minPayment: 150 },
    { name: 'Car',      balance: 14_000, apr: 0.065, minPayment: 320 },
    { name: 'Medical',  balance: 1_200, apr: 0,    minPayment: 50 },
  ]

  it('orders snowball by balance and avalanche by APR', () => {
    expect(payoffOrder(debts, 'snowball')).toEqual([2, 0, 1])
    expect(payoffOrder(debts, 'avalanche')).toEqual([0, 1, 2])
  })

  it('a single debt at its own payment matches amortization', () => {
    const pmt = monthlyPayment(10_000, 0.12, 36)
    const r = simulatePayoff([{ name: 'X', balance: 10_000, apr: 0.12, minPayment: pmt }], pmt, 'avalanche')
    expect(r.paysOff).toBe(true)
    expect(r.months).toBe(36)
    expect(r.totalInterest).toBeCloseTo(amortize(10_000, 0.12, 36).totalInterest, 0)
  })

  it('avalanche never pays more interest than snowball', () => {
    const p = runDebtPlan(debts, 300, 'avalanche')
    expect(p.plan.totalInterest).toBeLessThanOrEqual(p.other.totalInterest)
  })

  it('extra payments beat minimums-only', () => {
    const p = runDebtPlan(debts, 300, 'snowball')
    expect(p.budget).toBe(520 + 300)
    expect(p.plan.months).toBeLessThan(p.minimumsOnly.months)
    expect(p.interestSaved).toBeGreaterThan(0)
    // Snowball clears the smallest balance first.
    expect(p.plan.order[0].name).toBe('Medical')
  })

  it('flags a minimum that never covers the interest', () => {
    const r = simulatePayoff([{ name: 'Trap', balance: 10_000, apr: 0.30, minPayment: 200 }], 200, 'snowball')
    expect(r.paysOff).toBe(false)
    expect(r.months).toBe(PAYOFF_MONTH_CAP)
    expect(runDebtPlan([{ name: 'Trap', balance: 10_000, apr: 0.30, minPayment: 200 }], 0, 'snowball').interestSaved).toBeNull()
  })

  it('ignores zero-balance rows', () => {
    const r = simulatePayoff([{ name: 'Done', balance: 0, apr: 0.2, minPayment: 50 }], 50, 'snowball')
    expect(r).toMatchObject({ months: 0, paysOff: true, totalInterest: 0 })
  })
})

describe('Life Insurance (DIME)', () => {
  const base = {
    debt: 20_000, annualIncome: 80_000, incomeYears: 10, mortgage: 250_000,
    education: 100_000, existingCoverage: 250_000, savings: 30_000,
  }

  it('adds D + I·years + M + E, minus what you have', () => {
    const r = runDime(base)
    expect(r.need).toBe(20_000 + 800_000 + 250_000 + 100_000)
    expect(r.have).toBe(280_000)
    expect(r.gap).toBe(1_170_000 - 280_000)
    expect(r.covered).toBe(false)
  })

  it('floors the gap at zero and reports covered', () => {
    const r = runDime({ ...base, existingCoverage: 2_000_000 })
    expect(r.gap).toBe(0)
    expect(r.covered).toBe(true)
  })

  it('empty inputs are not "covered"', () => {
    const r = runDime({ debt: 0, annualIncome: 0, incomeYears: 0, mortgage: 0, education: 0, existingCoverage: 0, savings: 0 })
    expect(r.covered).toBe(false)
  })
})

describe('debt URL params', () => {
  it('round-trips a row and drops garbage', async () => {
    const { encodeDebtParam, decodeDebtParams } = await import('@/lib/dad-tools/debt-params')
    const enc = encodeDebtParam({ name: 'Car ~ loan', balance: 28_123.456, aprPct: 6.9, minPayment: 579.981 })
    expect(enc).toBe('Car   loan~28123.46~6.9~579.98')
    expect(decodeDebtParams([enc, 'Bad~abc~1~2', 'Neg~-5~1~2'])).toEqual([
      { name: 'Car   loan', balance: 28123.46, aprPct: 6.9, minPayment: 579.98 },
    ])
  })
})

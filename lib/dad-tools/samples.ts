// Honest samples for the toolbox's demo state (brand-guide §11, 2026-11-13):
// one worked example per tool, computed with the tool's OWN math for a stated
// input, so every number a visitor sees is true for that input. The row labels
// it "Example" and states the input beside the output — a realistic figure on a
// page a man signs into reads as HIS data (the TodayCard rule), so the input is
// never left implicit. The Boss and Goals have no pure math; theirs are stated
// examples in the same shape.

import { milestoneDate, weeksUntil } from './calc'
import { fmtUsdCompact, futureValue, runDadMath } from './dad-math'
import { amortize, runDebtPlan, runDime, runRunway } from './finance'
import { fmtUsdWhole } from './savings'

export interface ToolSample {
  /** The stated input, shown after "Example". */
  input: string
  /** The result, shown as the row's readout. */
  output: string
}

/** YYYY-MM-DD for `years` ago, so an "N-year-old" example stays N years old. */
function yearsAgo(years: number, now: Date): string {
  const d = new Date(now)
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().slice(0, 10)
}

/** The samples, keyed by the tool's href. `now` only moves the age-based ones. */
export function toolSamples(now: Date = new Date()): Record<string, ToolSample> {
  const sevenYearsOld = yearsAgo(7, now)
  const until18 = milestoneDate('until_18', sevenYearsOld)
  const weekends = until18 ? weeksUntil(until18) : 0

  const loan = amortize(32_000, 0.069, 60)
  const runway = runRunway(12_000, 4_100)
  const dime = runDime({
    debt: 15_000, annualIncome: 72_000, incomeYears: 10, mortgage: 240_000,
    education: 100_000, existingCoverage: 100_000, savings: 20_000,
  })
  const debt = runDebtPlan(
    [
      { name: 'Card', balance: 6_400, apr: 0.249, minPayment: 160 },
      { name: 'Car', balance: 11_200, apr: 0.069, minPayment: 240 },
    ],
    200,
    'avalanche',
  )
  const college = runDadMath({
    birthdate: sevenYearsOld, currentBalance: 4_000, monthlyContrib: 150, targetBy18: 60_000, annualReturn: 0.06,
  })
  const jar = futureValue(0, (25 * 52) / 12, 0, 10)

  return {
    '/tools/the-boss':         { input: 'Ask it: "A cooler under $200 for weekend trips?"', output: 'A straight answer' },
    '/tools/weekends-until':   { input: 'A 7-year-old, until 18', output: `${weekends.toLocaleString('en-US')} weekends` },
    '/tools/savings':          { input: '$25 a week for 10 years', output: fmtUsdWhole(jar) },
    '/goals':                  { input: 'Take my vitamins, daily', output: 'Day 12 of 30' },
    '/tools/emergency-runway': { input: '$12,000 saved, $4,100 a month', output: `${runway.months.toFixed(1)} months` },
    '/tools/life-insurance':   { input: '$72k income for 10 years, $240k mortgage', output: `${fmtUsdCompact(dime.gap)} gap` },
    '/tools/debt-payoff':      { input: '$17,600 on two debts, $200 extra a month', output: `Debt-free in ${debt.plan.months} months` },
    '/tools/loan-math':        { input: '$32,000 at 6.9% over 60 months', output: `${fmtUsdWhole(loan.monthlyPayment)} a month` },
    '/tools/dad-math':         { input: '$4,000 saved, $150 a month at 6%', output: `${fmtUsdCompact(college.projectedValue)} by 18` },
  }
}

// Pure math for the money calculators — Loan Math, Emergency Runway, Debt
// Payoff, Life Insurance Needs. No client/server context, no I/O; safe in
// both. Same posture as ./dad-math.ts (which keeps its own growth math).
//
// Plan: docs/money-tools-plan.md. Every page is a thin shell over this file,
// and every function here is unit-tested in tests/unit/finance.test.ts.
//
// Conventions:
//   - APRs are DECIMALS here (0.069), percent only at the UI edge.
//   - Money is plain dollars as floats; rounding happens at display.
//   - "Estimate, not advice." Disclosures live in each page footer.

// ─── Amortization ──────────────────────────────────────────────────────────

// Fixed payment that retires `principal` over `months` at `apr`.
//   PMT = P·r / (1 − (1+r)^−n), r = apr/12. Linear when r ≈ 0.
export function monthlyPayment(principal: number, apr: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  const r = apr / 12
  if (Math.abs(r) < 1e-9) return principal / months
  return (principal * r) / (1 - Math.pow(1 + r, -months))
}

export type Amortization = {
  monthlyPayment: number
  totalInterest:  number
  totalPaid:      number
  months:         number
}

export function amortize(principal: number, apr: number, months: number): Amortization {
  const pmt = monthlyPayment(principal, apr, months)
  const totalPaid = pmt * Math.max(0, months)
  return {
    monthlyPayment: pmt,
    totalInterest:  Math.max(0, totalPaid - Math.max(0, principal)),
    totalPaid,
    months:         Math.max(0, months),
  }
}

// The calendar month `n` months after `from` — the payoff/debt-free date.
// Anchored to the 1st so Jan 31 + 1 never rolls into March.
export function addMonths(from: Date, n: number): Date {
  return new Date(from.getFullYear(), from.getMonth() + n, 1)
}

export function fmtMonthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// "4 yrs 3 mo" / "8 mo" / "5 yrs".
export function fmtDuration(months: number): string {
  const m = Math.max(0, Math.round(months))
  const y = Math.floor(m / 12)
  const r = m % 12
  if (y === 0) return `${r} mo`
  if (r === 0) return `${y} ${y === 1 ? 'yr' : 'yrs'}`
  return `${y} ${y === 1 ? 'yr' : 'yrs'} ${r} mo`
}

// ─── Loan Math (car / personal) ────────────────────────────────────────────

export type LoanKind = 'car' | 'personal'

export type LoanInputs = {
  kind:       LoanKind
  amount:     number   // car: sticker/negotiated price · personal: amount borrowed
  apr:        number   // decimal
  termMonths: number
  // Car only — ignored for personal.
  down:       number
  tradeIn:    number
  taxRate:    number   // decimal
  fees:       number   // doc/title/registration rolled into the loan
}

export type LoanResult = Amortization & {
  financed:  number   // what the lender actually hands over
  salesTax:  number
  upfront:   number   // cash + trade equity out of your pocket at signing
  totalCost: number   // every payment + upfront — what the thing really cost
}

// Sales tax is charged on price minus trade-in — the rule in most US states.
// A few tax the full price; the help text on the page says so.
export function runLoanMath(i: LoanInputs): LoanResult {
  const isCar = i.kind === 'car'
  const down    = isCar ? Math.max(0, i.down) : 0
  const tradeIn = isCar ? Math.max(0, i.tradeIn) : 0
  const fees    = isCar ? Math.max(0, i.fees) : 0
  const taxable = Math.max(0, i.amount - tradeIn)
  const salesTax = isCar ? taxable * Math.max(0, i.taxRate) : 0
  const financed = Math.max(0, i.amount + salesTax + fees - down - tradeIn)
  const a = amortize(financed, i.apr, i.termMonths)
  const upfront = down + tradeIn
  return { ...a, financed, salesTax, upfront, totalCost: a.totalPaid + upfront }
}

// The voice-line comparison: interest measured in something a dad buys.
// Rough national figures, deliberately round — the line says "about".
const INTEREST_YARDSTICKS = [
  { cost: 4_000, one: 'year of travel-ball fees',   many: 'years of travel-ball fees' },
  { cost: 1_200, one: 'month of groceries',         many: 'months of groceries' },
  { cost: 150,   one: 'tank of gas',                many: 'tanks of gas' },
  { cost: 40,    one: 'Friday pizza night',          many: 'Friday pizza nights' },
] as const

// Largest yardstick that fits at least twice. Null below one pizza night.
export function interestYardstick(interest: number): string | null {
  for (const y of INTEREST_YARDSTICKS) {
    const n = interest / y.cost
    if (n >= 2) {
      const rounded = n >= 10 ? Math.round(n) : Math.round(n * 2) / 2
      return `${rounded} ${y.many}`
    }
  }
  const last = INTEREST_YARDSTICKS[INTEREST_YARDSTICKS.length - 1]
  return interest >= last.cost ? `a ${last.one}` : null
}

// ─── Emergency Runway ──────────────────────────────────────────────────────

export const RUNWAY_TARGET_MIN = 3
export const RUNWAY_TARGET_MAX = 6

export type RunwayBand = 'no_expenses' | 'crisis' | 'thin' | 'target' | 'strong'

export type RunwayResult = {
  months:          number        // Infinity when expenses are 0
  band:            RunwayBand
  toTargetMin:     number        // $ still needed to reach 3 months (0 if there)
  toTargetMax:     number        // $ still needed to reach 6 months
}

export function runRunway(cash: number, monthlyEssentials: number): RunwayResult {
  const c = Math.max(0, cash)
  const e = Math.max(0, monthlyEssentials)
  if (e === 0) {
    return { months: Infinity, band: 'no_expenses', toTargetMin: 0, toTargetMax: 0 }
  }
  const months = c / e
  const band: RunwayBand =
    months < 1                 ? 'crisis' :
    months < RUNWAY_TARGET_MIN ? 'thin' :
    months <= RUNWAY_TARGET_MAX ? 'target' :
                                 'strong'
  return {
    months,
    band,
    toTargetMin: Math.max(0, RUNWAY_TARGET_MIN * e - c),
    toTargetMax: Math.max(0, RUNWAY_TARGET_MAX * e - c),
  }
}

// ─── Debt Payoff ───────────────────────────────────────────────────────────

export type Debt = {
  name:       string
  balance:    number
  apr:        number   // decimal
  minPayment: number
}

export type PayoffStrategy = 'snowball' | 'avalanche'

// 50 years. Past this the plan isn't a plan — the result says so instead of
// spinning forever on a minimum that never covers the interest.
export const PAYOFF_MONTH_CAP = 600

export type PayoffResult = {
  months:        number      // months to debt-free (PAYOFF_MONTH_CAP if never)
  paysOff:       boolean     // false = hit the cap
  totalInterest: number
  totalPaid:     number
  order:         { name: string; month: number }[]   // payoff sequence
}

// Snowball: smallest balance first (quick wins). Avalanche: highest APR first
// (least interest). Ties break on the other key. The order is fixed from the
// starting balances — the textbook method, and what the page explains.
export function payoffOrder(debts: Debt[], strategy: PayoffStrategy): number[] {
  const idx = debts.map((_, i) => i)
  return idx.sort((a, b) => {
    const A = debts[a], B = debts[b]
    if (strategy === 'snowball') {
      return A.balance - B.balance || B.apr - A.apr || a - b
    }
    return B.apr - A.apr || A.balance - B.balance || a - b
  })
}

// Month-by-month simulation. Each month: interest accrues, every open debt
// gets its minimum (capped at its balance), then whatever's left of `budget`
// goes to the first open debt in strategy order and cascades.
//
// rollover=false is "minimums only": each debt gets exactly its minimum, and a
// cleared debt's minimum is NOT redirected. That's the baseline the
// interest-saved number is measured against.
export function simulatePayoff(
  debts: Debt[],
  budget: number,
  strategy: PayoffStrategy,
  rollover = true,
): PayoffResult {
  const live = debts.filter((d) => d.balance > 0)
  const bal = live.map((d) => d.balance)
  const order = payoffOrder(live, strategy)
  const paidOffAt: (number | null)[] = live.map(() => null)
  let totalInterest = 0
  let totalPaid = 0
  let month = 0

  while (bal.some((b) => b > 0.005) && month < PAYOFF_MONTH_CAP) {
    month++
    for (let i = 0; i < live.length; i++) {
      if (bal[i] <= 0) continue
      const interest = bal[i] * (Math.max(0, live[i].apr) / 12)
      bal[i] += interest
      totalInterest += interest
    }

    let pool = rollover ? Math.max(0, budget) : Infinity
    for (let i = 0; i < live.length; i++) {
      if (bal[i] <= 0) continue
      const pay = Math.min(Math.max(0, live[i].minPayment), bal[i], pool)
      bal[i] -= pay
      pool -= pay
      totalPaid += pay
    }

    if (rollover) {
      for (const i of order) {
        if (pool <= 0) break
        if (bal[i] <= 0) continue
        const pay = Math.min(pool, bal[i])
        bal[i] -= pay
        pool -= pay
        totalPaid += pay
      }
    }

    for (let i = 0; i < live.length; i++) {
      if (bal[i] <= 0.005 && paidOffAt[i] === null) {
        bal[i] = 0
        paidOffAt[i] = month
      }
    }
  }

  const paysOff = paidOffAt.every((m) => m !== null)
  const sequence = live
    .map((d, i) => ({ name: d.name, month: paidOffAt[i] ?? PAYOFF_MONTH_CAP, i }))
    .sort((a, b) => a.month - b.month || order.indexOf(a.i) - order.indexOf(b.i))
    .map(({ name, month }) => ({ name, month }))

  return { months: month, paysOff, totalInterest, totalPaid, order: sequence }
}

export function sumMinimums(debts: Debt[]): number {
  return debts.reduce((s, d) => s + (d.balance > 0 ? Math.max(0, d.minPayment) : 0), 0)
}

export type DebtPlan = {
  budget:       number
  minimums:     number
  plan:         PayoffResult          // the chosen strategy at `budget`
  other:        PayoffResult          // the other strategy at `budget`, for side-by-side
  minimumsOnly: PayoffResult          // baseline
  interestSaved: number | null        // null when minimums-only never pays off
}

// `extra` is on top of the minimums — the slider on the page. The budget is
// always at least the minimums, so the plan can't be under-funded.
export function runDebtPlan(debts: Debt[], extra: number, strategy: PayoffStrategy): DebtPlan {
  const minimums = sumMinimums(debts)
  const budget = minimums + Math.max(0, extra)
  const plan = simulatePayoff(debts, budget, strategy)
  const other = simulatePayoff(debts, budget, strategy === 'snowball' ? 'avalanche' : 'snowball')
  const minimumsOnly = simulatePayoff(debts, minimums, strategy, false)
  return {
    budget,
    minimums,
    plan,
    other,
    minimumsOnly,
    interestSaved: minimumsOnly.paysOff
      ? Math.max(0, minimumsOnly.totalInterest - plan.totalInterest)
      : null,
  }
}

// ─── Life Insurance Needs (DIME) ───────────────────────────────────────────

export type DimeInputs = {
  debt:             number   // D — everything but the mortgage
  annualIncome:     number   // I — yearly income to replace
  incomeYears:      number   //     for how many years
  mortgage:         number   // M — payoff balance
  education:        number   // E — college for the kids
  existingCoverage: number   // term + group life already in force
  savings:          number   // liquid savings/investments the family could use
}

export type DimeResult = {
  need:     number   // D + I·years + M + E
  have:     number   // coverage + savings
  gap:      number   // need − have, floored at 0
  covered:  boolean
  parts:    { debt: number; income: number; mortgage: number; education: number }
}

export function runDime(i: DimeInputs): DimeResult {
  const parts = {
    debt:      Math.max(0, i.debt),
    income:    Math.max(0, i.annualIncome) * Math.max(0, i.incomeYears),
    mortgage:  Math.max(0, i.mortgage),
    education: Math.max(0, i.education),
  }
  const need = parts.debt + parts.income + parts.mortgage + parts.education
  const have = Math.max(0, i.existingCoverage) + Math.max(0, i.savings)
  const gap = Math.max(0, need - have)
  return { need, have, gap, covered: need > 0 && gap === 0, parts }
}

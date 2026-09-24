// URL encoding for Debt Payoff rows: one `d` param per debt,
//   d=<name>~<balance>~<apr %>~<minimum>
// Repeatable, human-readable, and small enough that a Loan Math handoff or a
// shared plan stays a sane link. `~` is stripped from names so it can't break
// the split. APR is PERCENT in the URL (6.5), like every calculator URL.

export type DebtRow = {
  name:       string
  balance:    number
  aprPct:     number
  minPayment: number
}

const MAX_ROWS = 12
const MAX_NAME = 40

const round2 = (n: number) => Math.round(n * 100) / 100

export function encodeDebtParam(d: DebtRow): string {
  const name = d.name.replace(/~/g, ' ').trim().slice(0, MAX_NAME)
  return [name, round2(d.balance), round2(d.aprPct), round2(d.minPayment)].join('~')
}

// Bad rows are dropped, never thrown — a mangled link still opens the tool.
export function decodeDebtParams(values: string[]): DebtRow[] {
  const rows: DebtRow[] = []
  for (const v of values.slice(0, MAX_ROWS)) {
    const [name, bal, apr, min] = v.split('~')
    const nums = [bal, apr, min].map((s) => Number(s))
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) continue
    rows.push({
      name:       (name ?? '').trim().slice(0, MAX_NAME),
      balance:    nums[0],
      aprPct:     nums[1],
      minPayment: nums[2],
    })
  }
  return rows
}

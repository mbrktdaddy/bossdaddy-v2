// searchParams helpers for the stateless calculators. Their only state is the
// URL — shared links and cross-tool handoffs (docs/money-tools-plan.md) — so
// every page parses params the same forgiving way: bad input → undefined →
// the tool's default, never a thrown error.

export type SearchParams = Record<string, string | string[] | undefined>

export function single(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

export function all(v: string | string[] | undefined): string[] {
  if (v === undefined) return []
  return Array.isArray(v) ? v : [v]
}

// Finite, non-negative number or undefined. Every calculator input is a
// magnitude, so a negative in a URL is garbage, not a signal.
export function parseAmount(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

// A query string carried THROUGH another tool (Life Insurance → Dad Math →
// back) arrives as one opaque param. Re-parse it and keep only the known
// numeric keys, so it can't smuggle anything else into the return link.
export function pickAmounts(query: string | undefined, keys: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {}
  if (!query) return out
  const q = new URLSearchParams(query)
  for (const k of keys) {
    const n = parseAmount(q.get(k) ?? undefined)
    if (n !== undefined) out[k] = n
  }
  return out
}

// Build a query string, dropping undefined/zero-ish values so handoff links
// stay short and readable.
export function toQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || v === 0) continue
    q.set(k, typeof v === 'number' ? String(Math.round(v * 100) / 100) : v)
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

// Life Insurance's URL keys — shared with Dad Math, which carries them out
// and back so the education round-trip doesn't wipe the other inputs.
export const LIFE_INSURANCE_KEYS = ['debt', 'inc', 'yrs', 'mort', 'edu', 'cov', 'sav'] as const

// Pure math + types for the Dad Math tool. No client/server context — safe
// in both. Same architectural posture as lib/dad-tools/calc.ts.
//
// v0 scope: one calculation — college savings projection. Given a current
// balance, a monthly contribution, an assumed annual return, and a target
// by age 18, project the future value and tell the dad whether he's on
// track, behind, or backed in.
//
// "Estimate, not advice." Constants live here so future tuning is one edit.

import { ageInYears } from './calc'

export const DEFAULT_TARGET_BY_18  = 94_000   // average 4-year in-state public total (rounded)
export const DEFAULT_RETURN_RATE   = 0.06     // 6% blended annual — historical equity/bond mix
export const DEFAULT_MONTHLY       = 0
export const DEFAULT_BALANCE       = 0

// Verdict thresholds — ratio of projected FV to target.
const RATIO_LOCKED_IN = 1.5   // 150% of target → "over-funding" warning
const RATIO_SURPLUS   = 1.1   // 110% of target → "ahead, comfortable buffer"
const RATIO_ON_TRACK  = 0.9   // 90–110% of target → "on track"
const RATIO_BEHIND    = 0.5   // 50–90% of target → "behind, here's the gap"
                              // < 50% of target  → "real gap, talk about the target"

export type DadMathVerdict =
  | 'just_starting'   // no balance, no contribution
  | 'past_18'         // kid is already 18+
  | 'locked_in'       // FV >= 1.5x target
  | 'surplus'         // 1.1x <= FV < 1.5x target
  | 'on_track'        // 0.9x <= FV < 1.1x target
  | 'behind'          // 0.5x <= FV < 0.9x target
  | 'real_gap'        // FV < 0.5x target

export type DadMathInputs = {
  birthdate:       string  // YYYY-MM-DD
  currentBalance:  number  // PV
  monthlyContrib:  number  // PMT
  targetBy18:      number  // goal
  annualReturn:    number  // decimal, e.g. 0.06
}

export type DadMathResult = {
  yearsRemaining:   number   // until 18; 0 means past 18
  projectedValue:   number   // FV at 18
  shortfall:        number   // target - FV (positive = behind, negative = surplus)
  ratio:            number   // FV / target
  monthlyToCatchUp: number   // PMT needed to hit target; 0 if already on track
  verdict:          DadMathVerdict
}

// Future value with monthly contributions, monthly compounding.
//   FV = PV*(1+r/12)^(12*t) + PMT * [((1+r/12)^(12*t) - 1) / (r/12)]
//   Falls back to linear when r ≈ 0 to avoid divide-by-zero.
export function futureValue(
  pv: number, pmt: number, annualReturn: number, years: number,
): number {
  if (years <= 0) return pv
  const months = years * 12
  const r = annualReturn / 12

  if (Math.abs(r) < 1e-9) {
    return pv + pmt * months
  }

  const growth = Math.pow(1 + r, months)
  return pv * growth + pmt * ((growth - 1) / r)
}

// Required monthly contribution to hit `target` at `years` from now, given
// the current balance and assumed return. Returns 0 if already on track.
export function monthlyToHit(
  target: number, pv: number, annualReturn: number, years: number,
): number {
  if (years <= 0) return 0
  const months = years * 12
  const r = annualReturn / 12

  if (Math.abs(r) < 1e-9) {
    const needed = (target - pv) / months
    return Math.max(0, needed)
  }

  const growth = Math.pow(1 + r, months)
  const pvAtTarget = pv * growth
  const remainingGrowth = (growth - 1) / r
  if (remainingGrowth <= 0) return 0
  const needed = (target - pvAtTarget) / remainingGrowth
  return Math.max(0, needed)
}

// Years remaining until the kid's 18th birthday, rounded down to whole
// years (matches the savings-calc convention of full annual compounding).
// Returns 0 if the kid is already 18+.
export function yearsUntil18(birthdate: string): number {
  return Math.max(0, 18 - ageInYears(birthdate))
}

export function runDadMath(inputs: DadMathInputs): DadMathResult {
  const years = yearsUntil18(inputs.birthdate)
  const fv    = futureValue(
    inputs.currentBalance,
    inputs.monthlyContrib,
    inputs.annualReturn,
    years,
  )
  const ratio       = inputs.targetBy18 > 0 ? fv / inputs.targetBy18 : 0
  const shortfall   = inputs.targetBy18 - fv
  const monthlyNeed = monthlyToHit(
    inputs.targetBy18,
    inputs.currentBalance,
    inputs.annualReturn,
    years,
  )

  let verdict: DadMathVerdict
  if (years <= 0) {
    verdict = 'past_18'
  } else if (inputs.currentBalance <= 0 && inputs.monthlyContrib <= 0) {
    verdict = 'just_starting'
  } else if (ratio >= RATIO_LOCKED_IN) {
    verdict = 'locked_in'
  } else if (ratio >= RATIO_SURPLUS) {
    verdict = 'surplus'
  } else if (ratio >= RATIO_ON_TRACK) {
    verdict = 'on_track'
  } else if (ratio >= RATIO_BEHIND) {
    verdict = 'behind'
  } else {
    verdict = 'real_gap'
  }

  return {
    yearsRemaining:   years,
    projectedValue:   fv,
    shortfall,
    ratio,
    monthlyToCatchUp: monthlyNeed,
    verdict,
  }
}

// Currency formatter — USD, no cents, used everywhere the tool displays a
// dollar number. Avoids inconsistent rounding across components.
export function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Math.round(n))
}

// Compact form for headlines — "$94k" instead of "$94,000".
export function fmtUsdCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${n < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (abs >= 1_000)     return `${n < 0 ? '-' : ''}$${Math.round(abs / 1_000)}k`
  return fmtUsd(n)
}

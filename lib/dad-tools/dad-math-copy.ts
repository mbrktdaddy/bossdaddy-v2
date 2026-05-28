// Boss Daddy voice copy for Dad Math results. Same shape + posture as
// lib/dad-tools/milestone-copy.ts — one function per verdict, called from
// the result component once the math has resolved.
//
// Voice rules (from docs/brand-guide.md §1 + lib/claude/client.ts):
//   - Direct. No hype phrases. No corporate-finance speak.
//   - Tough-loving for "behind" — playfully cynical at mediocrity.
//   - Warm + steady for "on track" and "locked in" — no chest-thumping.
//   - Always pair the number with a forward verb or honest read.
//   - "Estimate, not advice." The disclaimer lives in the page footer.

import { fmtUsd, fmtUsdCompact, type DadMathVerdict } from './dad-math'

interface CopyContext {
  verdict:           DadMathVerdict
  projectedValue:    number
  target:            number
  shortfall:         number   // target - FV
  monthlyToCatchUp:  number
  years:             number
  name:              string | null
}

function who(name: string | null): string {
  return name?.trim() ? name : 'your kid'
}

export function dadMathHeadline(ctx: CopyContext): string {
  const subject = who(ctx.name)
  const fv = fmtUsdCompact(ctx.projectedValue)
  const tgt = fmtUsdCompact(ctx.target)
  const need = Math.ceil(ctx.monthlyToCatchUp)
  const gap = Math.max(0, Math.ceil(Math.abs(ctx.shortfall)))

  switch (ctx.verdict) {
    case 'past_18':
      return `${subject} is already past 18. This calculator isn't for them — but their cousin's kid might need it.`

    case 'just_starting':
      return `Nothing saves itself. Plug in what you can contribute monthly. Even $100 changes the math.`

    case 'locked_in':
      return `Locked in. ${subject} lands at ${fv} by 18 — well past your ${tgt} target. Make sure you're not over-funding at today's expense.`

    case 'surplus':
      return `Surplus. ${subject} hits ${fv} by 18, comfortably over the ${tgt} target. Hold the line.`

    case 'on_track':
      return `On track. At your current pace, ${subject} lands right around ${fv} by 18.`

    case 'behind':
      return `Behind. Current pace lands ${subject} at ${fv} — short of ${tgt} by ${fmtUsdCompact(gap)}. Add ${fmtUsd(need)}/mo to catch up.`

    case 'real_gap':
      return `Real gap. Even at your current pace, ${subject} lands at ${fv} — well under ${tgt}. Either bump contributions to ${fmtUsd(need)}/mo or reset the target.`
  }
}

// Short, share-friendly version — the headline minus the numbers.
// Used on the OG image and the share copy.
export function dadMathTagline(ctx: CopyContext): string {
  switch (ctx.verdict) {
    case 'past_18':       return 'Past 18.'
    case 'just_starting': return 'Just getting started.'
    case 'locked_in':     return 'Locked in.'
    case 'surplus':       return 'Surplus.'
    case 'on_track':      return 'On track.'
    case 'behind':        return 'Behind.'
    case 'real_gap':      return 'Real gap.'
  }
}

// Long-form explainer — appears under the headline. Plain, no fluff,
// just shows the dad why the number is what it is.
export function dadMathReasoning(ctx: CopyContext): string {
  if (ctx.verdict === 'past_18' || ctx.verdict === 'just_starting') return ''

  const years = ctx.years
  const fv = fmtUsd(ctx.projectedValue)
  const yrText = years === 1 ? '1 year' : `${years} years`

  if (ctx.verdict === 'locked_in' || ctx.verdict === 'surplus' || ctx.verdict === 'on_track') {
    return `Math says: ${yrText} of growth on what you've got + what you add monthly = ${fv} sitting in the account on their 18th birthday.`
  }

  return `Math says: ${yrText} at your current pace gets you to ${fv}. The gap is real, not theoretical. It compounds against you the longer you wait.`
}

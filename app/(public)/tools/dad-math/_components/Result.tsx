'use client'

import { ResultCard, ResultLinks } from '@/components/dad-tools/CalculatorParts'
import { LABELS } from '@/lib/labels'
import {
  fmtUsd,
  fmtUsdCompact,
  type DadMathResult,
} from '@/lib/dad-tools/dad-math'
import {
  dadMathHeadline,
  dadMathReasoning,
  dadMathTagline,
} from '@/lib/dad-tools/dad-math-copy'
import { toQuery } from '@/lib/dad-tools/url-params'

interface Props {
  /** null until there's a birthdate — the panel still renders (one empty-result rule). */
  result:     DadMathResult | null
  name:       string | null
  targetBy18: number
  // Optional kid context — when present, the "Make this a habit" CTA
  // pre-fills the new Savings goal with this kid attached.
  kidId?:           string | null
  monthlyContrib?:  number     // The user's current monthly input — passed
                               // through so the savings handoff can suggest
                               // their existing pace as the starting amount.
  // Life Insurance inputs carried out on its "figure your college number"
  // link (money-tools-plan handoffs). Empty when arriving any other way.
  lifeInsurance?: Record<string, number>
}

export default function Result({ result, name, targetBy18, kidId, monthlyContrib, lifeInsurance }: Props) {
  if (!result) {
    return (
      <ResultCard
        label={LABELS.tools.dadMath.result.projectedLabel}
        voice="Pick a birthdate and the college math shows up here."
      />
    )
  }
  // Build the Savings handoff URL — pre-fills /tools/savings/new with the
  // pace the user just dialed in here. If they're behind, suggest the
  // catch-up monthly; if on track, just keep their current monthly. The
  // user can edit either on arrival.
  const habitAmount = result.monthlyToCatchUp > 0
    ? Math.ceil(result.monthlyToCatchUp)
    : (monthlyContrib && monthlyContrib > 0 ? Math.round(monthlyContrib) : 0)
  const habitName = name ? `College savings for ${name}` : 'College savings'
  const habitParams = new URLSearchParams({
    cadence: 'monthly',
    name:    habitName,
  })
  if (habitAmount > 0) habitParams.set('amount', String(habitAmount))
  if (kidId)            habitParams.set('kid', kidId)
  const habitHref = `/tools/savings/new?${habitParams.toString()}`
  const ctx = {
    verdict:          result.verdict,
    projectedValue:   result.projectedValue,
    target:           targetBy18,
    shortfall:        result.shortfall,
    monthlyToCatchUp: result.monthlyToCatchUp,
    years:            result.yearsRemaining,
    name,
  }

  const headline  = dadMathHeadline(ctx)
  const reasoning = dadMathReasoning(ctx)
  const tagline   = dadMathTagline(ctx)
  const hasMath   = result.verdict !== 'just_starting' && result.verdict !== 'past_18'

  const surplus = result.shortfall < 0
  // The projected number is the ONE headline; everything else supports it.
  const stats: { label: string; value: string }[] = []

  if (hasMath) {
    stats.push({
      label: LABELS.tools.dadMath.result.targetLabel,
      value: fmtUsdCompact(targetBy18),
    })
    if (surplus) {
      stats.push({
        label: LABELS.tools.dadMath.result.surplusLabel,
        value: fmtUsdCompact(Math.abs(result.shortfall)),
      })
    } else if (result.shortfall > 0) {
      stats.push({
        label: LABELS.tools.dadMath.result.gapLabel,
        value: fmtUsdCompact(result.shortfall),
      })
      stats.push({
        label: LABELS.tools.dadMath.result.catchUpLabel,
        value: `${fmtUsd(Math.ceil(result.monthlyToCatchUp))}${LABELS.tools.dadMath.result.catchUpSuffix}`,
      })
    }
    stats.push({
      label: LABELS.tools.dadMath.result.yearsLabel,
      value: `${result.yearsRemaining}`,
    })
  }

  const links = [
    // Savings handoff — suppressed on past_18 (no future-tense math to start).
    ...(result.verdict !== 'past_18'
      ? [{
          href:  habitHref,
          label: 'Make this a habit',
          note:  `Set up a ${habitAmount > 0 ? `${fmtUsd(habitAmount)}/month` : 'monthly'} savings goal${name ? ` for ${name}` : ''} and tap Yes when you contribute.`,
        }]
      : []),
    // Life Insurance handoff — the college target is the E in DIME. Carries any
    // Life Insurance inputs that came in, so the round-trip keeps them.
    ...(result.verdict !== 'past_18' && targetBy18 > 0
      ? [{
          href:  `/tools/life-insurance${toQuery({ ...lifeInsurance, edu: targetBy18 })}`,
          label: `Use this in ${LABELS.tools.lifeInsurance.full}`,
          note:  `Your ${fmtUsd(targetBy18)} target becomes the education line, so college is still paid for if you aren’t here to pay it.`,
        }]
      : []),
  ]

  return (
    <ResultCard
      label={LABELS.tools.dadMath.result.projectedLabel}
      headline={hasMath ? fmtUsdCompact(result.projectedValue) : undefined}
      subhead={tagline}
      voice={headline}
      stats={stats}
    >
      {/* Reasoning — only when there's math to explain */}
      {reasoning && (
        <p className="text-sm text-prose-muted leading-relaxed border-t border-soft pt-4">
          {reasoning}
        </p>
      )}
      <ResultLinks links={links} />
    </ResultCard>
  )
}

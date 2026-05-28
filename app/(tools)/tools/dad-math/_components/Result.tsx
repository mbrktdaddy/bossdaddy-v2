'use client'

import Link from 'next/link'
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

interface Props {
  result:     DadMathResult
  name:       string | null
  targetBy18: number
  // Optional kid context — when present, the "Make this a habit" CTA
  // pre-fills the new Savings goal with this kid attached.
  kidId?:           string | null
  monthlyContrib?:  number     // The user's current monthly input — passed
                               // through so the savings handoff can suggest
                               // their existing pace as the starting amount.
}

// Verdict → background + border accent. Keeps the visual signal aligned
// with the copy without using rainbow colors (per project rule: no
// per-category color zoo — single accent palette).
function verdictTone(verdict: DadMathResult['verdict']): {
  border: string
  badge:  string
} {
  switch (verdict) {
    case 'locked_in':
    case 'surplus':
    case 'on_track':
      return {
        border: 'border-accent/40',
        badge:  'bg-accent-tint text-accent-text-soft border border-accent-border/60',
      }
    case 'behind':
    case 'real_gap':
      return {
        border: 'border-strong',
        badge:  'bg-surface-raised text-prose-muted border border-strong',
      }
    case 'just_starting':
    case 'past_18':
      return {
        border: 'border-soft',
        badge:  'bg-surface-raised text-prose-faint border border-soft',
      }
  }
}

export default function Result({ result, name, targetBy18, kidId, monthlyContrib }: Props) {
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
  const tone      = verdictTone(result.verdict)

  const surplus = result.shortfall < 0
  const stats: { label: string; value: string; emphasis?: boolean }[] = []

  if (result.verdict !== 'just_starting' && result.verdict !== 'past_18') {
    stats.push({
      label: LABELS.tools.dadMath.result.projectedLabel,
      value: fmtUsdCompact(result.projectedValue),
      emphasis: true,
    })
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

  return (
    <section
      className={`bg-surface rounded-2xl p-6 sm:p-8 space-y-5 border-2 ${tone.border}`}
    >
      {/* Tagline pill — short, share-friendly verdict */}
      <div>
        <span className={`inline-block text-xs uppercase tracking-widest font-semibold px-3 py-1 rounded-full ${tone.badge}`}>
          {tagline}
        </span>
      </div>

      {/* Boss Daddy headline */}
      <p className="text-xl sm:text-2xl font-black text-prose leading-snug">
        {headline}
      </p>

      {/* Stats grid */}
      {stats.length > 0 && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-soft">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-[10px] uppercase tracking-widest font-semibold text-prose-faint">
                {s.label}
              </dt>
              <dd className={`mt-1 font-black tabular-nums ${
                s.emphasis ? 'text-2xl text-accent' : 'text-lg text-prose'
              }`}>
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {/* Reasoning — only shown when there's math to explain */}
      {reasoning && (
        <p className="text-sm text-prose-muted leading-relaxed border-t border-soft pt-4">
          {reasoning}
        </p>
      )}

      {/* Savings handoff — subtle secondary action. Suppress on past_18
          (no future-tense math) since there's nothing to start. */}
      {result.verdict !== 'past_18' && (
        <div className="border-t border-soft pt-4">
          <Link
            href={habitHref}
            className="inline-flex items-center gap-2 text-sm font-semibold text-accent hover:text-accent-hover transition-colors"
          >
            Make this a habit
            <span aria-hidden>→</span>
          </Link>
          <p className="text-xs text-prose-faint mt-1 leading-snug">
            Set up a {habitAmount > 0 ? `${fmtUsd(habitAmount)}/month` : 'monthly'}{' '}
            savings goal{name ? ` for ${name}` : ''} and tap Yes when you contribute.
          </p>
        </div>
      )}
    </section>
  )
}

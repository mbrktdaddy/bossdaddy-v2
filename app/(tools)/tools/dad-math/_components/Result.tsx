'use client'

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

export default function Result({ result, name, targetBy18 }: Props) {
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
    </section>
  )
}

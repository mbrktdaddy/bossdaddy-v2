// Debt Payoff Planner — the Clear step of the money path
// (docs/money-tools-plan.md). Stateless: debts live in repeatable `d` params
// (lib/dad-tools/debt-params.ts), which is also how Loan Math hands a loan in.

import type { Metadata } from 'next'
import { buildSocialMetadata } from '@/lib/og'
import { LABELS } from '@/lib/labels'
import { single, all, parseAmount, type SearchParams } from '@/lib/dad-tools/url-params'
import { decodeDebtParams } from '@/lib/dad-tools/debt-params'
import { CalculatorPage } from '@/components/dad-tools/CalculatorParts'
import DebtPayoffTool from './_components/DebtPayoffTool'

export function generateMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title:       LABELS.tools.debtPayoff.pageTitle,
    description: LABELS.tools.debtPayoff.metaDescription,
    path:        '/tools/debt-payoff',
    siteUrl,
    ogTitle:     LABELS.tools.debtPayoff.full,
    type:        'site',
    ogType:      'website',
  })
}

export default async function DebtPayoffPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const p = await searchParams
  const L = LABELS.tools.debtPayoff
  const s = single(p.s)

  return (
    <CalculatorPage role={L.spokeRole} short={L.short} h1={L.h1} tagline={L.tagline} disclosure={L.disclosure}>
      <DebtPayoffTool
        today={new Date().toISOString().slice(0, 10)}
        initial={{
          debts:    decodeDebtParams(all(p.d)),
          extra:    parseAmount(single(p.extra)),
          strategy: s === 'avalanche' || s === 'snowball' ? s : undefined,
        }}
      />
    </CalculatorPage>
  )
}

// Loan Math — car or personal loan, run before you sign.
//
// Stateless (docs/money-tools-plan.md): no account, no DB. The only state is
// the URL, so a shared link reproduces the exact deal. Thin shell — the math
// is lib/dad-tools/finance.ts.

import type { Metadata } from 'next'
import { buildSocialMetadata } from '@/lib/og'
import { LABELS } from '@/lib/labels'
import { single, parseAmount, type SearchParams } from '@/lib/dad-tools/url-params'
import { CalculatorPage } from '@/components/dad-tools/CalculatorParts'
import LoanMathTool from './_components/LoanMathTool'

export function generateMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title:       LABELS.tools.loanMath.pageTitle,
    description: LABELS.tools.loanMath.metaDescription,
    path:        '/tools/loan-math',
    siteUrl,
    ogTitle:     LABELS.tools.loanMath.full,
    type:        'site',
    ogType:      'website',
  })
}

export default async function LoanMathPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const p = await searchParams
  const L = LABELS.tools.loanMath

  return (
    <CalculatorPage role={L.spokeRole} short={L.short} h1={L.h1} tagline={L.tagline} disclosure={L.disclosure}>
      <LoanMathTool
        today={new Date().toISOString().slice(0, 10)}
        initial={{
          kind:    single(p.kind) === 'personal' ? 'personal' : single(p.kind) === 'car' ? 'car' : undefined,
          amount:  parseAmount(single(p.amt)),
          aprPct:  parseAmount(single(p.apr)),
          term:    parseAmount(single(p.term)),
          down:    parseAmount(single(p.down)),
          tradeIn: parseAmount(single(p.trade)),
          taxPct:  parseAmount(single(p.tax)),
          fees:    parseAmount(single(p.fees)),
        }}
      />
    </CalculatorPage>
  )
}

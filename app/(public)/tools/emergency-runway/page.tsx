// Emergency Runway — step one of the money path (docs/money-tools-plan.md).
// Stateless: no account, no DB, URL state only. Math in lib/dad-tools/finance.ts.

import type { Metadata } from 'next'
import { buildSocialMetadata } from '@/lib/og'
import { LABELS } from '@/lib/labels'
import { single, parseAmount, type SearchParams } from '@/lib/dad-tools/url-params'
import { CalculatorPage } from '@/components/dad-tools/CalculatorParts'
import RunwayTool from './_components/RunwayTool'

export function generateMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title:       LABELS.tools.runway.pageTitle,
    description: LABELS.tools.runway.metaDescription,
    path:        '/tools/emergency-runway',
    siteUrl,
    ogTitle:     LABELS.tools.runway.full,
    type:        'site',
    ogType:      'website',
  })
}

export default async function RunwayPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const p = await searchParams
  const L = LABELS.tools.runway

  return (
    <CalculatorPage role={L.spokeRole} short={L.short} h1={L.h1} tagline={L.tagline} disclosure={L.disclosure}>
      <RunwayTool
        initial={{
          cash:     parseAmount(single(p.cash)),
          expenses: parseAmount(single(p.exp)),
        }}
      />
    </CalculatorPage>
  )
}

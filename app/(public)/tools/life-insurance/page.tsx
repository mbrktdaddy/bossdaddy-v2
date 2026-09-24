// Life Insurance Needs — the Protect step of the money path
// (docs/money-tools-plan.md). DIME method, stateless, URL state only.
//
// EDGE OFF (brand-guide §1.6): this is the one tool about a dad not being
// there. Steady and warm, no jokes. Educational only — never a product or
// carrier recommendation; the voice points to an independent agent.
//
// Receives handoffs from the other three tools:
//   exp  — Runway's monthly essentials (→ yearly income to replace, ×12)
//   debt — Debt Payoff's total
//   edu  — Dad Math's college target

import type { Metadata } from 'next'
import { buildSocialMetadata } from '@/lib/og'
import { LABELS } from '@/lib/labels'
import { single, parseAmount, type SearchParams } from '@/lib/dad-tools/url-params'
import { CalculatorPage } from '@/components/dad-tools/CalculatorParts'
import LifeInsuranceTool from './_components/LifeInsuranceTool'

export function generateMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title:       LABELS.tools.lifeInsurance.pageTitle,
    description: LABELS.tools.lifeInsurance.metaDescription,
    path:        '/tools/life-insurance',
    siteUrl,
    ogTitle:     LABELS.tools.lifeInsurance.full,
    type:        'site',
    ogType:      'website',
  })
}

export default async function LifeInsurancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const p = await searchParams
  const L = LABELS.tools.lifeInsurance
  const exp = parseAmount(single(p.exp))

  return (
    <CalculatorPage role={L.spokeRole} short={L.short} h1={L.h1} tagline={L.tagline} disclosure={L.disclosure}>
      <LifeInsuranceTool
        initial={{
          debt:      parseAmount(single(p.debt)),
          income:    parseAmount(single(p.inc)),
          fromExpenses: exp,
          years:     parseAmount(single(p.yrs)),
          mortgage:  parseAmount(single(p.mort)),
          education: parseAmount(single(p.edu)),
          coverage:  parseAmount(single(p.cov)),
          savings:   parseAmount(single(p.sav)),
        }}
      />
    </CalculatorPage>
  )
}

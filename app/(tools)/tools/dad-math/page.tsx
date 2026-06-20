// Dad Math v0 — the honest college math.
//
// Server Component shell: pulls auth + kids server-side so the client tool
// gets a clean snapshot. Mirrors the architecture of /tools/weekends-until
// so the patterns stay consistent across the tools route group.
//
// v0 scope per docs/dad-tools-plan.md (Appendix A1, Provider OS — "The
// Honest Calculator" stripped to one screen): single calc, kid-driven,
// Boss Daddy headline. No Plaid. No scenarios. No AI. No spouse send.

import type { Metadata } from 'next'
import { OG_SITE } from '@/lib/og'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getKids } from '@/lib/dad-tools/kid-actions'
import { LABELS } from '@/lib/labels'
import DadMathTool from './_components/DadMathTool'

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function single(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

function parseNum(v: string | undefined): number | undefined {
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) ? n : undefined
}

function parseKid(v: string | undefined): string | undefined {
  return v && UUID_RE.test(v) ? v : undefined
}

export const metadata: Metadata = {
  title:       `${LABELS.tools.dadMath.pageTitle} (Beta)`,
  description: LABELS.tools.dadMath.metaDescription,
  alternates:  { canonical: '/tools/dad-math' },
  openGraph: {
    ...OG_SITE,
    title:       LABELS.tools.dadMath.pageTitle,
    description: LABELS.tools.dadMath.metaDescription,
  },
}

export default async function DadMathPage({ searchParams }: PageProps) {
  const params = await searchParams

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  const kids = await getKids()

  const initialFromUrl = {
    birthdate:      single(params.birthdate),
    name:           single(params.for) || single(params.name),
    currentBalance: parseNum(single(params.bal)),
    monthlyContrib: parseNum(single(params.pmt)),
    targetBy18:     parseNum(single(params.tgt)),
    annualReturn:   parseNum(single(params.r)),
  }
  const initialKidId = parseKid(single(params.kid))

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">

      <header className="space-y-3">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-medium">
          {LABELS.tools.dadMath.spokeRole} · {LABELS.tools.dadMath.short}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          {LABELS.tools.dadMath.h1}
        </h1>
        <p className="text-prose-faint text-base sm:text-lg leading-snug">
          {LABELS.tools.dadMath.tagline}
        </p>
      </header>

      <DadMathTool
        isAuthenticated={!!user}
        initialKids={kids}
        initialKidId={initialKidId}
        initialFromUrl={initialFromUrl.birthdate ? initialFromUrl : undefined}
      />

      <footer className="pt-6 mt-2 border-t border-soft">
        <p className="text-xs text-prose-faint leading-relaxed">
          {LABELS.tools.dadMath.disclosure}
        </p>
      </footer>
    </div>
  )
}

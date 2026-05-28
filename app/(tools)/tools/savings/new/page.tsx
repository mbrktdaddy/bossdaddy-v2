// Create flow. Server Component shell pulls auth + kids; the GoalForm
// client component owns the interactive surface. Reads searchParams for
// the Dad Math handoff prefill (phase 4 wiring): ?amount, ?cadence, ?kid, ?name.

import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getKids } from '@/lib/dad-tools/kid-actions'
import { LABELS } from '@/lib/labels'
import type { GoalFormInitial } from '../_components/GoalForm'
import GoalForm from '../_components/GoalForm'
import type { SavingsCadence } from '@/lib/dad-tools/savings'

export const metadata: Metadata = {
  title: `New ${LABELS.tools.savings.short} — Boss Daddy`,
  alternates: { canonical: '/tools/savings/new' },
  robots: { index: false },
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_CADENCES = new Set(['daily', 'weekly', 'monthly'])

function single(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

function parseNum(v: string | undefined): number | undefined {
  if (v === undefined) return undefined
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

export default async function NewSavingsGoalPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect('/login?next=/tools/savings/new')

  const params = await searchParams
  const amount = parseNum(single(params.amount))
  const cadenceParam = single(params.cadence)
  const cadence: SavingsCadence | null =
    cadenceParam && ALLOWED_CADENCES.has(cadenceParam) ? (cadenceParam as SavingsCadence) : null
  const kid = single(params.kid)
  const name = single(params.name)?.slice(0, 120)

  const kids = await getKids()
  const initial: GoalFormInitial = {
    name: name ?? '',
    amount_per_cadence: amount ?? null,
    cadence: cadence,
    kid_profile_id: kid && UUID_RE.test(kid) ? kid : null,
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <header className="space-y-2">
        <Link
          href="/tools/savings"
          className="text-sm text-prose-faint hover:text-prose-muted transition-colors"
        >
          ← Back to goals
        </Link>
        <h1 className="text-3xl sm:text-4xl font-black text-prose leading-[1.05] tracking-tight">
          {LABELS.tools.savings.newCta}
        </h1>
        <p className="text-prose-faint text-sm sm:text-base leading-snug">
          Tiny commitment. Real ritual. The math takes care of itself.
        </p>
      </header>

      <GoalForm mode="create" initial={initial} kids={kids} />
    </div>
  )
}

import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getKids } from '@/lib/dad-tools/kid-actions'
import { LABELS } from '@/lib/labels'
import {
  milestoneDate,
  unitsRemaining,
  type Milestone,
  type Unit,
} from '@/lib/dad-tools/calc'
import WeekendsTool from './_components/WeekendsTool'

const MILESTONE_KEYS: Milestone[] = [
  'until_18', 'next_birthday', 'starts_school', 'gets_license', 'summer', 'custom',
]
const UNIT_KEYS: Unit[] = ['weekends', 'bedtimes']

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function single(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseParams(params: Record<string, string | string[] | undefined>) {
  const birthdate   = single(params.birthdate)
  const milestoneIn = single(params.milestone)
  const unitIn      = single(params.unit)
  const name        = single(params.for) || single(params.name)
  const customDate  = single(params.cd)
  const customLabel = single(params.cl)
  const kidIn       = single(params.kid)
  const kid         = kidIn && UUID_RE.test(kidIn) ? kidIn : undefined

  const milestone: Milestone | undefined =
    milestoneIn && (MILESTONE_KEYS as string[]).includes(milestoneIn)
      ? (milestoneIn as Milestone)
      : undefined
  const unit: Unit | undefined =
    unitIn && (UNIT_KEYS as string[]).includes(unitIn)
      ? (unitIn as Unit)
      : undefined

  return { birthdate, milestone, unit, name, customDate, customLabel, kid }
}

export async function generateMetadata(
  { searchParams }: PageProps,
): Promise<Metadata> {
  const params = await searchParams
  const parsed = parseParams(params)

  const title       = `${LABELS.tools.weekendsUntil.pageTitle} (Beta)`
  const description = LABELS.tools.weekendsUntil.metaDescription

  // If we have enough state to compute N, build a dynamic OG image URL.
  let ogImageUrl = '/api/og/weekends'
  if (
    parsed.birthdate &&
    /^\d{4}-\d{2}-\d{2}$/.test(parsed.birthdate) &&
    parsed.milestone &&
    parsed.unit
  ) {
    const target = milestoneDate(
      parsed.milestone,
      parsed.birthdate,
      parsed.customDate ?? null,
    )
    if (target) {
      const N = unitsRemaining(parsed.unit, target)
      const ogParams = new URLSearchParams({
        n:    String(N),
        unit: parsed.unit,
      })
      // First-initial only, never the full name.
      const initial = (parsed.name ?? '').trim().charAt(0).toUpperCase()
      if (initial) ogParams.set('for', initial)
      ogImageUrl = `/api/og/weekends?${ogParams.toString()}`
    }
  }

  return {
    title,
    description,
    openGraph: {
      title:       LABELS.tools.weekendsUntil.pageTitle,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title:       LABELS.tools.weekendsUntil.pageTitle,
      description,
      images: [ogImageUrl],
    },
  }
}

export default async function WeekendsUntilPage({ searchParams }: PageProps) {
  const params = await searchParams
  const parsed = parseParams(params)

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  const kids = await getKids()

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">

      <header className="space-y-3">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-medium">
          {LABELS.tools.weekendsUntil.short}
        </p>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
          How many weekends do you have left?
        </h1>
        <p className="text-prose-faint text-base sm:text-lg leading-snug">
          Pick a milestone. Get a number. Then make them count.
        </p>
      </header>

      <WeekendsTool
        isAuthenticated={!!user}
        initialKids={kids}
        initialKidId={parsed.kid}
        initialFromUrl={
          parsed.birthdate
            ? {
                birthdate:   parsed.birthdate,
                milestone:   parsed.milestone,
                unit:        parsed.unit,
                name:        parsed.name,
                customDate:  parsed.customDate,
                customLabel: parsed.customLabel,
              }
            : undefined
        }
      />

    </div>
  )
}

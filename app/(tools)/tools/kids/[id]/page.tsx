// Kid-centric profile page — the real hub of the tools surface.
//
// Per the hub-and-spoke pivot: the kid is the hub, tools are spokes. This
// page aggregates every tool's state for one kid + the Log + edit/delete
// actions, so the dad can see "where am I with [name]" in one place.
//
// Anonymous visitors don't have kids — they get redirected to /login.
// RLS on kid_profiles + kid_moments enforces per-user access; an invalid
// or other-user kid id falls through to notFound().

import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import {
  ageInYearsMonths,
  milestoneDate,
  weeksUntil,
  percentElapsed,
  momentDayKey,
  daysSinceDayKey,
} from '@/lib/dad-tools/calc'
import { runDadMath, fmtUsdCompact } from '@/lib/dad-tools/dad-math'
import { dadMathTagline } from '@/lib/dad-tools/dad-math-copy'
import type { Kid } from '@/lib/dad-tools/kid-actions'
import type { KidMoment } from '@/lib/dad-tools/moment-actions'
import { LABELS, logTitle } from '@/lib/labels'
import KidHeaderActions from '@/components/dad-tools/KidHeaderActions'
import InlineCapture from '@/components/dad-tools/InlineCapture'
import MomentsFeed from '@/components/dad-tools/MomentsFeed'
import WeeklyCheckinOptIn from '@/components/dad-tools/WeeklyCheckinOptIn'

interface PageProps {
  params: Promise<{ id: string }>
}

const KID_COLUMNS    = 'id, name, birthdate, photo_url, money_balance, money_monthly, money_target, money_return_rate, created_at, updated_at'
const MOMENT_COLUMNS = 'id, kid_profile_id, moment_kind, occurred_on, response, photo_url, created_at, updated_at'

export const metadata: Metadata = {
  title:  'Your kid — Boss Daddy',
  robots: { index: false, follow: false },
}

function buildShareUrl(base: string, params: Record<string, string | undefined>) {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, v)
  }
  const qs = q.toString()
  return qs ? `${base}?${qs}` : base
}

export default async function KidProfilePage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect(`/login?next=/tools/kids/${id}`)

  // RLS will already scope to the owning user, but eq(user_id) is explicit
  // and defends against any future RLS regression.
  const { data: kid } = await supabase.from('kid_profiles')
    .select(KID_COLUMNS)
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!kid) notFound()
  const kidRow = kid as Kid

  const { data: rawMoments } = await supabase.from('kid_moments')
    .select(MOMENT_COLUMNS)
    .eq('kid_profile_id', kidRow.id)
    .order('occurred_on', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  const moments: KidMoment[] = (rawMoments ?? []) as KidMoment[]
  const momentCount = moments.length
  // Most-recent calendar day across all moments. Prefer occurred_on (what
  // the dad said happened) over created_at (when he logged it) so backfilled
  // moments don't read as "captured today."
  let lastKey: string | null = null
  for (const m of moments) {
    const key = momentDayKey(m.occurred_on, m.created_at)
    if (!lastKey || key > lastKey) lastKey = key
  }
  const daysSinceLast = lastKey ? daysSinceDayKey(lastKey) : null

  const { years, months } = ageInYearsMonths(kidRow.birthdate)
  const until18 = milestoneDate('until_18', kidRow.birthdate)
  const weekendsUntil18 = until18 ? weeksUntil(until18) : 0
  const pctBurned = until18 ? percentElapsed(kidRow.birthdate, until18) : 100
  const past18 = weekendsUntil18 === 0

  // Run Dad Math using the kid's persisted state (migration 077). Defaults
  // baked into the DB: $0 balance, $0 monthly, $94k target, 6% return — so
  // a brand-new kid reads "Just getting started" until the dad opens the
  // tool and saves real numbers.
  const dadMath = runDadMath({
    birthdate:      kidRow.birthdate,
    currentBalance: kidRow.money_balance,
    monthlyContrib: kidRow.money_monthly,
    targetBy18:     kidRow.money_target,
    annualReturn:   kidRow.money_return_rate,
  })

  const displayName = kidRow.name?.trim() || 'Your kid'
  const ageLabel = years === 0
    ? `${months} ${months === 1 ? 'month' : 'months'} old`
    : months === 0
      ? `${years} ${years === 1 ? 'year' : 'years'} old`
      : `${years}y ${months}m`

  const firstInitial = (kidRow.name?.trim()?.[0] ?? '').toUpperCase()

  const weekendsHref = buildShareUrl('/tools/weekends-until', {
    kid:       kidRow.id,
    birthdate: kidRow.birthdate,
    milestone: 'until_18',
    unit:      'weekends',
    for:       firstInitial || undefined,
  })

  const dadMathHref = buildShareUrl('/tools/dad-math', {
    kid:       kidRow.id,
    birthdate: kidRow.birthdate,
    for:       firstInitial || undefined,
  })

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-7">

      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="text-xs text-prose-faint">
        <Link href="/tools" className="hover:text-prose transition-colors">
          ← All tools
        </Link>
      </nav>

      {/* Kid header */}
      <header className="flex items-start gap-4 sm:gap-5">
        {kidRow.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={kidRow.photo_url}
            alt=""
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-full object-cover bg-surface-sunken shrink-0"
          />
        ) : (
          <div
            className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-accent/15 text-accent flex items-center justify-center text-2xl sm:text-3xl font-black shrink-0"
            aria-hidden="true"
          >
            {(kidRow.name?.trim()?.[0] ?? '?').toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {LABELS.tools.kids.section}
          </p>
          <h1 className="text-2xl sm:text-3xl font-black text-prose leading-tight tracking-tight mt-1">
            {displayName}
          </h1>
          <p className="text-sm text-prose-faint mt-0.5">{ageLabel}</p>
        </div>
        <KidHeaderActions kid={kidRow} />
      </header>

      {/* Time card */}
      <section className="bg-surface border border-soft rounded-2xl p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {LABELS.tools.weekendsUntil.spokeRole}
          </p>
          {!past18 && (
            <Link
              href={weekendsHref}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Open Weekends Until →
            </Link>
          )}
        </div>
        {past18 ? (
          <p className="mt-3 text-2xl font-black text-prose-muted leading-tight">
            {displayName} is past 18.
          </p>
        ) : (
          <>
            <p className="mt-3 text-4xl sm:text-5xl font-black text-prose leading-none">
              {weekendsUntil18}
            </p>
            <p className="text-sm text-prose-muted mt-1.5">
              weekends until 18 · {pctBurned}% elapsed
            </p>
          </>
        )}
      </section>

      {/* Money card — suppress entirely for past-18 kids. Otherwise render
          the verdict using the kid's persisted Dad Math inputs (migration
          077). A brand-new kid with default 0/0/$94k/6% reads as "Just
          getting started" until the dad saves real numbers. */}
      {!past18 && (
        <section className="bg-surface border border-soft rounded-2xl p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
              {LABELS.tools.dadMath.spokeRole}
            </p>
            <Link
              href={dadMathHref}
              className="text-xs font-semibold text-accent hover:underline"
            >
              Open Dad Math →
            </Link>
          </div>
          <p className="mt-3 text-xl sm:text-2xl font-black text-prose leading-snug">
            {dadMathTagline({
              verdict:          dadMath.verdict,
              projectedValue:   dadMath.projectedValue,
              target:           kidRow.money_target,
              shortfall:        dadMath.shortfall,
              monthlyToCatchUp: dadMath.monthlyToCatchUp,
              years:            dadMath.yearsRemaining,
              name:             kidRow.name,
            })}
          </p>
          {dadMath.verdict === 'just_starting' ? (
            <p className="text-sm text-prose-muted mt-2 leading-relaxed">
              Open Dad Math to plug in your real numbers and get the honest read.
              Target on file: {fmtUsdCompact(kidRow.money_target)} by 18.
            </p>
          ) : (
            <dl className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <dt className="text-[10px] uppercase tracking-widest font-semibold text-prose-faint">
                  Projected
                </dt>
                <dd className="mt-0.5 font-black text-prose tabular-nums">
                  {fmtUsdCompact(dadMath.projectedValue)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest font-semibold text-prose-faint">
                  Target
                </dt>
                <dd className="mt-0.5 font-black text-prose tabular-nums">
                  {fmtUsdCompact(kidRow.money_target)}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-widest font-semibold text-prose-faint">
                  {dadMath.shortfall < 0 ? 'Surplus' : 'Gap'}
                </dt>
                <dd className="mt-0.5 font-black text-prose tabular-nums">
                  {fmtUsdCompact(Math.abs(dadMath.shortfall))}
                </dd>
              </div>
            </dl>
          )}
        </section>
      )}

      {/* Presence card */}
      <section className="bg-surface border border-soft rounded-2xl p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {LABELS.tools.presence.spokeRole}
          </p>
          <span className="text-xs text-prose-faint">
            {momentCount === 0
              ? 'No moments yet'
              : `${momentCount} ${momentCount === 1 ? 'moment' : 'moments'} captured`}
          </span>
        </div>
        <p className="mt-3 text-xl sm:text-2xl font-black text-prose leading-snug">
          {daysSinceLast === null
            ? `Start ${logTitle(kidRow.name)}.`
            : daysSinceLast === 0
              ? 'Moment captured today.'
              : `${daysSinceLast} ${daysSinceLast === 1 ? 'day' : 'days'} since your last moment.`}
        </p>
        <p className="text-sm text-prose-muted mt-2 mb-4 leading-relaxed">
          {LABELS.tools.presence.spokeBlurb}
        </p>
        <InlineCapture
          kidProfileId={kidRow.id}
          kidName={kidRow.name}
          ctaLabel={LABELS.tools.log.captureCta}
        />

        <div className="mt-4 pt-4 border-t border-soft">
          <WeeklyCheckinOptIn
            kidProfileId={kidRow.id}
            defaultEmail={user.email ?? undefined}
          />
        </div>
      </section>

      {/* The Log */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base sm:text-lg font-black text-prose">
            {logTitle(kidRow.name)}
          </h2>
          {momentCount > 0 && (
            <p className="text-xs text-prose-faint">
              {momentCount} {momentCount === 1 ? 'moment' : 'moments'}
            </p>
          )}
        </div>
        <MomentsFeed moments={moments} />
      </section>
    </div>
  )
}

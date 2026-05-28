// Tools hub — the front door for /tools/*. Two reads:
//   - Anonymous / no kids: voice intro + tool cards.
//   - Logged-in with kids: personalized state per kid (weekends remaining,
//     days since last moment) + tool cards underneath.
//
// The conceptual hub is kid_profiles, not this page. This page is the
// place to act on the state.
//
// Per docs/dad-tools-plan.md: three spokes (Time / Money / Presence) +
// the Log keepsake substrate. Dad Math + Presence are "Coming soon"
// until each is built out as its own /tools/* route.

import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { weeksUntil, milestoneDate } from '@/lib/dad-tools/calc'
import type { Kid } from '@/lib/dad-tools/kid-actions'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: LABELS.tools.hub.pageTitle,
  description: LABELS.tools.hub.metaDescription,
  alternates: { canonical: '/tools' },
}

type SpokeCard = {
  role:   string
  title:  string
  blurb:  string
  href:   string | null  // null = coming soon
  badge?: string
}

// Main spokes — the three concepts the tools area is built around. Order
// matters: Time anchors the gut-punch, Savings is the daily ritual, Presence
// closes the loop with the moment counter.
const MAIN_SPOKES: SpokeCard[] = [
  {
    role:  LABELS.tools.weekendsUntil.spokeRole,
    title: LABELS.tools.weekendsUntil.full,
    blurb: LABELS.tools.weekendsUntil.spokeBlurb,
    href:  '/tools/weekends-until',
  },
  {
    role:  LABELS.tools.savings.spokeRole,
    title: LABELS.tools.savings.full,
    blurb: LABELS.tools.savings.spokeBlurb,
    href:  '/tools/savings',
  },
  {
    role:  LABELS.tools.presence.spokeRole,
    title: LABELS.tools.presence.full,
    blurb: 'Not a separate calculator — it lives on each kid’s page. Days since your last moment. Quiet, no shame, just visible.',
    href:  null,
  },
]

// Strategic reference tools — sit below the main spokes. Useful but not a
// daily-loop anchor. Dad Math is a stateless college-projection calculator
// you reach for during planning, not part of the weekly rhythm.
const REFERENCE_TOOLS: SpokeCard[] = [
  {
    role:  LABELS.tools.dadMath.spokeRole,
    title: LABELS.tools.dadMath.full,
    blurb: LABELS.tools.dadMath.spokeBlurb,
    href:  '/tools/dad-math',
  },
]

export default async function ToolsHubPage() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  // Per role-architecture: members → /account/settings, authors/admins → /dashboard/profile.
  // Hub's "Manage kids" link routes the user to wherever their MyKidsSection lives.
  let manageKidsHref = '/account/settings'
  let kids: Kid[] = []

  if (user) {
    const [{ data: profile }, { data: rawKids }] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('kid_profiles')
        .select('id, name, birthdate, photo_url, money_balance, money_monthly, money_target, money_return_rate, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true }),
    ])

    if (profile?.role === 'author' || profile?.role === 'admin') {
      manageKidsHref = '/dashboard/profile'
    }

    kids = (rawKids ?? []) as Kid[]
  }

  const isLoggedInWithKids = !!user && kids.length > 0

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="mb-10 sm:mb-14">
        <p className="text-xs uppercase tracking-widest font-semibold text-eyebrow mb-3">
          {isLoggedInWithKids ? LABELS.tools.hub.loggedInGreeting : LABELS.tools.hub.eyebrow}
        </p>
        {isLoggedInWithKids ? (
          <>
            <h1 className="text-3xl sm:text-5xl font-black text-prose leading-[1.05] tracking-tight mb-3">
              {LABELS.tools.hub.loggedInBody}
            </h1>
          </>
        ) : (
          <>
            <h1 className="text-3xl sm:text-5xl font-black text-prose leading-[1.05] tracking-tight">
              {LABELS.tools.hub.heroTitle}
            </h1>
            <h2 className="text-3xl sm:text-5xl font-black text-accent leading-[1.05] tracking-tight mb-5">
              {LABELS.tools.hub.heroTitleSecond}
            </h2>
            <p className="text-base sm:text-lg text-prose-muted leading-[1.7] max-w-2xl">
              {LABELS.tools.hub.heroBody}
            </p>
          </>
        )}
      </section>

      {/* ── PERSONALIZED STATE — only when logged in with kids ──────────── */}
      {/* Compact-row pattern matches /account/settings + /dashboard/profile.
          The headline number (weekends-until) is the entire reason this
          page exists — preserve it as the right-aligned stat. Tap → kid
          hub where % elapsed, last moment, savings, and Dad Math live. */}
      {isLoggedInWithKids && (
        <section className="mb-10 sm:mb-14">
          <div className="space-y-1.5">
            {kids.map((kid) => {
              const target = milestoneDate('until_18', kid.birthdate)
              const weekends = target ? weeksUntil(target) : 0
              const past18 = weekends === 0
              const name = kid.name?.trim() || LABELS.tools.kids.noNameFallback
              const initial = (kid.name?.trim()?.[0] ?? '?').toUpperCase()

              return (
                <Link
                  key={kid.id}
                  href={`/tools/kids/${kid.id}`}
                  className="flex items-center gap-3 px-3 py-3 bg-surface border border-soft hover:border-accent-border/60 rounded-xl transition-colors group min-h-[44px]"
                >
                  {kid.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={kid.photo_url}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover bg-surface-sunken shrink-0"
                    />
                  ) : (
                    <div
                      className="h-10 w-10 rounded-full bg-accent/15 text-accent flex items-center justify-center text-base font-black shrink-0"
                      aria-hidden="true"
                    >
                      {initial}
                    </div>
                  )}
                  <p className="text-sm sm:text-base font-semibold text-prose group-hover:text-accent-text-soft transition-colors truncate min-w-0 flex-1">
                    {name}
                  </p>
                  <div className="text-right shrink-0">
                    {past18 ? (
                      <p className="text-sm font-semibold text-prose-muted">Past 18</p>
                    ) : (
                      <>
                        <p className="text-base sm:text-lg font-black text-prose tabular-nums group-hover:text-accent transition-colors">
                          {weekends}
                        </p>
                        <p className="text-[10px] sm:text-xs text-prose-faint leading-tight">
                          weekends until 18
                        </p>
                      </>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              )
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <Link
              href={manageKidsHref}
              className="text-sm font-semibold text-accent hover:underline"
            >
              {LABELS.tools.hub.manageKidsCta}
            </Link>
          </div>
        </section>
      )}

      {/* ── NO KIDS YET — short prompt to add one ───────────────────────── */}
      {user && kids.length === 0 && (
        <section className="mb-10 sm:mb-14 bg-surface-raised border border-soft rounded-2xl p-6 sm:p-8">
          <p className="text-xs uppercase tracking-widest font-semibold text-eyebrow mb-3">
            Get started
          </p>
          <p className="text-lg sm:text-xl font-black text-prose leading-snug mb-2">
            Add a kid to unlock personalized numbers.
          </p>
          <p className="text-sm text-prose-muted mb-5 max-w-xl">
            Tools work without an account — but adding a kid lets you save
            moments, get yearly check-ins, and watch the number compound.
          </p>
          <Link
            href={manageKidsHref}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
          >
            {LABELS.tools.hub.addFirstKidCta}
          </Link>
        </section>
      )}

      {/* ── MAIN SPOKES — the three core tools ───────────────────────────── */}
      <section className="mb-10 sm:mb-14">
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl sm:text-2xl font-black text-prose tracking-tight">
            The tools
          </h2>
          <p className="text-xs text-prose-faint uppercase tracking-widest">
            Hub &amp; spoke
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MAIN_SPOKES.map((spoke) => renderSpoke(spoke, 'main'))}
        </div>
      </section>

      {/* ── REFERENCE CALCULATORS — strategic, not part of the daily loop ── */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-base sm:text-lg font-black text-prose tracking-tight">
            Reference calculators
          </h2>
          <p className="text-xs text-prose-faint uppercase tracking-widest">
            Planning
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REFERENCE_TOOLS.map((spoke) => renderSpoke(spoke, 'reference'))}
        </div>
      </section>
    </div>
  )
}

// Renders a spoke card in two visual weights:
//   main      — full-sized headline title, same accent treatment as before
//   reference — slightly smaller title + muted background so the section
//               reads as secondary to the main spokes above
function renderSpoke(spoke: SpokeCard, weight: 'main' | 'reference') {
  const isReference = weight === 'reference'
  const titleSize = isReference
    ? 'text-lg sm:text-xl'
    : 'text-xl sm:text-2xl'
  const cardBase = isReference
    ? 'bg-surface-sunken border border-soft hover:border-accent-border/60'
    : 'bg-surface border border-soft hover:border-accent'

  const inner = (
    <>
      <div className="flex items-baseline justify-between gap-2 mb-2">
        <p className="text-xs uppercase tracking-widest font-semibold text-eyebrow">
          {spoke.role}
        </p>
        {spoke.badge && (
          <span className="text-[10px] uppercase tracking-widest font-semibold text-accent-text border border-accent/30 rounded-full px-2 py-0.5">
            {spoke.badge}
          </span>
        )}
      </div>
      <p className={`${titleSize} font-black text-prose group-hover:text-accent transition-colors leading-tight mb-2`}>
        {spoke.title}
      </p>
      <p className="text-sm text-prose-muted leading-relaxed">
        {spoke.blurb}
      </p>
      {spoke.href && (
        <p className="mt-4 text-xs font-semibold text-accent uppercase tracking-widest inline-flex items-center gap-1">
          Open <span aria-hidden>→</span>
        </p>
      )}
    </>
  )

  if (spoke.href) {
    return (
      <Link
        key={spoke.title}
        href={spoke.href}
        className={`block ${cardBase} rounded-2xl p-6 transition-colors group`}
      >
        {inner}
      </Link>
    )
  }
  const dimmed = !!spoke.badge
  return (
    <div
      key={spoke.title}
      className={`block bg-surface-raised border border-soft rounded-2xl p-6 ${
        dimmed ? 'opacity-70 cursor-not-allowed' : ''
      }`}
    >
      {inner}
    </div>
  )
}

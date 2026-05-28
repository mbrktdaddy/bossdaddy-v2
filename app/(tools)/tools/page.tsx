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
import {
  weeksUntil,
  milestoneDate,
  percentElapsed,
  momentDayKey,
  daysSinceDayKey,
} from '@/lib/dad-tools/calc'
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

const SPOKES: SpokeCard[] = [
  {
    role:  LABELS.tools.weekendsUntil.spokeRole,
    title: LABELS.tools.weekendsUntil.full,
    blurb: LABELS.tools.weekendsUntil.spokeBlurb,
    href:  '/tools/weekends-until',
  },
  {
    role:  LABELS.tools.dadMath.spokeRole,
    title: LABELS.tools.dadMath.full,
    blurb: LABELS.tools.dadMath.spokeBlurb,
    href:  '/tools/dad-math',
  },
  {
    role:  LABELS.tools.presence.spokeRole,
    title: LABELS.tools.presence.full,
    blurb: 'Not a separate calculator — it lives on each kid’s page. Days since your last moment. Quiet, no shame, just visible.',
    href:  null,
  },
]

export default async function ToolsHubPage() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  // Per role-architecture: members → /account/settings, authors/admins → /dashboard/profile.
  // Hub's "Manage kids" link routes the user to wherever their MyKidsSection lives.
  let manageKidsHref = '/account/settings'
  let kids: Kid[] = []
  // "Last moment" per kid = the most recent calendar day among that kid's
  // moments, preferring occurred_on (the dad's stated date) and falling back
  // to created_at. Stored as a YYYY-MM-DD key so daysSinceDayKey can use
  // calendar-day semantics.
  const lastMomentKeyByKid = new Map<string, string>()

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

    if (kids.length > 0) {
      const { data: moments } = await supabase.from('kid_moments')
        .select('kid_profile_id, occurred_on, created_at')
        .in('kid_profile_id', kids.map((k) => k.id))

      for (const m of (moments ?? []) as {
        kid_profile_id: string
        occurred_on:    string | null
        created_at:     string
      }[]) {
        const key = momentDayKey(m.occurred_on, m.created_at)
        const current = lastMomentKeyByKid.get(m.kid_profile_id)
        if (!current || key > current) {
          lastMomentKeyByKid.set(m.kid_profile_id, key)
        }
      }
    }
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
      {isLoggedInWithKids && (
        <section className="mb-10 sm:mb-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {kids.map((kid) => {
              const target = milestoneDate('until_18', kid.birthdate)
              const weekends = target ? weeksUntil(target) : 0
              const pctBurned = target ? percentElapsed(kid.birthdate, target) : 100
              const lastKey = lastMomentKeyByKid.get(kid.id)
              const daysSinceLast = lastKey ? daysSinceDayKey(lastKey) : null
              const name = kid.name?.trim() || LABELS.tools.kids.noNameFallback

              return (
                <Link
                  key={kid.id}
                  href={`/tools/kids/${kid.id}`}
                  className="block bg-surface border border-soft hover:border-accent rounded-2xl p-5 transition-colors group"
                >
                  <p className="text-xs uppercase tracking-widest font-semibold text-eyebrow">
                    {name}
                  </p>
                  <p className="mt-3 text-4xl font-black text-prose leading-none group-hover:text-accent transition-colors">
                    {weekends}
                  </p>
                  <p className="text-sm text-prose-muted mt-1.5">
                    weekends until 18
                  </p>
                  <div className="mt-4 pt-4 border-t border-soft flex items-baseline justify-between gap-2 text-xs text-prose-faint">
                    <span>{pctBurned}% elapsed</span>
                    {daysSinceLast === null ? (
                      <span>No moments yet</span>
                    ) : daysSinceLast === 0 ? (
                      <span className="text-accent font-semibold">Moment today</span>
                    ) : (
                      <span>{daysSinceLast}d since last moment</span>
                    )}
                  </div>
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

      {/* ── SPOKES — the three tools ─────────────────────────────────────── */}
      <section>
        <div className="flex items-baseline justify-between mb-5">
          <h2 className="text-xl sm:text-2xl font-black text-prose tracking-tight">
            The tools
          </h2>
          <p className="text-xs text-prose-faint uppercase tracking-widest">
            Hub &amp; spoke
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SPOKES.map((spoke) => {
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
                <p className="text-xl sm:text-2xl font-black text-prose group-hover:text-accent transition-colors leading-tight mb-2">
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

            // Link card if there's a destination; otherwise an informational
            // card. Coming-soon cards (have a badge) get dimmed; descriptive
            // cards (no badge, no link) read as normal informational content.
            if (spoke.href) {
              return (
                <Link
                  key={spoke.title}
                  href={spoke.href}
                  className="block bg-surface border border-soft hover:border-accent rounded-2xl p-6 transition-colors group"
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
          })}
        </div>
      </section>
    </div>
  )
}

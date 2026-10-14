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
import InstallPWA from '@/components/InstallPWA'
import { LABELS } from '@/lib/labels'
import { buildSocialMetadata } from '@/lib/og'
import { KID_COLUMNS, familyPhotoSrc } from '@/lib/dad-tools/family-photo'
import { weeksUntil, milestoneDate, momentDayKey, daysSinceDayKey } from '@/lib/dad-tools/calc'
import { getGoals } from '@/lib/dad-tools/savings-actions'
import { fmtUsdWhole } from '@/lib/dad-tools/savings'
import type { Kid } from '@/lib/dad-tools/kid-actions'
import type { Metadata } from 'next'
import TodayCard from '@/components/goals/TodayCard'
import WorkingOnSection from '@/components/goals/WorkingOnSection'
import YourCornerSection from '@/components/account/YourCornerSection'
import ToolTiles from '@/components/dad-tools/ToolTiles'
import { Card } from '@/components/ui/Card'
import PageHeader from '@/components/PageHeader'
import { ToolCard } from '@/components/dad-tools/ToolCard'
import { buttonVariants } from '@/components/ui/Button'
import SectionHeader from '@/components/SectionHeader'
import { ChevronRightIcon } from '@/components/icons'

export function generateMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title: LABELS.tools.hub.pageTitle,
    description: LABELS.tools.hub.metaDescription,
    path: '/tools',
    siteUrl,
    type: 'site',
    ogType: 'website',
  })
}

type SpokeCard = {
  kicker: string
  title:  string
  blurb:  string
  href:   string
}

// The role names the step; the tool's short name rides along only when it says
// something the title doesn't (eyebrow doctrine: never repeat the title).
function kickerOf(role: string, short: string, full: string): string {
  return short === full ? role : `${role} · ${short}`
}

// Main spokes — the three concepts the tools area is built around. Order
// matters: Time anchors the gut-punch, Savings is the daily ritual, Presence
// closes the loop with the moment counter.
const MAIN_SPOKES: SpokeCard[] = [
  {
    kicker: kickerOf(LABELS.tools.theBoss.spokeRole, LABELS.tools.theBoss.short, LABELS.tools.theBoss.full),
    title:  LABELS.tools.theBoss.full,
    blurb: LABELS.tools.theBoss.spokeBlurb,
    href:  '/tools/the-boss',
  },
  {
    kicker: kickerOf(LABELS.tools.weekendsUntil.spokeRole, LABELS.tools.weekendsUntil.short, LABELS.tools.weekendsUntil.full),
    title:  LABELS.tools.weekendsUntil.full,
    blurb: LABELS.tools.weekendsUntil.spokeBlurb,
    href:  '/tools/weekends-until',
  },
  {
    kicker: kickerOf(LABELS.tools.savings.spokeRole, LABELS.tools.savings.short, LABELS.tools.savings.full),
    title:  LABELS.tools.savings.full,
    blurb: LABELS.tools.savings.spokeBlurb,
    href:  '/tools/savings',
  },
  // Goals lives at a top-level /goals URL rather than under /tools/ — it isn't a
  // calculator you visit, it's a daily loop that pings you. The card belongs here
  // because this hub is where a dad looks for his own stuff.
  {
    kicker: kickerOf(LABELS.goals.spokeRole, LABELS.goals.short, LABELS.goals.full),
    title:  LABELS.goals.full,
    blurb: LABELS.goals.spokeBlurb,
    href:  '/goals',
  },
  // Presence is intentionally NOT a card here — it lives on each family
  // member's page, and "days since last moment" now surfaces directly in the
  // per-member rows above the tool grid.
]

// The Calculators — the money path (docs/money-tools-plan.md). Ordered as the
// sequence a dad should tackle his money in, NOT build order, and the eyebrows
// (spokeRole) name the step: Steady → Protect → Clear → Build. Each tool's
// result links to the next one. All stateless — no account needed.
const REFERENCE_TOOLS: SpokeCard[] = [
  {
    kicker: kickerOf(LABELS.tools.runway.spokeRole, LABELS.tools.runway.short, LABELS.tools.runway.full),
    title:  LABELS.tools.runway.full,
    blurb: LABELS.tools.runway.spokeBlurb,
    href:  '/tools/emergency-runway',
  },
  {
    kicker: kickerOf(LABELS.tools.lifeInsurance.spokeRole, LABELS.tools.lifeInsurance.short, LABELS.tools.lifeInsurance.full),
    title:  LABELS.tools.lifeInsurance.full,
    blurb: LABELS.tools.lifeInsurance.spokeBlurb,
    href:  '/tools/life-insurance',
  },
  {
    kicker: kickerOf(LABELS.tools.debtPayoff.spokeRole, LABELS.tools.debtPayoff.short, LABELS.tools.debtPayoff.full),
    title:  LABELS.tools.debtPayoff.full,
    blurb: LABELS.tools.debtPayoff.spokeBlurb,
    href:  '/tools/debt-payoff',
  },
  {
    kicker: kickerOf(LABELS.tools.loanMath.spokeRole, LABELS.tools.loanMath.short, LABELS.tools.loanMath.full),
    title:  LABELS.tools.loanMath.full,
    blurb: LABELS.tools.loanMath.spokeBlurb,
    href:  '/tools/loan-math',
  },
  {
    kicker: kickerOf(LABELS.tools.dadMath.spokeRole, LABELS.tools.dadMath.short, LABELS.tools.dadMath.full),
    title:  LABELS.tools.dadMath.full,
    blurb: LABELS.tools.dadMath.spokeBlurb,
    href:  '/tools/dad-math',
  },
]

export default async function ToolsHubPage() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  // "Manage kids" routes everyone to /account, where MyKidsSection
  // now lives for all roles.
  const manageKidsHref = '/account'
  let kids: Kid[] = []

  if (user) {
    const { data: rawKids } = await supabase.from('kid_profiles')
      .select(KID_COLUMNS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    kids = (rawKids ?? []) as Kid[]
  }

  // TWO GATES, not one. The hero is about being SIGNED IN; the kid cards are
  // about having kids. Conflating them meant a signed-in member with no family
  // added — someone here for a taper — was shown the logged-out sales pitch
  // ("no sign-up walls") on a page he'd signed up for.
  const isSignedIn = !!user
  const isLoggedInWithKids = isSignedIn && kids.length > 0

  // Per-member tool state for the family rows: days-since-last-moment + total
  // saved across that member's goals. Batched so the hub stays a fixed number
  // of round-trips regardless of family size.
  const daysSinceByKid = new Map<string, number | null>()
  const savedByKid = new Map<string, number>()
  if (isLoggedInWithKids) {
    const kidIds = kids.map((k) => k.id)
    const { data: moments } = await supabase.from('kid_moments')
      .select('kid_profile_id, occurred_on, created_at')
      .in('kid_profile_id', kidIds)
    const lastKeyByKid = new Map<string, string>()
    for (const m of (moments ?? []) as { kid_profile_id: string; occurred_on: string | null; created_at: string }[]) {
      const key = momentDayKey(m.occurred_on, m.created_at)
      const prev = lastKeyByKid.get(m.kid_profile_id)
      if (!prev || key > prev) lastKeyByKid.set(m.kid_profile_id, key)
    }
    for (const id of kidIds) {
      const k = lastKeyByKid.get(id)
      daysSinceByKid.set(id, k ? daysSinceDayKey(k) : null)
    }

    // Savings tied to each member (goal.kid_profile_id). getGoals() already
    // scopes to the current user's owned + joined goals, archived excluded.
    const goals = await getGoals()
    for (const g of goals) {
      const kpid = g.goal.kid_profile_id
      if (kpid) savedByKid.set(kpid, (savedByKid.get(kpid) ?? 0) + g.stats.runningTotal)
    }
  }

  // Declared once, rendered in one of two places depending on who's reading — see the
  // two call sites below. Two <InstallPWA> literals would be two things to keep in sync.
  const installCta = (
    <InstallPWA
      className="mb-10 sm:mb-14"
      body="Install Boss Daddy — your dad tools, one tap from the home screen."
    />
  )

  return (
    <>
      {/* Full PageHeader — this is a listing (continuity plan Phase 7). The old hero's
          second line was an h2 (a heading with nothing under it); it's the deck's
          opening sentence now. */}
      <PageHeader
        eyebrow={isSignedIn ? LABELS.tools.hub.loggedInGreeting : LABELS.tools.hub.eyebrow}
        title={isSignedIn ? LABELS.tools.hub.loggedInBody : LABELS.tools.hub.heroTitle}
        deck={isSignedIn
          ? LABELS.tools.hub.loggedInDek
          : `${LABELS.tools.hub.heroTitleSecond} ${LABELS.tools.hub.heroBody}`}
      />

    <div className="max-w-6xl mx-auto px-6 py-10 sm:py-14">

      {/* ── THE DAY, FIRST ───────────────────────────────────────────────────
          THIS IS THE SIGNED-IN HOME (docs/nav-ia-plan.md Phase D), so the first thing
          on it is the answer to "what now" — not a directory, and certainly not an
          install advert. It used to sit fourth, under the launcher, the PWA banner and
          the family rows: on a 393px phone with two kids, "3 things waiting on you"
          started around 700px down, which is a work queue you have to go looking for.

          Card-first even when the day is CLEAR, and deliberately so — the quiet state
          ("You're clear") is reassurance, which is the thing a man opening this page at
          6am is actually after. That also avoids reordering the page by state, which
          would mean preloading the query up here just to learn the tone. */}
      {user ? <TodayCard userId={user.id} className="mb-10 sm:mb-14" /> : null}

      {/* ── THE LAUNCHER, HIGH AND THIN ──────────────────────────────────────
          Second now, still above the fold. This is the row a returning dad aims his
          thumb at without reading, and at ~76px it costs less height than one of the old
          cards. Signed-out visitors get the full pitch further down instead; they have
          no muscle memory to serve. */}
      {isSignedIn ? <ToolTiles className="mb-10 sm:mb-14" /> : null}

      {/* Signed-out only up here. For a member this is a promo sitting between him and
          his own work, so it moves below the personalized stack (further down). */}
      {isSignedIn ? null : installCta}

      {/* ── PERSONALIZED STATE — only when logged in with kids ──────────── */}
      {/* Compact-row pattern matches /account/settings + /dashboard/profile.
          The headline number (weekends-until) is the entire reason this
          page exists — preserve it as the right-aligned stat. Tap → kid
          hub where % elapsed, last moment, savings, and Dad Math live. */}
      {isLoggedInWithKids && (
        <section className="mb-10 sm:mb-14">
          <div className="space-y-1.5">
            {kids.map((kid) => {
              const isChild = kid.member_type === 'child'
              const name = kid.name?.trim() || LABELS.tools.kids.noNameFallback
              const initial = (kid.name?.trim()?.[0] ?? '?').toUpperCase()

              // Weekends-until-18 — children only.
              const target = isChild ? milestoneDate('until_18', kid.birthdate) : null
              const weekends = target ? weeksUntil(target) : 0
              const past18 = isChild && weekends === 0
              const leadLabel = isChild
                ? (past18 ? 'Past 18' : `${weekends} weekends`)
                : LABELS.tools.kids.memberType[kid.member_type]

              // Days since last moment (Presence) — everyone.
              const daysSince = daysSinceByKid.get(kid.id) ?? null
              const momentLabel = daysSince === null
                ? 'no moments yet'
                : daysSince === 0
                  ? 'moment today'
                  : `${daysSince}d since moment`

              // Total saved across this member's goals — everyone, omit when $0.
              const saved = savedByKid.get(kid.id) ?? 0
              const savedLabel = saved > 0 ? `${fmtUsdWhole(saved)} saved` : null

              const metrics = [leadLabel, momentLabel, savedLabel].filter(Boolean).join(' · ')

              return (
                <Link
                  key={kid.id}
                  href={`/tools/family/${kid.id}`}
                  className="block group"
                >
                  <Card tone="chrome" className="flex items-center gap-3 px-3 py-3 min-h-[44px]">
                  {familyPhotoSrc(kid) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={familyPhotoSrc(kid) as string}
                      alt=""
                      className="h-10 w-10 rounded-full object-cover bg-surface-sunken shrink-0"
                    />
                  ) : (
                    <div
                      className="h-10 w-10 rounded-full bg-chrome text-white flex items-center justify-center text-base font-black shrink-0"
                      aria-hidden="true"
                    >
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-base font-semibold text-prose group-hover:text-accent-text-soft transition-colors truncate">
                      {name}
                    </p>
                    <p className="text-xs text-prose-faint truncate">
                      {metrics}
                    </p>
                  </div>
                  <ChevronRightIcon className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft shrink-0 transition-colors" strokeWidth={2} />
                  </Card>
                </Link>
              )
            })}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3 flex-wrap">
            <Link
              href={manageKidsHref}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              {LABELS.tools.hub.manageKidsCta}
            </Link>
          </div>
        </section>
      )}

      {/* ── NO KIDS YET — short prompt to add one ───────────────────────── */}
      {user && kids.length === 0 && (
        <ToolCard
          href={manageKidsHref}
          kicker="Get started"
          title="Add a family member to unlock personalized numbers."
          blurb="Tools work without an account — but adding your family lets you save moments, get yearly check-ins, and watch the number compound."
          cta={LABELS.tools.hub.addFirstKidCta}
          className="mb-10 sm:mb-14"
        />
      )}

      {/* ── WHAT YOU'RE CARRYING ─────────────────────────────────────────────
          The card at the top answers "what now"; this answers "what am I carrying".
          Both come before the tool shelf because a returning user is not shopping for a
          tool. Renders nothing when signed out or empty, so a newcomer still meets the
          shelf first.

          This is the content move from docs/nav-ia-plan.md Phase D. The Today card that
          used to lead this block now leads the PAGE (Phase F). */}
      {user ? (
        <div className="mb-10 sm:mb-14 space-y-6">
          <WorkingOnSection userId={user.id} />
          {/* Who's watching the work sits WITH the work. It's a fact about these
              goals — on /account it was a fact about goals that page no longer
              shows. */}
          <YourCornerSection />
        </div>
      ) : null}

      {/* The promo, once his own things are dealt with. */}
      {isSignedIn ? installCta : null}

      {/* ── THE SHELF, IN TWO STATES ─────────────────────────────────────────
          A signed-in dad gets tiles; a visitor keeps the cards.

          The blurbs are doing real work for somebody who has never used these and no
          work at all for a member who opens this page every morning — five of them
          stacked under his own goals is five paragraphs of advertising between him and
          what he came for. Same gate the hero already uses, so this costs no new query
          and no new branch of state.

          ONE SECTION NOW, not two. "Reference calculators" was a heading organising a
          single item; Dad Math keeps its not-part-of-the-daily-loop status through last
          position plus a quieter treatment (a chip on the card, a recessive tile), which
          is what the heading was really communicating. */}
      {/* Signed-out only: the four daily tools with their full pitch. A signed-in dad
          already has them as the launcher row at the top of the page. */}
      {isSignedIn ? null : (
        <section className="mb-10 sm:mb-14">
          <SectionHeader label="The tools" />
          {/* Four spokes: two across, then four — never three-and-an-orphan. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {MAIN_SPOKES.map((spoke) => (
              <ToolCard key={spoke.href} href={spoke.href} kicker={spoke.kicker} title={spoke.title} blurb={spoke.blurb} cta="Open" />
            ))}
          </div>
        </section>
      )}

      {/* ── CALCULATORS — its own area, for everyone, with room to grow ───────
          Restored as a section after briefly folding it into the shelf. The earlier
          reasoning was that a heading organising ONE item costs more than it earns —
          true then, wrong now: this is a category with more coming, and a named area
          people can learn is what makes the second and third calculator findable
          instead of surprising. The "More coming" placeholder retired when the money
          path filled the section (2026-09-24). */}
      <section>
        <SectionHeader label="Calculators" />
        {/* Five compact boxes on a 6-column track: 3 + 2 wide ones on desktop (no
            empty slot), 2 + 2 + a full-width one on tablet. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          {REFERENCE_TOOLS.map((spoke, i) => (
            <ToolCard
              key={spoke.href}
              href={spoke.href}
              kicker={spoke.kicker}
              title={spoke.title}
              blurb={spoke.blurb}
              size="compact"
              tone="box"
              className={`${i === REFERENCE_TOOLS.length - 1 ? 'sm:col-span-2' : ''} ${i < 3 ? 'lg:col-span-2' : 'lg:col-span-3'}`}
            />
          ))}
        </div>
      </section>
    </div>
    </>
  )
}

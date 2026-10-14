// Savings tool — goal index. Authenticated-only (logged-out gets an
// explainer + sign-in CTA). Mirrors the /tools/weekends-until pattern:
// Server Component pulls data + branches on auth state.

import Link from 'next/link'
import type { Metadata } from 'next'
import { OG_SITE } from '@/lib/og'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import PageHeader from '@/components/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { getGoals } from '@/lib/dad-tools/savings-actions'
import { getKids } from '@/lib/dad-tools/kid-actions'
import { unreadNoteCounts } from '@/lib/goals/notes'
import GoalCard from './_components/GoalCard'
import InstallPWA from '@/components/InstallPWA'
import { LoginLink } from '@/components/LoginLink'
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { buttonVariants } from '@/components/ui/Button'

export const metadata: Metadata = {
  title:       `${LABELS.tools.savings.pageTitle} (Beta)`,
  description: LABELS.tools.savings.metaDescription,
  alternates:  { canonical: '/tools/savings' },
  openGraph: {
    ...OG_SITE,
    title:       LABELS.tools.savings.pageTitle,
    description: LABELS.tools.savings.metaDescription,
  },
}

export default async function SavingsIndexPage() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  // Logged-out: short explainer + sign-in CTA. We don't expose any
  // calculator or playable preview at /tools/savings — the value of this
  // tool is account-tied (history + reminders + invites).
  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-8">
<PageHeader
          size="compact"
          back={{ href: '/tools', label: LABELS.tools.short }}
          eyebrow={`${LABELS.tools.savings.spokeRole} · ${LABELS.tools.savings.short}`}
          title={LABELS.tools.savings.h1}
          deck={LABELS.tools.savings.tagline}
        />

        <Card as="section" tone="chrome" className="p-6 sm:p-8 space-y-4">
          <Eyebrow>
            How it works
          </Eyebrow>
          <ul className="space-y-3 text-prose-muted text-sm sm:text-base leading-snug">
            <li>1. Set a tiny daily / weekly commitment — like $2/day for a camping trip.</li>
            <li>2. Each day, tap &quot;Yes&quot; — your PayPal or Venmo opens pre-filled.</li>
            <li>3. Confirm the send in your own app. We log the commitment, you move the money.</li>
            <li>4. Watch the streak, banked days, and total stack up.</li>
          </ul>
          <p className="text-xs text-prose-faint pt-2">
            {LABELS.tools.savings.disclosure}
          </p>
        </Card>

        <LoginLink className={buttonVariants()}>
          Sign in to start →
        </LoginLink>
      </div>
    )
  }

  // Logged-in: list goals + new-goal CTA.
  const [goalsWithStats, kids] = await Promise.all([
    getGoals(),
    getKids(),
  ])
  const kidNameById = new Map(kids.map((k) => [k.id, k.name]))

  // Unread notes for every card in one call — see unreadNoteCounts. Done after
  // getGoals rather than alongside it because it needs the ids.
  const unreadNotes = await unreadNoteCounts(
    supabase,
    'savings_goal',
    goalsWithStats.map((g) => g.goal.id),
  )

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
<PageHeader
        size="compact"
        back={{ href: '/tools', label: LABELS.tools.short }}
        eyebrow={LABELS.tools.savings.hubEyebrow}
        title={LABELS.tools.savings.full}
        deck={LABELS.tools.savings.tagline}
        actions={goalsWithStats.length > 0 ? (
          <Link href="/tools/savings/new" className={buttonVariants()}>
            + New
          </Link>
        ) : undefined}
      />

      <InstallPWA body="Add the Savings tool to your home screen. One-tap return from your bank app." />

      {goalsWithStats.length === 0 ? (
        <EmptyState
          variant="dashed"
          title={LABELS.tools.savings.indexEmptyTitle}
          body={LABELS.tools.savings.indexEmptyBody}
          action={
            <Link href="/tools/savings/new" className={buttonVariants()}>
              {LABELS.tools.savings.newCtaArrow}
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goalsWithStats.map((g) => (
            <GoalCard
              key={g.goal.id}
              data={g}
              kidName={g.goal.kid_profile_id ? kidNameById.get(g.goal.kid_profile_id) ?? null : null}
              isOwner={g.goal.owner_id === user.id}
              unreadNotes={unreadNotes.get(g.goal.id) ?? 0}
            />
          ))}
        </div>
      )}

      <footer className="pt-6 border-t border-soft">
        <p className="text-xs text-prose-faint leading-relaxed">
          {LABELS.tools.savings.disclosure}
        </p>
      </footer>
    </div>
  )
}

// Savings tool — goal index. Authenticated-only (logged-out gets an
// explainer + sign-in CTA). Mirrors the /tools/weekends-until pattern:
// Server Component pulls data + branches on auth state.

import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import { getGoals } from '@/lib/dad-tools/savings-actions'
import { getKids } from '@/lib/dad-tools/kid-actions'
import GoalCard from './_components/GoalCard'
import InstallPWA from '@/components/InstallPWA'
import { LoginLink } from '@/components/LoginLink'

export const metadata: Metadata = {
  title:       `${LABELS.tools.savings.pageTitle} (Beta)`,
  description: LABELS.tools.savings.metaDescription,
  alternates:  { canonical: '/tools/savings' },
  openGraph: {
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
        <header className="space-y-3">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            {LABELS.tools.savings.spokeRole} · {LABELS.tools.savings.short}
          </p>
          <h1 className="text-3xl sm:text-5xl font-black text-prose leading-[1.05] tracking-tight">
            {LABELS.tools.savings.h1}
          </h1>
          <p className="text-base sm:text-lg text-prose-muted leading-snug max-w-xl">
            {LABELS.tools.savings.tagline}
          </p>
        </header>

        <section className="bg-surface border border-soft rounded-xl p-6 sm:p-8 space-y-4">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            How it works
          </p>
          <ul className="space-y-3 text-prose-muted text-sm sm:text-base leading-snug">
            <li>1. Set a tiny daily / weekly commitment — like $2/day for a camping trip.</li>
            <li>2. Each day, tap &quot;Yes&quot; — your PayPal or Venmo opens pre-filled.</li>
            <li>3. Confirm the send in your own app. We log the commitment, you move the money.</li>
            <li>4. Watch the streak, banked days, and total stack up.</li>
          </ul>
          <p className="text-xs text-prose-faint pt-2">
            {LABELS.tools.savings.disclosure}
          </p>
        </section>

        <LoginLink className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors">
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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">

      <header className="space-y-3">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {LABELS.tools.savings.hubEyebrow}
        </p>
        <div className="flex items-end justify-between gap-3">
          <h1 className="text-3xl sm:text-4xl font-black text-prose leading-[1.05] tracking-tight">
            {LABELS.tools.savings.full}
          </h1>
          {goalsWithStats.length > 0 && (
            <Link
              href="/tools/savings/new"
              className="bg-accent hover:bg-accent-hover text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors shrink-0"
            >
              + New
            </Link>
          )}
        </div>
        <p className="text-prose-faint text-sm sm:text-base leading-snug">
          {LABELS.tools.savings.tagline}
        </p>
      </header>

      <InstallPWA body="Add the Savings tool to your home screen. One-tap return from your bank app." />

      {goalsWithStats.length === 0 ? (
        <section className="bg-surface border border-soft rounded-xl p-6 sm:p-8 text-center space-y-4">
          <p className="text-lg sm:text-xl font-black text-prose">
            {LABELS.tools.savings.indexEmptyTitle}
          </p>
          <p className="text-sm text-prose-muted max-w-md mx-auto">
            {LABELS.tools.savings.indexEmptyBody}
          </p>
          <Link
            href="/tools/savings/new"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            {LABELS.tools.savings.newCtaArrow}
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goalsWithStats.map((g) => (
            <GoalCard
              key={g.goal.id}
              data={g}
              kidName={g.goal.kid_profile_id ? kidNameById.get(g.goal.kid_profile_id) ?? null : null}
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

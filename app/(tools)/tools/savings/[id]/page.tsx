// Goal detail — the daily-ritual surface. Big "Yes" button, progress block,
// catch-up panel (when behind), history. Multi-participant attribution +
// invite UI arrive in Phase 3; reminders config + projection panel in Phase 4.

import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { getGoal } from '@/lib/dad-tools/savings-actions'
import { LABELS } from '@/lib/labels'
import ProgressBlock from '../_components/ProgressBlock'
import CatchUpPanel from '../_components/CatchUpPanel'
import ContributionLog, { type ContributorProfile } from '../_components/ContributionLog'
import ContributionButton from '../_components/ContributionButton'
import ParticipantsStrip, { type ParticipantDisplay } from '../_components/ParticipantsStrip'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const data = await getGoal(id)
  const title = data?.goal.name ? `${data.goal.name} — ${LABELS.tools.savings.short}` : LABELS.tools.savings.short
  return {
    title:    `${title} — Boss Daddy`,
    robots:   { index: false },
    alternates: { canonical: `/tools/savings/${id}` },
  }
}

export default async function SavingsGoalPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect(`/login?next=/tools/savings/${id}`)

  const data = await getGoal(id)
  if (!data) notFound()
  const { goal, entries, stats, participants } = data
  const isOwner = goal.owner_id === user.id

  // Resolve the kid's display name + ability to link back. RLS will refuse
  // the read if the kid isn't owned by the current user, so a null result
  // also covers the "kid was deleted" race.
  let kidName: string | null = null
  if (goal.kid_profile_id) {
    const { data: kidRow } = await supabase.from('kid_profiles')
      .select('name')
      .eq('id', goal.kid_profile_id)
      .maybeSingle()
    const raw = (kidRow as { name?: string | null } | null)?.name
    kidName = raw?.trim() || 'your kid'
  }

  // Build a single profile lookup keyed by user_id, covering every distinct
  // contributor in the entries log PLUS every current participant. Goes
  // through SSR client (RLS allows reading any participant's profile via
  // /api conventions; profiles are public reads).
  const participantIds = participants.map((p) => p.user_id)
  const entryContributorIds = Array.from(new Set(entries.map((e) => e.contributor_id)))
  const allUserIds = Array.from(new Set([...participantIds, ...entryContributorIds]))
  type ProfileRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
  const { data: profileRows } = allUserIds.length > 0
    ? await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', allUserIds)
    : { data: [] }
  const profileRowsTyped = (profileRows ?? []) as ProfileRow[]
  const profileById = new Map<string, ContributorProfile>()
  for (const p of profileRowsTyped) {
    profileById.set(p.id, { id: p.id, username: p.username, display_name: p.display_name })
  }

  // Participants for the header strip — include avatars, role, and a flag
  // for the current viewer so they see "You" instead of their own name.
  const participantDisplay: ParticipantDisplay[] = participants.map((p) => {
    const profile = profileRowsTyped.find((row) => row.id === p.user_id)
    return {
      userId:      p.user_id,
      displayName: profile?.display_name?.trim() || (profile?.username ? `@${profile.username}` : 'Unknown'),
      avatarUrl:   profile?.avatar_url ?? null,
      role:        p.role,
      isCurrent:   p.user_id === user.id,
    }
  })
  const showAttribution = participants.length > 1

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">

      <header className="space-y-2">
        <Link
          href="/tools/savings"
          className="text-sm text-prose-faint hover:text-prose-muted transition-colors"
        >
          ← Back to goals
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">
              {goal.kid_profile_id && kidName ? (
                <Link
                  href={`/tools/kids/${goal.kid_profile_id}`}
                  className="hover:text-accent transition-colors"
                >
                  For {kidName} →
                </Link>
              ) : (
                <>Personal savings</>
              )}
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-prose leading-tight tracking-tight">
              {goal.name}
            </h1>
            {goal.description && (
              <p className="text-prose-faint text-sm sm:text-base mt-1 leading-snug max-w-xl">
                {goal.description}
              </p>
            )}
          </div>
          {isOwner && (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/tools/savings/${goal.id}/invite`}
                className="text-sm font-medium text-accent hover:text-accent-hover transition-colors px-3 py-1.5 border border-accent/40 hover:border-accent rounded-lg"
              >
                Invite
              </Link>
              <Link
                href={`/tools/savings/${goal.id}/edit`}
                className="text-sm text-prose-faint hover:text-prose-muted transition-colors px-3 py-1.5 border border-soft rounded-lg"
              >
                Edit
              </Link>
            </div>
          )}
        </div>
      </header>

      <ParticipantsStrip
        goalId={goal.id}
        participants={participantDisplay}
        isOwner={isOwner}
      />

      <ProgressBlock goal={goal} stats={stats} />

      {stats.catchUpSuggestion && goal.cadence && (
        <CatchUpPanel cadence={goal.cadence} suggestion={stats.catchUpSuggestion} />
      )}

      <ContributionButton goal={goal} />

      <ContributionLog
        entries={entries}
        profileById={profileById}
        showAttribution={showAttribution}
      />

      <footer className="pt-4 border-t border-soft">
        <p className="text-xs text-prose-faint leading-relaxed">
          {LABELS.tools.savings.disclosure}
        </p>
      </footer>
    </div>
  )
}

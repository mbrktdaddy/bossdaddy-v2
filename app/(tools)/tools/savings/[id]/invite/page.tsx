// Owner-only invite management for a savings goal. Lists active participants,
// pending invites, and lets the owner generate a new invite link to share.
//
// Non-owners are redirected to the goal detail page — RLS already prevents
// them from creating invites, but the explicit redirect keeps the UI clear.

import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { LABELS } from '@/lib/labels'
import InviteManager from './_InviteManager'
import RemoveParticipantButton from './_RemoveParticipantButton'

interface PageProps {
  params: Promise<{ id: string }>
}

export const metadata: Metadata = {
  title:  `Invite participants — ${LABELS.tools.savings.short}`,
  robots: { index: false, follow: false },
}

const PARTICIPANT_COLUMNS = 'id, goal_id, user_id, role, joined_at, destination_url, destination_type, destination_label'
const INVITE_COLUMNS = 'id, goal_id, inviter_id, email, expires_at, used_at, used_by, created_at'

export default async function InviteGoalParticipantsPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) redirect(`/login?next=/tools/savings/${id}/invite`)

  // Goal + owner check — RLS lets participants read goals, but we want to
  // gate invite management to the owner.
  const { data: goalRow } = await supabase.from('savings_goals')
    .select('id, name, owner_id, status, destination_mode, destination_label')
    .eq('id', id)
    .maybeSingle()
  type GoalRow = {
    id: string; name: string; owner_id: string; status: string;
    destination_mode: 'shared' | 'per_participant' | 'manual'; destination_label: string | null
  }
  const goal = goalRow as GoalRow | null
  if (!goal) notFound()
  if (goal.owner_id !== user.id) redirect(`/tools/savings/${id}`)

  // Pull participants (with their usernames) + pending invites in parallel.
  const nowIso = new Date().toISOString()
  const [{ data: participantRows }, { data: pendingRows }] = await Promise.all([
    supabase.from('savings_goal_participants')
      .select(PARTICIPANT_COLUMNS)
      .eq('goal_id', id)
      .order('joined_at', { ascending: true }),
    supabase.from('savings_goal_invitations')
      .select(INVITE_COLUMNS)
      .eq('goal_id', id)
      .is('used_at', null)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false }),
  ])

  type ParticipantRow = {
    id: string; goal_id: string; user_id: string; role: 'owner' | 'contributor'; joined_at: string;
    destination_url: string | null; destination_type: string | null; destination_label: string | null
  }
  type InviteRow = {
    id: string; goal_id: string; inviter_id: string; email: string | null;
    expires_at: string; used_at: string | null; used_by: string | null; created_at: string
  }
  const participants = ((participantRows ?? []) as unknown as ParticipantRow[])
  const pendingInvites = ((pendingRows ?? []) as unknown as InviteRow[])

  // Resolve display names for participants. Single batch lookup keeps it cheap.
  const userIds = participants.map((p) => p.user_id)
  const { data: profileRows } = userIds.length > 0
    ? await supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', userIds)
    : { data: [] }
  type ProfileRow = { id: string; username: string | null; display_name: string | null; avatar_url: string | null }
  const profileById = new Map<string, ProfileRow>()
  for (const p of (profileRows ?? []) as ProfileRow[]) profileById.set(p.id, p)

  const totalSeats = participants.length + pendingInvites.length

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <header className="space-y-2">
        <Link
          href={`/tools/savings/${id}`}
          className="text-sm text-prose-faint hover:text-prose-muted transition-colors"
        >
          ← Back to {goal.name}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-black text-prose leading-tight tracking-tight">
          Invite participants
        </h1>
        <p className="text-prose-faint text-sm sm:text-base leading-snug max-w-xl">
          Up to 5 people can share this goal. When either of you logs a
          contribution that day, the streak counts — the goal succeeds when
          anyone shows up.
        </p>
      </header>

      {/* Current participants */}
      <section className="bg-surface border border-soft rounded-xl p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            On this goal — {participants.length} / 5
          </p>
        </div>
        <div className="space-y-2">
          {participants.map((p) => {
            const profile = profileById.get(p.user_id)
            const name = profile?.display_name?.trim() || (profile?.username ? `@${profile.username}` : 'Unknown')
            const isOwner = p.role === 'owner'
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-2.5 bg-surface-sunken border border-soft rounded-lg min-h-[44px]"
              >
                <AvatarCircle profile={profile} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-prose truncate">{name}</p>
                  {isOwner && (
                    <p className="text-[10px] text-prose-faint uppercase tracking-widest">Owner</p>
                  )}
                </div>
                {!isOwner && (
                  <RemoveParticipantButton goalId={id} userId={p.user_id} name={name} />
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Invite manager — generate links + pending list */}
      <InviteManager
        goalId={id}
        goalName={goal.name}
        pendingInvites={pendingInvites.map((i) => ({
          id:         i.id,
          createdAt:  i.created_at,
          expiresAt:  i.expires_at,
          email:      i.email,
        }))}
        seatsRemaining={Math.max(0, 5 - totalSeats)}
      />
    </div>
  )
}

function AvatarCircle({ profile }: { profile: { avatar_url: string | null; username: string | null; display_name: string | null } | undefined }) {
  const initial = (profile?.display_name?.trim()?.[0] ?? profile?.username?.[0] ?? '?').toUpperCase()
  if (profile?.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover bg-surface-sunken shrink-0" />
  }
  return (
    <div className="h-9 w-9 rounded-full bg-accent/15 text-accent flex items-center justify-center text-sm font-black shrink-0" aria-hidden="true">
      {initial}
    </div>
  )
}


// Public invite acceptance page — anonymous-friendly landing for someone
// who got a goal invite link. Token lookup uses the admin client because
// RLS on savings_goal_invitations only exposes rows to the owner/inviter,
// not to the recipient.
//
// Flow:
//   1. Page resolves the token → fetches goal context (name + inviter name)
//   2. If invite is invalid/expired/used → show terminal state
//   3. If logged-out → show goal pitch + sign-in/up CTA with return URL
//   4. If logged-in → show "Join goal" CTA → calls acceptInvite Server Action

import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LABELS } from '@/lib/labels'
import AcceptInviteButton from './_AcceptInviteButton'

interface PageProps {
  params: Promise<{ token: string }>
}

export const metadata: Metadata = {
  title:  `Join a savings goal — ${LABELS.tools.savings.short}`,
  robots: { index: false, follow: false },
}

interface InviteContext {
  inviteId:     string
  goalId:       string
  goalName:     string
  inviterName:  string
  state:        'valid' | 'expired' | 'used' | 'invalid' | 'archived' | 'full'
}

async function loadInvite(token: string): Promise<InviteContext | null> {
  const admin = createAdminClient()

  const { data: inviteRow } = await admin.from('savings_goal_invitations')
    .select('id, goal_id, expires_at, used_at, inviter_id')
    .eq('token', token)
    .maybeSingle()
  type InviteRow = { id: string; goal_id: string; expires_at: string; used_at: string | null; inviter_id: string }
  const invite = inviteRow as InviteRow | null
  if (!invite) return null

  // Goal + inviter display name lookups
  const [{ data: goalRow }, { data: inviterRow }, { count: participantCount }] = await Promise.all([
    admin.from('savings_goals').select('id, name, status').eq('id', invite.goal_id).maybeSingle(),
    admin.from('profiles').select('username, display_name').eq('id', invite.inviter_id).maybeSingle(),
    admin.from('savings_goal_participants').select('id', { count: 'exact', head: true }).eq('goal_id', invite.goal_id),
  ])
  type GoalRow = { id: string; name: string; status: string }
  type ProfileRow = { username: string | null; display_name: string | null }
  const goal = goalRow as GoalRow | null
  if (!goal) return null

  const inviter = inviterRow as ProfileRow | null
  const inviterName =
    inviter?.display_name?.trim()
    || (inviter?.username ? `@${inviter.username}` : 'A Boss Daddy user')

  let state: InviteContext['state'] = 'valid'
  if (invite.used_at)                       state = 'used'
  else if (new Date(invite.expires_at) < new Date()) state = 'expired'
  else if (goal.status === 'archived')      state = 'archived'
  else if ((participantCount ?? 0) >= 5)    state = 'full'

  return {
    inviteId:    invite.id,
    goalId:      invite.goal_id,
    goalName:    goal.name,
    inviterName,
    state,
  }
}

export default async function AcceptInvitePage({ params }: PageProps) {
  const { token } = await params
  const ctx = await loadInvite(token)

  if (!ctx) {
    return (
      <Layout title="Invite not found">
        <p className="text-prose-muted text-sm leading-relaxed">
          This invite link is invalid or has been revoked. Ask the goal owner
          to send you a fresh one.
        </p>
        <BackHome />
      </Layout>
    )
  }

  // Terminal states — surface a clear message
  if (ctx.state === 'expired') {
    return (
      <Layout title="Invite expired">
        <p className="text-prose-muted text-sm leading-relaxed">
          This invite to join <strong className="text-prose">{ctx.goalName}</strong> expired.
          Ask {ctx.inviterName} to send you a new one.
        </p>
        <BackHome />
      </Layout>
    )
  }
  if (ctx.state === 'used') {
    return (
      <Layout title="Invite already used">
        <p className="text-prose-muted text-sm leading-relaxed">
          This invite has already been accepted. If that was you, you can
          jump straight to the goal.
        </p>
        <Link
          href={`/tools/savings/${ctx.goalId}`}
          className="inline-block mt-4 px-4 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg text-sm transition-colors"
        >
          Open the goal →
        </Link>
      </Layout>
    )
  }
  if (ctx.state === 'archived') {
    return (
      <Layout title="Goal archived">
        <p className="text-prose-muted text-sm leading-relaxed">
          <strong className="text-prose">{ctx.goalName}</strong> has been archived
          by its owner. Ask {ctx.inviterName} if it&apos;s still active.
        </p>
        <BackHome />
      </Layout>
    )
  }
  if (ctx.state === 'full') {
    return (
      <Layout title="Goal is full">
        <p className="text-prose-muted text-sm leading-relaxed">
          <strong className="text-prose">{ctx.goalName}</strong> already has 5 participants —
          the max. Ask {ctx.inviterName} to remove someone before joining.
        </p>
        <BackHome />
      </Layout>
    )
  }

  // Valid invite — branch on auth state
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (!user) {
    const next = encodeURIComponent(`/tools/savings/invite/${token}`)
    return (
      <Layout title={`${ctx.inviterName} invited you to a savings goal`}>
        <div className="bg-surface-sunken border border-soft rounded-xl p-5 space-y-3">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
            Goal
          </p>
          <p className="text-2xl font-black text-prose leading-tight">{ctx.goalName}</p>
        </div>
        <p className="text-prose-muted text-sm leading-relaxed">
          Sign in or create a free Boss Daddy account to join this goal. You&apos;ll be able
          to log contributions, see shared progress, and skip days — all while
          {' '}{ctx.inviterName.replace(/^@/, '')}&apos;s streak stays intact.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/login?next=${next}`}
            className="inline-block px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg text-sm transition-colors"
          >
            Sign in to join
          </Link>
          <Link
            href={`/register?next=${next}`}
            className="inline-block px-5 py-2.5 bg-surface-sunken border border-soft hover:border-accent-border/50 text-prose font-semibold rounded-lg text-sm transition-colors"
          >
            Create an account
          </Link>
        </div>
      </Layout>
    )
  }

  // Owner clicking their own invite link — bounce to the goal directly
  const { data: goalCheck } = await supabase.from('savings_goals')
    .select('owner_id')
    .eq('id', ctx.goalId)
    .maybeSingle()
  if ((goalCheck as { owner_id: string } | null)?.owner_id === user.id) {
    redirect(`/tools/savings/${ctx.goalId}`)
  }

  // Logged-in non-owner — show goal context + Join button
  return (
    <Layout title={`${ctx.inviterName} invited you to a savings goal`}>
      <div className="bg-surface-sunken border border-soft rounded-xl p-5 space-y-3">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          Goal
        </p>
        <p className="text-2xl font-black text-prose leading-tight">{ctx.goalName}</p>
      </div>
      <p className="text-prose-muted text-sm leading-relaxed">
        Join {ctx.inviterName.replace(/^@/, '')} on this goal. You&apos;ll be able to log
        contributions toward the same streak — the goal succeeds when either of you
        shows up that day.
      </p>
      <AcceptInviteButton token={token} />
    </Layout>
  )
}

// ── Layout shell ────────────────────────────────────────────────────────────

function Layout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-6">
      <header>
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold">
          {LABELS.tools.savings.short}
        </p>
        <h1 className="text-2xl sm:text-3xl font-black text-prose tracking-tight mt-1">
          {title}
        </h1>
      </header>
      {children}
    </div>
  )
}

function BackHome() {
  return (
    <Link
      href="/tools/savings"
      className="inline-block mt-4 text-sm font-semibold text-accent hover:underline"
    >
      ← Go to Savings
    </Link>
  )
}

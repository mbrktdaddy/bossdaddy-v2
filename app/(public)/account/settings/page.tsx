import { redirect } from 'next/navigation'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import Link from 'next/link'
import AvatarUploader from '@/components/account/AvatarUploader'
import EditUsernameForm from '@/components/account/EditUsernameForm'
import EditEmailForm from '@/components/account/EditEmailForm'
import AccountDeletion from '@/components/account/AccountDeletion'
import InstallAppButton from '@/components/pwa/InstallAppButton'
import MessageEmailToggle from '@/components/account/MessageEmailToggle'
import ConnectionPrefs from '@/components/account/ConnectionPrefs'
import PushNotificationSetting from '@/components/account/PushNotificationSetting'
import BioForm from '@/components/account/BioForm'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Account Settings',
  robots: { index: false, follow: false },
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  admin:  { label: 'Admin',  className: 'bg-accent-tint text-accent-text-soft border border-accent-border/60' },
  author: { label: 'Author', className: 'bg-info-bg text-info-ink border border-info-line' },
  member: { label: 'Member', className: 'bg-surface-raised text-prose-muted border border-strong' },
}

export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (!user) redirect('/login?next=/account/settings')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, role, account_status, created_at, deletion_requested_at, avatar_url, display_name, tagline, bio, email_new_message, connection_requests_from, discoverable_by_email')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'member'
  // Personal/account profile is the SAME for every role — admins/authors live
  // here too (no redirect to the dashboard). The dashboard is workspace-only.
  const isAuthor = role === 'author' || role === 'admin'

  const roleCfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.member

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  const accountStatus = profile?.account_status ?? 'active'
  const deletionRequestedAt = profile?.deletion_requested_at ?? null
  const deletionDate = deletionRequestedAt
    ? new Date(new Date(deletionRequestedAt).getTime() + 30 * 86_400_000)
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div data-theme="dark" className="bg-background text-prose min-h-[calc(100vh-4rem)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

      <div className="mb-8">
        {/* Settings is now ONLY settings. Your family, goals, activity, likes and
            followed gear moved to /account — a settings URL was the wrong home for
            things you have rather than things you configure. */}
        <h1 className="text-2xl font-black">Account Settings</h1>
        <p className="text-prose-faint text-sm mt-1">
          Your profile, sign-in, and who can reach you.{' '}
          <Link href="/account" className="text-accent-text hover:text-prose">
            Your stuff lives here →
          </Link>
        </p>
      </div>

      {/* Pending-deletion banner */}
      {accountStatus === 'pending_deletion' && (
        <AccountDeletion accountStatus={accountStatus} deletionDate={deletionDate} hasPublishedContent={false} />
      )}

      {/* ── PROFILE — public identity ──────────────────────────────────── */}
      <h2 className="text-base font-black text-prose mb-3">Profile</h2>

      {/* Identity — centered on mobile, left-aligned from sm+ */}
      <div className="bg-accent-tint border border-soft rounded-xl p-5 sm:p-6 mb-6">
        <AvatarUploader
          initialAvatarUrl={(profile as { avatar_url?: string | null } | null)?.avatar_url ?? null}
          initial={profile?.username?.[0]?.toUpperCase() ?? '?'}
        />
        <div className="mt-5 flex flex-col items-center sm:items-start gap-1">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <p className="font-black text-xl text-prose">@{profile?.username}</p>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleCfg.className}`}>
              {roleCfg.label}
            </span>
          </div>
          {memberSince && <p className="text-sm text-prose-faint">Member since {memberSince}</p>}
        </div>
      </div>

      {/* Public author identity — authors + admins only (members have no /author page) */}
      {isAuthor && (
        <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Public Author Profile</p>
          <p className="text-xs text-prose-faint mb-4">
            Shown under everything you publish, on your{' '}
            <Link href={`/author/${profile?.username}`} target="_blank" rel="noopener noreferrer" className="text-accent-text hover:text-accent-text-soft">public author page</Link>.
          </p>
          <BioForm
            initialDisplayName={(profile as { display_name?: string | null } | null)?.display_name ?? null}
            initialTagline={(profile as { tagline?: string | null } | null)?.tagline ?? null}
            initialBio={(profile as { bio?: string | null } | null)?.bio ?? null}
          />
        </div>
      )}

      {/* ── ACCOUNT — sign-in + email ──────────────────────────────────── */}
      <h2 className="text-base font-black text-prose mb-3 mt-10">Account</h2>

      <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
        <EditUsernameForm current={profile?.username ?? ''} />
        <div className="mt-5 pt-5 border-t border-soft">
          <label className="block text-xs text-prose-faint uppercase tracking-widest mb-2">Email</label>
          <EditEmailForm current={user.email ?? ''} />
        </div>
      </div>

      {/* Notification preferences */}
      <PushNotificationSetting />
      <MessageEmailToggle initialEnabled={(profile as { email_new_message?: boolean } | null)?.email_new_message ?? true} />

      <ConnectionPrefs
        initialRequestsFrom={
          (profile as { connection_requests_from?: string } | null)?.connection_requests_from === 'nobody'
            ? 'nobody' : 'everyone'
        }
        initialDiscoverableByEmail={
          (profile as { discoverable_by_email?: boolean } | null)?.discoverable_by_email ?? true
        }
      />

      {/* Goal reminders are per-schedule, not a global toggle: the time, the days,
          and the channels belong to the reminder itself, so a global switch here
          would either lie about what it controls or fight the per-goal mute. Point
          at the real control instead of duplicating it. */}
      <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
        <p className="text-sm font-semibold text-prose">Goal reminders</p>
        <p className="text-xs text-prose-faint mt-1 leading-relaxed">
          Each goal carries its own reminder — the time, the days, and how it
          reaches you. Mute or change any of them on the goal itself.
        </p>
        <Link
          href="/goals"
          className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-accent-text hover:text-prose"
        >
          Manage your goals →
        </Link>
      </div>

      {/* Install the app — renders only when installable + not already installed */}
      <InstallAppButton variant="card" />

      {/* Danger zone */}
      {accountStatus === 'active' && (
        <AccountDeletion accountStatus={accountStatus} deletionDate={deletionDate} hasPublishedContent={false} />
      )}

      </div>
    </div>
  )
}

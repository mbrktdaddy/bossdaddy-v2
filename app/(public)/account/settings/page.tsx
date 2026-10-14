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
import { Card } from '@/components/ui/Card'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import PageHeader from '@/components/PageHeader'
import { LABELS } from '@/lib/labels'

export const metadata: Metadata = {
  title: LABELS.settings.full,
  robots: { index: false, follow: false },
}

const ROLE_CONFIG: Record<string, { label: string; tone: BadgeTone }> = {
  admin:  { label: 'Admin',  tone: 'accent' },
  author: { label: 'Author', tone: 'info' },
  member: { label: 'Member', tone: 'muted' },
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
    <div className="bg-background text-prose min-h-[calc(100vh-4rem)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Settings is now ONLY settings. Your family, goals, activity, likes and
            followed gear moved to /account — a settings URL was the wrong home for
            things you have rather than things you configure. */}
        <PageHeader
          size="compact"
          back={{ href: '/account', label: LABELS.account.short }}
          eyebrow={LABELS.account.short}
          title={LABELS.settings.full}
          deck={LABELS.settings.tagline}
          className="mb-8"
        />

        {/* Pending-deletion banner */}
        {accountStatus === 'pending_deletion' && (
          <AccountDeletion accountStatus={accountStatus} deletionDate={deletionDate} hasPublishedContent={false} />
        )}

        {/* ── PROFILE — public identity ──────────────────────────────────── */}
        <Card tone="surface" className="p-6 mb-6">
          <Eyebrow className="mb-4">Profile</Eyebrow>

          {/* Identity — centered on mobile, left-aligned from sm+ */}
          <Card tone="sunken" className="p-5 sm:p-6">
            <AvatarUploader
              initialAvatarUrl={(profile as { avatar_url?: string | null } | null)?.avatar_url ?? null}
              initial={profile?.username?.[0]?.toUpperCase() ?? '?'}
            />
            <div className="mt-5 flex flex-col items-center sm:items-start gap-1">
              <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
                <p className="font-black text-xl text-prose">@{profile?.username}</p>
                <Badge tone={roleCfg.tone}>{roleCfg.label}</Badge>
              </div>
              {memberSince && <p className="text-sm text-prose-muted">Member since {memberSince}</p>}
            </div>
          </Card>
        </Card>

        {/* Public author identity — authors + admins only (members have no /author page) */}
        {isAuthor && (
          <Card tone="surface" className="p-6 mb-6">
            <Eyebrow className="mb-1">Public Author Profile</Eyebrow>
            <p className="text-xs text-prose-muted mb-4">
              Shown under everything you publish, on your{' '}
              <Link href={`/author/${profile?.username}`} target="_blank" rel="noopener noreferrer" className="text-accent-text hover:text-prose">public author page</Link>.
            </p>
            <BioForm
              initialDisplayName={(profile as { display_name?: string | null } | null)?.display_name ?? null}
              initialTagline={(profile as { tagline?: string | null } | null)?.tagline ?? null}
              initialBio={(profile as { bio?: string | null } | null)?.bio ?? null}
            />
          </Card>
        )}

        {/* ── ACCOUNT — sign-in + email ──────────────────────────────────── */}
        <Card tone="surface" className="p-6 mb-6">
          <Eyebrow className="mb-4">Sign-in</Eyebrow>
          <EditUsernameForm current={profile?.username ?? ''} />
          <div className="mt-5 pt-5 border-t border-soft">
            <p className="mb-1.5 text-sm font-semibold text-prose">Email</p>
            <EditEmailForm current={user.email ?? ''} />
          </div>
        </Card>

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
        <Card tone="surface" className="p-6 mb-6">
          <Eyebrow className="mb-2">Goal reminders</Eyebrow>
          <p className="text-xs text-prose-muted leading-relaxed">
            Each goal carries its own reminder — the time, the days, and how it
            reaches you. Mute or change any of them on the goal itself.
          </p>
          <Link
            href="/goals"
            className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-accent-text hover:text-prose"
          >
            Manage your goals →
          </Link>
        </Card>

        {/* Install the app — renders only when installable + not already installed */}
        <InstallAppButton variant="card" />

        {/* Danger zone — always the last card */}
        {accountStatus === 'active' && (
          <AccountDeletion accountStatus={accountStatus} deletionDate={deletionDate} hasPublishedContent={false} />
        )}
      </div>
    </div>
  )
}

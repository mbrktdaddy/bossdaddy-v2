import { redirect } from 'next/navigation'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import Link from 'next/link'
import AvatarUploader from '@/components/account/AvatarUploader'
import EditUsernameForm from '@/components/account/EditUsernameForm'
import EditEmailForm from '@/components/account/EditEmailForm'
import AccountDeletion from '@/components/account/AccountDeletion'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Account Settings',
  robots: { index: false, follow: false },
}

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  admin:  { label: 'Admin',  className: 'bg-accent-tint text-accent-text-soft border border-accent-border/60' },
  author: { label: 'Author', className: 'bg-blue-950/40 text-blue-300 border border-blue-700/40' },
  member: { label: 'Member', className: 'bg-surface-raised text-prose-muted border border-strong' },
}

export default async function AccountSettingsPage() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (!user) redirect('/login?next=/account/settings')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, role, account_status, created_at, deletion_requested_at, avatar_url')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'member'

  // Authors and admins have a richer dashboard profile page — send them there.
  if (role === 'author' || role === 'admin') redirect('/dashboard/profile')

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

  // Fetch activity stats
  const [
    { count: commentCount },
    { count: likesGiven },
    { data: likedReviewLinks },
    { data: likedArticleLinks },
  ] = await Promise.all([
    supabase.from('comments').select('id', { count: 'exact', head: true }).eq('author_id', user.id),
    supabase.from('likes').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('likes').select('content_id').eq('user_id', user.id).eq('content_type', 'review')
      .order('created_at', { ascending: false }).limit(10),
    supabase.from('likes').select('content_id').eq('user_id', user.id).eq('content_type', 'guide')
      .order('created_at', { ascending: false }).limit(10),
  ])

  const likedReviewIds  = likedReviewLinks?.map(l => l.content_id) ?? []
  const likedArticleIds = likedArticleLinks?.map(l => l.content_id) ?? []

  const [{ data: likedReviews }, { data: likedArticles }] = await Promise.all([
    likedReviewIds.length
      ? supabase.from('reviews').select('id, slug, title, product_name')
          .in('id', likedReviewIds).eq('status', 'approved').eq('is_visible', true)
      : Promise.resolve({ data: [] }),
    likedArticleIds.length
      ? supabase.from('guides').select('id, slug, title')
          .in('id', likedArticleIds).eq('status', 'approved').eq('is_visible', true)
      : Promise.resolve({ data: [] }),
  ])

  const reviewMap  = new Map(likedReviews?.map(r => [r.id, r]))
  const articleMap = new Map(likedArticles?.map(a => [a.id, a]))
  const orderedLikedReviews  = likedReviewIds.map(id => reviewMap.get(id)).filter(Boolean)
  const orderedLikedArticles = likedArticleIds.map(id => articleMap.get(id)).filter(Boolean)
  const hasLikedContent = orderedLikedReviews.length > 0 || orderedLikedArticles.length > 0

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12">

      <div className="mb-8">
        <h1 className="text-2xl font-black">Account Settings</h1>
        <p className="text-prose-faint text-sm mt-1">Manage your account and view your activity</p>
      </div>

      {/* Pending-deletion banner */}
      {accountStatus === 'pending_deletion' && (
        <AccountDeletion accountStatus={accountStatus} deletionDate={deletionDate} hasPublishedContent={false} />
      )}

      {/* Identity */}
      <div className="bg-accent-tint border border-soft rounded-xl p-6 mb-6">
        <AvatarUploader
          initialAvatarUrl={(profile as { avatar_url?: string | null } | null)?.avatar_url ?? null}
          initial={profile?.username?.[0]?.toUpperCase() ?? '?'}
        />
        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <p className="font-black text-xl text-prose">@{profile?.username}</p>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleCfg.className}`}>
            {roleCfg.label}
          </span>
        </div>
        {memberSince && <p className="text-sm text-prose-faint mt-1">Member since {memberSince}</p>}
      </div>

      {/* Account */}
      <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Account</p>
        <EditUsernameForm current={profile?.username ?? ''} />
        <div className="mt-5 pt-5 border-t border-soft">
          <label className="block text-xs text-prose-faint uppercase tracking-widest mb-2">Email</label>
          <EditEmailForm current={user.email ?? ''} />
        </div>
      </div>

      {/* Activity */}
      <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Activity</p>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-2xl font-black text-prose">{commentCount ?? 0}</p>
            <p className="text-xs text-prose-faint mt-1">Comments Left</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-accent-text-soft">{likesGiven ?? 0}</p>
            <p className="text-xs text-prose-faint mt-1">Likes Given</p>
          </div>
        </div>
      </div>

      {/* Liked content */}
      <div className="bg-surface border border-soft rounded-xl p-6 mb-6">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Liked Content</p>
        {!hasLikedContent ? (
          <p className="text-sm text-prose-faint text-center py-4">
            Nothing liked yet — heart a review or article and it will appear here.
          </p>
        ) : (
          <div className="space-y-1">
            {orderedLikedReviews.map((r) => r && (
              <Link key={r.id} href={`/reviews/${r.slug}`}
                className="flex items-center gap-3 p-3 bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-xl transition-colors group">
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent-tint text-accent-text-soft border border-accent-border/60 shrink-0">Review</span>
                <div className="min-w-0">
                  <p className="text-sm text-prose-muted group-hover:text-prose transition-colors truncate">{r.title}</p>
                  <p className="text-xs text-prose-faint truncate">{r.product_name}</p>
                </div>
                <svg className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft shrink-0 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            ))}
            {orderedLikedArticles.map((a) => a && (
              <Link key={a.id} href={`/guides/${a.slug}`}
                className="flex items-center gap-3 p-3 bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-xl transition-colors group">
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-300 border border-blue-700/40 shrink-0">Article</span>
                <div className="min-w-0">
                  <p className="text-sm text-prose-muted group-hover:text-prose transition-colors truncate">{a.title}</p>
                </div>
                <svg className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft shrink-0 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone */}
      {accountStatus === 'active' && (
        <AccountDeletion accountStatus={accountStatus} deletionDate={deletionDate} hasPublishedContent={false} />
      )}

    </div>
  )
}

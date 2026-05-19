import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { requireUser, getCurrentProfile } from '@/lib/auth-cache'
import EditUsernameForm from './_components/EditUsernameForm'
import EditEmailForm from './_components/EditEmailForm'
import BioForm from './_components/BioForm'
import AccountDeletion from './_components/AccountDeletion'
import AvatarUploader from './_components/AvatarUploader'

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  admin:  { label: 'Admin',  className: 'bg-accent-tint/60 text-accent-text-soft border border-accent-border/60' },
  author: { label: 'Author', className: 'bg-blue-950/60 text-blue-400 border border-blue-900/60' },
  member: { label: 'Member', className: 'bg-surface-raised text-prose-muted border border-strong' },
}

export default async function ProfilePage() {
  const user = await requireUser()
  const profile = await getCurrentProfile()
  const supabase = await createClient()

  const role     = profile?.role ?? 'member'
  const isAdmin  = role === 'admin'
  const isAuthor = role === 'author' || isAdmin
  const roleCfg  = ROLE_CONFIG[role] ?? ROLE_CONFIG.member

  // ── Stats + liked content IDs — all in parallel ──────────────────────────
  const [
    { count: reviewCount },
    { count: guideCount },
    { count: commentCount },
    { count: draftCount },
    { count: awaitingCount },
    { count: likesGiven },
    { data: myReviewIds },
    { data: myArticleIds },
    { data: myCommentIds },
    { data: likedReviewLinks },
    { data: likedArticleLinks },
  ] = await Promise.all([
    supabase.from('reviews').select('id', { count: 'exact', head: true })
      .eq('author_id', user.id).eq('status', 'approved'),
    supabase.from('guides').select('id', { count: 'exact', head: true })
      .eq('author_id', user.id).eq('status', 'approved'),
    supabase.from('comments').select('id', { count: 'exact', head: true })
      .eq('author_id', user.id),
    supabase.from('reviews').select('id', { count: 'exact', head: true })
      .eq('author_id', user.id).eq('status', 'draft'),
    supabase.from('reviews').select('id', { count: 'exact', head: true })
      .eq('author_id', user.id).eq('status', 'pending'),
    supabase.from('likes').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase.from('reviews').select('id').eq('author_id', user.id),
    supabase.from('guides').select('id').eq('author_id', user.id),
    supabase.from('comments').select('id').eq('author_id', user.id),
    // Most recently liked reviews (ID list, ordered by like date)
    supabase.from('likes').select('content_id, created_at')
      .eq('user_id', user.id).eq('content_type', 'review')
      .order('created_at', { ascending: false }).limit(10),
    // Most recently liked articles (ID list, ordered by like date)
    supabase.from('likes').select('content_id, created_at')
      .eq('user_id', user.id).eq('content_type', 'guide')
      .order('created_at', { ascending: false }).limit(10),
  ])

  const allContentIds  = [...(myReviewIds?.map(r => r.id) ?? []), ...(myArticleIds?.map(a => a.id) ?? [])]
  const myCommentIdList = myCommentIds?.map(c => c.id) ?? []

  const likedReviewIds  = likedReviewLinks?.map(l => l.content_id) ?? []
  const likedArticleIds = likedArticleLinks?.map(l => l.content_id) ?? []

  // ── Received stats + liked content details ────────────────────────────────
  const [
    { count: likesReceived },
    { count: commentLikesReceived },
    { count: sharesReceived },
    { data: likedReviews },
    { data: likedArticles },
  ] = await Promise.all([
    allContentIds.length
      ? supabase.from('likes').select('id', { count: 'exact', head: true })
          .in('content_type', ['review', 'guide']).in('content_id', allContentIds)
      : Promise.resolve({ count: 0 }),
    myCommentIdList.length
      ? supabase.from('likes').select('id', { count: 'exact', head: true })
          .eq('content_type', 'comment').in('content_id', myCommentIdList)
      : Promise.resolve({ count: 0 }),
    myCommentIdList.length
      ? supabase.from('comment_shares').select('id', { count: 'exact', head: true })
          .in('comment_id', myCommentIdList)
      : Promise.resolve({ count: 0 }),
    likedReviewIds.length
      ? supabase.from('reviews').select('id, slug, title, product_name')
          .in('id', likedReviewIds).eq('status', 'approved').eq('is_visible', true)
      : Promise.resolve({ data: [] }),
    likedArticleIds.length
      ? supabase.from('guides').select('id, slug, title')
          .in('id', likedArticleIds).eq('status', 'approved').eq('is_visible', true)
      : Promise.resolve({ data: [] }),
  ])

  // Re-sort fetched content to match original like order
  const reviewMap  = new Map(likedReviews?.map(r => [r.id, r]))
  const articleMap = new Map(likedArticles?.map(a => [a.id, a]))
  const orderedLikedReviews  = likedReviewIds.map(id => reviewMap.get(id)).filter(Boolean)
  const orderedLikedArticles = likedArticleIds.map(id => articleMap.get(id)).filter(Boolean)
  const hasLikedContent = orderedLikedReviews.length > 0 || orderedLikedArticles.length > 0

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  const accountStatus = profile?.account_status ?? 'active'
  const deletionRequestedAt = profile?.deletion_requested_at ?? null
  const hasPublishedContent = (reviewCount ?? 0) > 0 || (guideCount ?? 0) > 0

  // Hard-delete date is deterministic from request_date + 30 days (matches the
  // cron sweep cutoff). Pre-format here so the client component stays pure.
  const COOLDOWN_DAYS = 30
  const deletionDate = deletionRequestedAt
    ? new Date(new Date(deletionRequestedAt).getTime() + COOLDOWN_DAYS * 86_400_000)
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  return (
    <div className="p-8 max-w-2xl">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black">My Profile</h1>
        <p className="text-prose-faint text-sm mt-1">Manage your account and view your activity</p>
      </div>

      {/* Pending-deletion banner — sits at top so it can't be missed */}
      {accountStatus === 'pending_deletion' && (
        <AccountDeletion
          accountStatus={accountStatus}
          deletionDate={deletionDate}
          hasPublishedContent={hasPublishedContent}
        />
      )}

      {/* Identity hero — avatar + name + role pill + joined date */}
      <div className="bg-gradient-to-br from-surface via-surface to-orange-950/40 border border-soft rounded-2xl p-6 mb-6">
        <AvatarUploader
          initialAvatarUrl={(profile as { avatar_url?: string | null } | null)?.avatar_url ?? null}
          initial={profile?.username?.[0]?.toUpperCase() ?? '?'}
        />

        <div className="mt-6 flex items-center gap-2 flex-wrap">
          <p className="font-black text-xl text-white">@{profile?.username}</p>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleCfg.className}`}>
            {roleCfg.label}
          </span>
        </div>
        {memberSince && (
          <p className="text-sm text-prose-faint mt-1">Member since {memberSince}</p>
        )}
      </div>

      {/* Account — username + email */}
      <div className="bg-surface border border-soft rounded-2xl p-6 mb-6">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Account</p>
        <EditUsernameForm current={profile?.username ?? ''} />
        <div className="mt-5 pt-5 border-t border-soft">
          <label className="block text-xs text-prose-faint uppercase tracking-widest mb-2">Email</label>
          <EditEmailForm current={user.email ?? ''} />
        </div>
      </div>

      {/* Writing settings — authors only */}
      {isAuthor && (
        <div className="bg-surface border border-soft rounded-2xl p-6 mb-6">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Writing Settings</p>
          <Link
            href="/dashboard/profile/voice"
            className="flex items-center gap-3 p-4 bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-xl transition-colors group"
          >
            <span className="text-xl shrink-0">🎙️</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white group-hover:text-accent-text-soft transition-colors">Voice Profile</p>
              <p className="text-xs text-prose-faint mt-0.5">
                Facts Claude uses as ground truth — family ages, occupation, values, and evolving notes.
              </p>
            </div>
            <svg className="w-4 h-4 text-gray-700 group-hover:text-accent-text-soft shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      {/* Public bio — authors + admins only */}
      {isAuthor && (
        <div className="bg-surface border border-soft rounded-2xl p-6 mb-6">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Public Bio</p>
          <p className="text-xs text-prose-faint mb-4">
            Shown at the bottom of every piece you publish, on your <Link href={`/author/${profile?.username}`} target="_blank" className="text-accent-text hover:text-accent-text-soft">public author page</Link>.
          </p>
          <BioForm
            initialDisplayName={(profile as { display_name?: string | null } | null)?.display_name ?? null}
            initialTagline={(profile as { tagline?: string | null } | null)?.tagline ?? null}
            initialBio={(profile as { bio?: string | null } | null)?.bio ?? null}
          />
        </div>
      )}

      {/* Activity stats */}
      <div className="bg-surface border border-soft rounded-2xl p-6 mb-6">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Activity</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {isAuthor && (
            <>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{reviewCount ?? 0}</p>
                <p className="text-xs text-prose-faint mt-1">Published Reviews</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{guideCount ?? 0}</p>
                <p className="text-xs text-prose-faint mt-1">Published Guides</p>
              </div>
            </>
          )}
          <div className="text-center">
            <p className="text-2xl font-black text-white">{commentCount ?? 0}</p>
            <p className="text-xs text-prose-faint mt-1">Comments Left</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-accent-text-soft">{likesGiven ?? 0}</p>
            <p className="text-xs text-prose-faint mt-1">Likes Given</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-red-400">{commentLikesReceived ?? 0}</p>
            <p className="text-xs text-prose-faint mt-1">Comment Likes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-prose-muted">{sharesReceived ?? 0}</p>
            <p className="text-xs text-prose-faint mt-1">Comments Shared</p>
          </div>
          {isAuthor && (
            <div className="text-center">
              <p className="text-2xl font-black text-white">{likesReceived ?? 0}</p>
              <p className="text-xs text-prose-faint mt-1">Content Likes</p>
            </div>
          )}
          {isAuthor && ((draftCount ?? 0) > 0 || (awaitingCount ?? 0) > 0) && (
            <div className="col-span-2 sm:col-span-3 pt-4 border-t border-soft flex items-center justify-center gap-3 flex-wrap">
              {(draftCount ?? 0) > 0 && (
                <Link
                  href="/dashboard/reviews"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-raised border border-strong hover:border-gray-500 rounded-lg text-xs font-medium text-gray-300 hover:text-white transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                  {draftCount} Draft{draftCount !== 1 ? 's' : ''} →
                </Link>
              )}
              {(awaitingCount ?? 0) > 0 && (
                <Link
                  href="/dashboard/reviews"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-950/50 border border-yellow-900/60 hover:border-yellow-700 rounded-lg text-xs font-medium text-yellow-400 hover:text-yellow-300 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 shrink-0" />
                  {awaitingCount} Pending Approval →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Liked content — browsable history */}
      <div className="bg-surface border border-soft rounded-2xl p-6 mb-6">
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">
          Liked Content
        </p>

        {!hasLikedContent ? (
          <p className="text-sm text-prose-faint text-center py-4">
            Nothing liked yet — heart a review or article and it will appear here.
          </p>
        ) : (
          <div className="space-y-1">
            {orderedLikedReviews.map((r) => r && (
              <Link
                key={r.id}
                href={`/reviews/${r.slug}`}
                className="flex items-center gap-3 p-3 bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-xl transition-colors group"
              >
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent-tint/60 text-accent-text-soft border border-accent-border/60 shrink-0">
                  Review
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-300 group-hover:text-white transition-colors truncate">
                    {r.title}
                  </p>
                  <p className="text-xs text-prose-faint truncate">{r.product_name}</p>
                </div>
                <svg className="w-4 h-4 text-gray-700 group-hover:text-accent-text-soft shrink-0 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}

            {orderedLikedArticles.map((a) => a && (
              <Link
                key={a.id}
                href={`/guides/${a.slug}`}
                className="flex items-center gap-3 p-3 bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-xl transition-colors group"
              >
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950/60 text-blue-400 border border-blue-900/60 shrink-0">
                  Article
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-300 group-hover:text-white transition-colors truncate">
                    {a.title}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-700 group-hover:text-accent-text-soft shrink-0 ml-auto transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Author/Admin — public profile + content management */}
      {isAuthor && (
        <div className="bg-surface border border-soft rounded-2xl p-6 mb-6">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Content</p>
          <div className="space-y-2">
            <Link
              href={`/author/${profile?.username}`}
              target="_blank"
              className="flex items-center justify-between p-3 bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-xl transition-colors group"
            >
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                View public author profile
              </span>
              <svg className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
            <Link
              href="/dashboard/reviews"
              className="flex items-center justify-between p-3 bg-surface-sunken border border-soft hover:border-strong rounded-xl transition-colors group"
            >
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Manage reviews</span>
              <svg className="w-4 h-4 text-prose-faint group-hover:text-prose-muted transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/dashboard/guides"
              className="flex items-center justify-between p-3 bg-surface-sunken border border-soft hover:border-strong rounded-xl transition-colors group"
            >
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Manage guides</span>
              <svg className="w-4 h-4 text-prose-faint group-hover:text-prose-muted transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* Danger zone — only when account is currently active */}
      {accountStatus === 'active' && (
        <AccountDeletion
          accountStatus={accountStatus}
          deletionDate={deletionDate}
          hasPublishedContent={hasPublishedContent}
        />
      )}

      {/* Admin quick links */}
      {isAdmin && (
        <div className="bg-surface border border-soft rounded-2xl p-6">
          <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-4">Admin</p>
          <div className="space-y-2">
            <Link
              href="/dashboard/moderation"
              className="flex items-center justify-between p-3 bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-xl transition-colors group"
            >
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Moderation queue</span>
              <svg className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/dashboard/users"
              className="flex items-center justify-between p-3 bg-surface-sunken border border-soft hover:border-accent-border/50 rounded-xl transition-colors group"
            >
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">User management</span>
              <svg className="w-4 h-4 text-prose-faint group-hover:text-accent-text-soft transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}

    </div>
  )
}

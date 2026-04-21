import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import EditUsernameForm from './_components/EditUsernameForm'
import EditEmailForm from './_components/EditEmailForm'

const ROLE_CONFIG: Record<string, { label: string; className: string }> = {
  admin:  { label: 'Admin',  className: 'bg-orange-950/60 text-orange-400 border border-orange-900/60' },
  author: { label: 'Author', className: 'bg-blue-950/60 text-blue-400 border border-blue-900/60' },
  member: { label: 'Member', className: 'bg-gray-800 text-gray-400 border border-gray-700' },
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, role, created_at')
    .eq('id', user!.id)
    .single()

  const role     = profile?.role ?? 'member'
  const isAdmin  = role === 'admin'
  const isAuthor = role === 'author' || isAdmin
  const roleCfg  = ROLE_CONFIG[role] ?? ROLE_CONFIG.member

  // Fetch all stats in parallel
  const [
    { count: reviewCount },
    { count: articleCount },
    { count: commentCount },
    { count: pendingCount },
    { data: myReviewIds },
    { data: myArticleIds },
    { data: myCommentIds },
  ] = await Promise.all([
    supabase.from('reviews').select('id', { count: 'exact', head: true })
      .eq('author_id', user!.id).eq('status', 'approved'),
    supabase.from('articles').select('id', { count: 'exact', head: true })
      .eq('author_id', user!.id).eq('status', 'approved'),
    supabase.from('comments').select('id', { count: 'exact', head: true })
      .eq('author_id', user!.id),
    supabase.from('reviews').select('id', { count: 'exact', head: true })
      .eq('author_id', user!.id).in('status', ['draft', 'pending', 'rejected']),
    supabase.from('reviews').select('id').eq('author_id', user!.id),
    supabase.from('articles').select('id').eq('author_id', user!.id),
    supabase.from('comments').select('id').eq('author_id', user!.id),
  ])

  const allContentIds = [
    ...(myReviewIds?.map(r => r.id) ?? []),
    ...(myArticleIds?.map(a => a.id) ?? []),
  ]
  const myCommentIdList = myCommentIds?.map(c => c.id) ?? []

  const [{ count: likesReceived }, { count: commentLikesReceived }, { count: sharesReceived }] = await Promise.all([
    allContentIds.length
      ? supabase.from('likes').select('id', { count: 'exact', head: true })
          .in('content_type', ['review', 'article']).in('content_id', allContentIds)
      : Promise.resolve({ count: 0 }),
    myCommentIdList.length
      ? supabase.from('likes').select('id', { count: 'exact', head: true })
          .eq('content_type', 'comment').in('content_id', myCommentIdList)
      : Promise.resolve({ count: 0 }),
    myCommentIdList.length
      ? supabase.from('comment_shares').select('id', { count: 'exact', head: true }).in('comment_id', myCommentIdList)
      : Promise.resolve({ count: 0 }),
  ])

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <div className="p-8 max-w-2xl">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and view your activity</p>
      </div>

      {/* Identity card */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-orange-600 flex items-center justify-center text-2xl font-black text-white shrink-0">
            {profile?.username?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-black text-lg">@{profile?.username}</p>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${roleCfg.className}`}>
                {roleCfg.label}
              </span>
            </div>
            {memberSince && (
              <p className="text-sm text-gray-500 mt-0.5">Member since {memberSince}</p>
            )}
          </div>
        </div>

        <EditUsernameForm current={profile?.username ?? ''} />

        {/* Email */}
        <div className="mt-5 pt-5 border-t border-gray-800">
          <label className="block text-xs text-gray-500 uppercase tracking-widest mb-2">Email</label>
          <EditEmailForm current={user!.email ?? ''} />
        </div>
      </div>

      {/* Activity stats */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Activity</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {isAuthor && (
            <>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{reviewCount ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Published Reviews</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-black text-white">{articleCount ?? 0}</p>
                <p className="text-xs text-gray-500 mt-1">Published Articles</p>
              </div>
            </>
          )}
          <div className="text-center">
            <p className="text-2xl font-black text-white">{commentCount ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Comments Left</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-red-400">{commentLikesReceived ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Comment Likes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-orange-400">{sharesReceived ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">Comments Shared</p>
          </div>
          {isAuthor && (
            <div className="text-center">
              <p className="text-2xl font-black text-white">{likesReceived ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">Content Likes</p>
            </div>
          )}
          {isAuthor && (pendingCount ?? 0) > 0 && (
            <div className="col-span-2 sm:col-span-4 pt-4 border-t border-gray-800 text-center">
              <p className="text-sm text-yellow-400 font-semibold">
                {pendingCount} item{pendingCount !== 1 ? 's' : ''} in draft / pending / rejected
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Author/Admin — public profile + quick content links */}
      {isAuthor && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Content</p>
          <div className="space-y-2">
            <Link
              href={`/author/${profile?.username}`}
              target="_blank"
              className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 hover:border-orange-700/50 rounded-xl transition-colors group"
            >
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                View public author profile
              </span>
              <svg className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
            <Link
              href="/dashboard/reviews"
              className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-xl transition-colors group"
            >
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Manage reviews</span>
              <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/dashboard/articles"
              className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 hover:border-gray-700 rounded-xl transition-colors group"
            >
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Manage articles</span>
              <svg className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* Admin quick links */}
      {isAdmin && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Admin</p>
          <div className="space-y-2">
            <Link
              href="/dashboard/moderation"
              className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 hover:border-orange-700/50 rounded-xl transition-colors group"
            >
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Moderation queue</span>
              <svg className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/dashboard/users"
              className="flex items-center justify-between p-3 bg-gray-950 border border-gray-800 hover:border-orange-700/50 rounded-xl transition-colors group"
            >
              <span className="text-sm text-gray-300 group-hover:text-white transition-colors">User management</span>
              <svg className="w-4 h-4 text-gray-600 group-hover:text-orange-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}

    </div>
  )
}

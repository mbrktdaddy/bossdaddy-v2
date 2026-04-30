import { createAdminClient } from '@/lib/supabase/admin'
import { HomeStats } from './_components/HomeStats'
import { QuickActions } from './_components/QuickActions'
import { AttentionFeed } from './_components/AttentionFeed'
import { ExportButton } from './_components/ExportButton'
import { TopPerformers } from './_components/TopPerformers'

export default async function DashboardHome() {
  const admin = createAdminClient()

  // Pull aggregate counts + pending items in parallel
  const [
    { data: articles },
    { data: reviews },
    { count: pendingComments },
    { count: mediaCount },
    { data: latestPendingComments },
  ] = await Promise.all([
    admin.from('guides').select('id, title, slug, category, status, moderation_score, moderation_flags, created_at, view_count, published_at, image_url').order('created_at', { ascending: false }).limit(300),
    admin.from('reviews').select('id, title, slug, category, status, moderation_score, moderation_flags, created_at, view_count, published_at, image_url').order('created_at', { ascending: false }).limit(300),
    admin.from('comments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('media_assets').select('id', { count: 'exact', head: true }),
    admin.from('comments').select('id, body, created_at, profiles(username)').eq('status', 'pending').order('created_at', { ascending: false }).limit(1),
  ])

  const articlesTyped = articles ?? []
  const reviewsTyped = reviews ?? []

  const counts = {
    articles: {
      total:   articlesTyped.length,
      live:    articlesTyped.filter((a) => a.status === 'approved').length,
      pending: articlesTyped.filter((a) => a.status === 'pending').length,
      draft:   articlesTyped.filter((a) => ['draft', 'rejected'].includes(a.status)).length,
    },
    reviews: {
      total:   reviewsTyped.length,
      live:    reviewsTyped.filter((r) => r.status === 'approved').length,
      pending: reviewsTyped.filter((r) => r.status === 'pending').length,
      draft:   reviewsTyped.filter((r) => ['draft', 'rejected'].includes(r.status)).length,
    },
    comments: { pending: pendingComments ?? 0 },
    media:    { total:   mediaCount ?? 0 },
    flagged:
      articlesTyped.filter((a) => a.status === 'pending' && (a.moderation_score ?? 0) >= 0.7).length +
      reviewsTyped.filter((r) => r.status === 'pending' && (r.moderation_score ?? 0) >= 0.7).length,
  }

  // Build the "needs attention" feed — pending items sorted by risk score desc then newest first
  const pendingArticles = articlesTyped
    .filter((a) => a.status === 'pending')
    .map((a) => ({ ...a, type: 'guide' as const, moderation_flags: (a.moderation_flags ?? []) as string[] }))
  const pendingReviews = reviewsTyped
    .filter((r) => r.status === 'pending')
    .map((r) => ({ ...r, type: 'review' as const, moderation_flags: (r.moderation_flags ?? []) as string[] }))
  const pendingItems = [...pendingArticles, ...pendingReviews]
    .sort((a, b) => {
      const scoreDiff = (b.moderation_score ?? 0) - (a.moderation_score ?? 0)
      if (scoreDiff !== 0) return scoreDiff
      return new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime()
    })
    .slice(0, 10)

  // Top performers — approved content sorted by view_count desc
  const topPerformers = [
    ...articlesTyped.filter((a) => a.status === 'approved').map((a) => ({
      id: a.id, title: a.title, slug: (a as unknown as { slug: string }).slug, category: a.category,
      view_count: (a as unknown as { view_count: number | null }).view_count,
      image_url: (a as unknown as { image_url: string | null }).image_url,
      type: 'guide' as const,
      published_at: (a as unknown as { published_at: string | null }).published_at,
    })),
    ...reviewsTyped.filter((r) => r.status === 'approved').map((r) => ({
      id: r.id, title: r.title, slug: (r as unknown as { slug: string }).slug, category: r.category,
      view_count: (r as unknown as { view_count: number | null }).view_count,
      image_url: (r as unknown as { image_url: string | null }).image_url,
      type: 'review' as const,
      published_at: (r as unknown as { published_at: string | null }).published_at,
    })),
  ]
    .sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))

  return (
    <div className="p-4 sm:p-8 max-w-6xl space-y-8">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black">Welcome back, Boss.</h1>
          <p className="text-gray-500 text-sm mt-1">Here&apos;s what&apos;s happening with your site.</p>
        </div>
        <ExportButton />
      </div>

      {/* Stats */}
      <section className="space-y-3">
        <p className="text-xs text-gray-600 font-medium uppercase tracking-widest">At a Glance</p>
        <HomeStats counts={counts} />
      </section>

      {/* Attention feed — first so urgent items are visible without scrolling */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-600 font-medium uppercase tracking-widest">Needs Your Attention</p>
          {pendingItems.length > 0 && (
            <span className="text-xs text-gray-500">{pendingItems.length} pending</span>
          )}
        </div>
        <AttentionFeed
          pendingItems={pendingItems}
          pendingComments={(latestPendingComments ?? []).map((c) => {
            const p = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles
            return { id: c.id, body: c.body, created_at: c.created_at, profiles: p ?? null }
          })}
        />
      </section>

      {/* Quick actions */}
      <section className="space-y-3">
        <p className="text-xs text-gray-600 font-medium uppercase tracking-widest">Quick Actions</p>
        <QuickActions />
      </section>

      {/* Top performers */}
      <section className="space-y-3">
        <p className="text-xs text-gray-600 font-medium uppercase tracking-widest">Top Performing</p>
        <TopPerformers items={topPerformers} />
      </section>

    </div>
  )
}

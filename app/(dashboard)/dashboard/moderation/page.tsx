import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug } from '@/lib/categories'
import { UnpublishButton, VisibilityToggle, CommentModerationActions } from './_components/ModerationActions'

interface Props {
  searchParams: Promise<{ tab?: string; risk?: string }>
}

function RiskBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="hidden sm:inline text-xs text-gray-600 font-mono">—</span>

  const level = score >= 0.7 ? 'high' : score >= 0.4 ? 'medium' : 'low'
  const config = {
    high:   { label: 'High Risk', dot: 'bg-red-500',    text: 'text-red-400',    bg: 'bg-red-950/40 border-red-900/60' },
    medium: { label: 'Review',    dot: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-950/40 border-yellow-900/60' },
    low:    { label: 'Low Risk',  dot: 'bg-green-500',  text: 'text-green-400',  bg: 'bg-green-950/40 border-green-900/60' },
  }[level]

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5 rounded-xl border ${config.bg}`}>
      <div className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`} />
      <span className={`hidden sm:inline text-xs font-semibold ${config.text}`}>{config.label}</span>
      <span className={`hidden sm:inline text-xs font-mono ${config.text} opacity-70`}>{score.toFixed(2)}</span>
    </div>
  )
}

export default async function ModerationQueuePage({ searchParams }: Props) {
  const { tab, risk } = await searchParams
  const isPublished = tab === 'published'
  const isComments  = tab === 'comments'
  const isPending   = !isPublished && !isComments
  const supabase = await createClient()

  // ── Pending tab data ──────────────────────────────────────────────────
  const { data: queue } = isPending ? await supabase
    .from('reviews')
    .select('id, title, product_name, category, moderation_score, moderation_flags, created_at, profiles(username)')
    .eq('status', 'pending')
    .order('moderation_score', { ascending: false }) : { data: null }

  const { data: pendingArticles } = isPending ? await supabase
    .from('articles')
    .select('id, title, category, moderation_score, moderation_flags, created_at, profiles(username)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) : { data: null }

  // ── Published tab data ────────────────────────────────────────────────
  const { data: liveReviews } = isPublished ? await supabase
    .from('reviews')
    .select('id, title, product_name, category, is_visible, published_at')
    .eq('status', 'approved')
    .order('published_at', { ascending: false }) : { data: null }

  const { data: liveArticles } = isPublished ? await supabase
    .from('articles')
    .select('id, title, category, is_visible, published_at')
    .eq('status', 'approved')
    .order('published_at', { ascending: false }) : { data: null }

  // ── Comments tab data ─────────────────────────────────────────────────
  const { data: pendingComments } = isComments ? await supabase
    .from('comments')
    .select('id, body, content_type, content_id, created_at, profiles(username)')
    .eq('status', 'pending')
    .order('created_at', { ascending: true }) : { data: null }

  const reviewIds  = pendingComments?.filter(c => c.content_type === 'review').map(c => c.content_id)  ?? []
  const articleIds = pendingComments?.filter(c => c.content_type === 'article').map(c => c.content_id) ?? []

  const [{ data: reviewTitles }, { data: articleTitles }] = await Promise.all([
    reviewIds.length  ? supabase.from('reviews').select('id, title, slug').in('id', reviewIds)   : Promise.resolve({ data: [] }),
    articleIds.length ? supabase.from('articles').select('id, title, slug').in('id', articleIds) : Promise.resolve({ data: [] }),
  ])

  const contentMap = new Map<string, { title: string; slug: string; type: string }>([
    ...(reviewTitles  ?? []).map(r => [r.id, { title: r.title, slug: r.slug, type: 'review' }]  as [string, { title: string; slug: string; type: string }]),
    ...(articleTitles ?? []).map(a => [a.id, { title: a.title, slug: a.slug, type: 'article' }] as [string, { title: string; slug: string; type: string }]),
  ])

  const highRisk     = queue?.filter(r => (r.moderation_score ?? 0) >= 0.7).length ?? 0
  const pending      = (queue?.length ?? 0) + (pendingArticles?.length ?? 0)
  const commentCount = pendingComments?.length ?? 0

  // Apply risk filter to displayed queue items
  const displayedReviews  = risk === 'high'   ? queue?.filter(r => (r.moderation_score ?? 0) >= 0.7)
    : risk === 'review' ? queue?.filter(r => (r.moderation_score ?? 0) < 0.7)
    : queue
  const displayedArticles = risk === 'high'   ? pendingArticles?.filter(a => (a.moderation_score ?? 0) >= 0.7)
    : risk === 'review' ? pendingArticles?.filter(a => (a.moderation_score ?? 0) < 0.7)
    : pendingArticles

  return (
    <div className="p-4 sm:p-8 max-w-5xl">

      {/* Header */}
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl font-black">Moderation</h1>
        <p className="text-gray-500 text-sm mt-1">Review queue and published content management</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 sm:mb-8 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit min-w-max">
          <Link
            href="/dashboard/moderation"
            className={`px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              isPending ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Pending
            {pending > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-orange-600 text-white rounded-full">{pending}</span>
            )}
          </Link>
          <Link
            href="/dashboard/moderation?tab=published"
            className={`px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              isPublished ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Published
          </Link>
          <Link
            href="/dashboard/moderation?tab=comments"
            className={`px-4 sm:px-5 py-2 rounded-lg text-sm font-semibold transition-colors whitespace-nowrap ${
              isComments ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Comments
            {commentCount > 0 && (
              <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded-full">{commentCount}</span>
            )}
          </Link>
        </div>
      </div>

      {/* ── PENDING TAB ──────────────────────────────────────────────────── */}
      {isPending && (
        <>
          {/* Stats — clickable risk filters */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {[
              { label: 'All Pending', value: pending,          color: 'text-white',        riskKey: null },
              { label: 'High Risk',   value: highRisk,         color: 'text-red-400',      riskKey: 'high' },
              { label: 'To Review',   value: pending - highRisk, color: 'text-yellow-400', riskKey: 'review' },
            ].map((s) => {
              const isActive = risk === s.riskKey || (!risk && s.riskKey === null)
              const href = isActive && s.riskKey !== null
                ? '/dashboard/moderation'
                : s.riskKey ? `/dashboard/moderation?risk=${s.riskKey}` : '/dashboard/moderation'
              return (
                <Link
                  key={s.label}
                  href={href}
                  className={`block bg-gray-900 rounded-2xl px-3 py-3 sm:px-5 sm:py-4 border transition-colors ${
                    isActive ? 'border-orange-600 bg-orange-950/20' : 'border-gray-800 hover:border-gray-600'
                  }`}
                >
                  <p className={`text-xl sm:text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{s.label}</p>
                </Link>
              )
            })}
          </div>
          {risk && (
            <div className="flex items-center gap-2 mb-4">
              <p className="text-sm text-gray-500">
                Filtering: <span className="text-orange-400 font-medium">{risk === 'high' ? 'High Risk' : 'To Review'}</span>
              </p>
              <Link href="/dashboard/moderation" className="text-xs text-gray-600 hover:text-gray-400 underline">clear</Link>
            </div>
          )}

          {!displayedReviews?.length && !displayedArticles?.length ? (
            <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-gray-400 font-semibold">{risk ? 'No items match this filter.' : 'Queue is clear.'}</p>
              <p className="text-gray-600 text-sm mt-1">{risk ? '' : 'Nice work, Boss.'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Pending reviews — link to detail page */}
              {displayedReviews?.map((r) => {
                const score = r.moderation_score ? Number(r.moderation_score) : null
                const category = getCategoryBySlug(r.category)
                const author = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles as unknown as { username: string } | null)?.username ?? 'unknown'
                const flags = (r.moderation_flags as string[]) ?? []
                const barColor = score === null ? 'bg-gray-700' : score >= 0.7 ? 'bg-red-500' : score >= 0.4 ? 'bg-yellow-500' : 'bg-green-500'

                return (
                  <Link
                    key={r.id}
                    href={`/dashboard/moderation/${r.id}`}
                    className="flex items-start gap-3 p-3 sm:p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-gray-700 transition-colors"
                  >
                    <div className={`w-1 self-stretch rounded-full shrink-0 mt-1 ${barColor}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-sm">{r.title}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-950/40 text-orange-400 border border-orange-900/30 shrink-0">Review</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-500">{r.product_name}</span>
                            <span className="text-xs text-gray-700">by @{author}</span>
                            {category && (
                              <span className={`text-xs ${category.accent}`}>{category.icon} {category.label}</span>
                            )}
                          </div>
                          {flags.length > 0 && (
                            <p className="text-xs text-red-400/70 mt-1">
                              ⚑ {flags.slice(0, 2).join(' · ')}{flags.length > 2 ? ` +${flags.length - 2} more` : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <RiskBadge score={score} />
                          <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}

              {/* Pending articles — link to detail page */}
              {displayedArticles?.map((a) => {
                const score = a.moderation_score ? Number(a.moderation_score) : null
                const category = getCategoryBySlug(a.category)
                const author = (Array.isArray(a.profiles) ? a.profiles[0] : a.profiles as unknown as { username: string } | null)?.username ?? 'unknown'
                const flags = (a.moderation_flags as string[]) ?? []
                const barColor = score === null ? 'bg-gray-700' : score >= 0.7 ? 'bg-red-500' : score >= 0.4 ? 'bg-yellow-500' : 'bg-green-500'

                return (
                  <Link
                    key={a.id}
                    href={`/dashboard/moderation/articles/${a.id}`}
                    className="flex items-start gap-3 p-3 sm:p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-gray-700 transition-colors"
                  >
                    <div className={`w-1 self-stretch rounded-full shrink-0 mt-1 ${barColor}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-semibold text-sm">{a.title}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-400 border border-blue-900/30 shrink-0">Article</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs text-gray-700">by @{author}</span>
                            {category && (
                              <span className={`text-xs ${category.accent}`}>{category.icon} {category.label}</span>
                            )}
                          </div>
                          {flags.length > 0 && (
                            <p className="text-xs text-red-400/70 mt-1">
                              ⚑ {flags.slice(0, 2).join(' · ')}{flags.length > 2 ? ` +${flags.length - 2} more` : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <RiskBadge score={score} />
                          <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── PUBLISHED TAB ────────────────────────────────────────────────── */}
      {isPublished && (
        <div className="space-y-2">
          {/* Reviews */}
          {liveReviews?.map((r) => {
            const category = getCategoryBySlug(r.category)
            return (
              <div
                key={r.id}
                className="flex items-start gap-3 p-3 sm:p-4 bg-gray-900 border border-gray-800 rounded-2xl"
              >
                <div className="w-1 self-stretch rounded-full shrink-0 mt-1 bg-orange-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm">{r.title}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-950/40 text-orange-400 border border-orange-900/30 shrink-0">Review</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-gray-500">{r.product_name}</span>
                        {category && (
                          <span className={`text-xs ${category.accent}`}>{category.icon} {category.label}</span>
                        )}
                        {r.published_at && (
                          <span className="text-xs text-gray-700">
                            {new Date(r.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <VisibilityToggle id={r.id} type="review" isVisible={r.is_visible ?? true} />
                      <UnpublishButton id={r.id} type="review" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Articles */}
          {liveArticles?.map((a) => {
            const category = getCategoryBySlug(a.category)
            return (
              <div
                key={a.id}
                className="flex items-start gap-3 p-3 sm:p-4 bg-gray-900 border border-gray-800 rounded-2xl"
              >
                <div className="w-1 self-stretch rounded-full shrink-0 mt-1 bg-blue-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm">{a.title}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-950/40 text-blue-400 border border-blue-900/30 shrink-0">Article</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {category && (
                          <span className={`text-xs ${category.accent}`}>{category.icon} {category.label}</span>
                        )}
                        {a.published_at && (
                          <span className="text-xs text-gray-700">
                            {new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <VisibilityToggle id={a.id} type="article" isVisible={a.is_visible ?? true} />
                      <UnpublishButton id={a.id} type="article" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}

          {!liveReviews?.length && !liveArticles?.length && (
            <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
              <p className="text-gray-400 font-semibold">Nothing published yet.</p>
            </div>
          )}
        </div>
      )}

      {/* ── COMMENTS TAB ─────────────────────────────────────────────────── */}
      {isComments && (
        <div className="space-y-2">
          {!pendingComments?.length ? (
            <div className="text-center py-24 border border-dashed border-gray-800 rounded-2xl">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-gray-400 font-semibold">No pending comments.</p>
            </div>
          ) : (
            pendingComments.map((c) => {
              const author  = (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles as unknown as { username: string } | null)?.username ?? 'unknown'
              const content = contentMap.get(c.content_id)
              const href    = content ? `/${content.type}s/${content.slug}` : null
              return (
                <div key={c.id} className="p-3 sm:p-4 bg-gray-900 border border-gray-800 rounded-2xl">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                      c.content_type === 'review'
                        ? 'bg-orange-950/40 text-orange-400 border-orange-900/30'
                        : 'bg-blue-950/40 text-blue-400 border-blue-900/30'
                    }`}>
                      {c.content_type === 'review' ? 'Review' : 'Article'}
                    </span>
                    <span className="text-xs text-gray-500">by @{author}</span>
                    <span className="text-xs text-gray-700">
                      {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  {content && href && (
                    <Link
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-400 hover:text-orange-400 transition-colors truncate block mb-2"
                    >
                      ↗ {content.title}
                    </Link>
                  )}
                  <p className="text-sm text-gray-300 leading-relaxed line-clamp-3 mb-3">{c.body}</p>
                  <CommentModerationActions id={c.id} />
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

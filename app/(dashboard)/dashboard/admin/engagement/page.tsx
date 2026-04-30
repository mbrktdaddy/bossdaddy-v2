import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import { getCategoryBySlug } from '@/lib/categories'

export const dynamic = 'force-dynamic'

interface ContentRow {
  id: string
  type: 'article' | 'review'
  title: string
  slug: string
  category: string
  view_count: number
  scroll_25_count: number
  scroll_50_count: number
  scroll_75_count: number
  scroll_100_count: number
  published_at: string | null
  click_count: number
}

export default async function EngagementPage() {
  await requireAdmin()

  const admin = createAdminClient()

  const [
    { data: articles },
    { data: reviews },
    { data: clicks },
    { data: recentClicks },
  ] = await Promise.all([
    admin.from('guides')
      .select('id, title, slug, category, view_count, scroll_25_count, scroll_50_count, scroll_75_count, scroll_100_count, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true),
    admin.from('reviews')
      .select('id, title, slug, category, view_count, scroll_25_count, scroll_50_count, scroll_75_count, scroll_100_count, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true),
    admin.from('affiliate_clicks')
      .select('content_type, content_id, product_slug'),
    admin.from('affiliate_clicks')
      .select('product_slug, destination_url, clicked_at, content_type, content_id')
      .order('clicked_at', { ascending: false })
      .limit(15),
  ])

  // Click counts per content
  const clicksByContent = new Map<string, number>()
  const clicksByProduct = new Map<string, number>()
  for (const c of clicks ?? []) {
    const k = `${c.content_type}:${c.content_id}`
    clicksByContent.set(k, (clicksByContent.get(k) ?? 0) + 1)
    if (c.product_slug) {
      clicksByProduct.set(c.product_slug, (clicksByProduct.get(c.product_slug) ?? 0) + 1)
    }
  }

  const rows: ContentRow[] = [
    ...((articles ?? []) as Omit<ContentRow, 'type' | 'click_count'>[]).map((a) => ({
      ...a,
      type: 'article' as const,
      click_count: clicksByContent.get(`article:${a.id}`) ?? 0,
    })),
    ...((reviews ?? []) as Omit<ContentRow, 'type' | 'click_count'>[]).map((r) => ({
      ...r,
      type: 'review' as const,
      click_count: clicksByContent.get(`review:${r.id}`) ?? 0,
    })),
  ].sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))

  // Aggregate totals
  const totalViews = rows.reduce((s, r) => s + (r.view_count ?? 0), 0)
  const totalScroll100 = rows.reduce((s, r) => s + (r.scroll_100_count ?? 0), 0)
  const totalClicks = (clicks ?? []).length
  const overallCompletion = totalViews > 0 ? Math.round((totalScroll100 / totalViews) * 100) : 0

  // Top products by clicks
  const productLeaderboard = Array.from(clicksByProduct.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  return (
    <div className="p-8 max-w-6xl">

      <div className="mb-8">
        <h1 className="text-2xl font-black">Engagement</h1>
        <p className="text-gray-500 text-sm mt-1">
          Scroll completion + affiliate click attribution per piece of content.
        </p>
      </div>

      {/* Top-line stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <Stat label="Total views"            value={totalViews.toLocaleString()} />
        <Stat label="100% completions"       value={totalScroll100.toLocaleString()} />
        <Stat label="Avg completion"         value={`${overallCompletion}%`} />
        <Stat label="Affiliate clicks"       value={totalClicks.toLocaleString()} />
      </div>

      {/* Per-content table */}
      <div className="mb-10 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <p className="text-sm font-semibold">Per-content engagement</p>
          <p className="text-xs text-gray-600 mt-0.5">Sorted by views. Completion = % of viewers who scrolled to the end.</p>
        </div>
        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-gray-500 text-sm">No published content yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-950/40 text-xs uppercase tracking-widest text-gray-500">
                <tr>
                  <th className="text-left  px-5 py-2.5 font-semibold">Title</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Views</th>
                  <th className="text-right px-3 py-2.5 font-semibold">25%</th>
                  <th className="text-right px-3 py-2.5 font-semibold">50%</th>
                  <th className="text-right px-3 py-2.5 font-semibold">75%</th>
                  <th className="text-right px-3 py-2.5 font-semibold">100%</th>
                  <th className="text-right px-3 py-2.5 font-semibold">Done %</th>
                  <th className="text-right px-5 py-2.5 font-semibold">Clicks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map((r) => {
                  const cat = getCategoryBySlug(r.category)
                  const completion = (r.view_count ?? 0) > 0
                    ? Math.round(((r.scroll_100_count ?? 0) / r.view_count) * 100)
                    : 0
                  return (
                    <tr key={`${r.type}-${r.id}`} className="hover:bg-gray-950/40">
                      <td className="px-5 py-2.5 max-w-md">
                        <Link
                          href={r.type === 'article' ? `/guides/${r.slug}` : `/reviews/${r.slug}`}
                          className="text-gray-200 hover:text-orange-400 truncate block"
                        >
                          {r.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-orange-500/80 uppercase tracking-widest">
                            {r.type}
                          </span>
                          {cat && <span className="text-[10px] text-gray-600">{cat.icon} {cat.label}</span>}
                        </div>
                      </td>
                      <td className="text-right px-3 py-2.5 text-gray-300 font-mono">{(r.view_count ?? 0).toLocaleString()}</td>
                      <td className="text-right px-3 py-2.5 text-gray-500 font-mono text-xs">{(r.scroll_25_count  ?? 0).toLocaleString()}</td>
                      <td className="text-right px-3 py-2.5 text-gray-500 font-mono text-xs">{(r.scroll_50_count  ?? 0).toLocaleString()}</td>
                      <td className="text-right px-3 py-2.5 text-gray-500 font-mono text-xs">{(r.scroll_75_count  ?? 0).toLocaleString()}</td>
                      <td className="text-right px-3 py-2.5 text-gray-300 font-mono">{(r.scroll_100_count ?? 0).toLocaleString()}</td>
                      <td className={`text-right px-3 py-2.5 font-mono font-semibold ${
                        completion >= 50 ? 'text-green-400' :
                        completion >= 25 ? 'text-yellow-400' :
                        'text-gray-500'
                      }`}>
                        {completion}%
                      </td>
                      <td className={`text-right px-5 py-2.5 font-mono font-semibold ${
                        (r.click_count ?? 0) > 0 ? 'text-orange-400' : 'text-gray-600'
                      }`}>
                        {r.click_count.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two-column lower section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Product leaderboard */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <p className="text-sm font-semibold">Top products by clicks</p>
            <p className="text-xs text-gray-600 mt-0.5">Across all content.</p>
          </div>
          {productLeaderboard.length === 0 ? (
            <p className="px-5 py-12 text-center text-gray-500 text-sm">No clicks recorded yet.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {productLeaderboard.map(([slug, count], i) => (
                <div key={slug} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-gray-600 font-mono w-5 text-right">{i + 1}.</span>
                    <code className="text-xs text-orange-400 truncate">{slug}</code>
                  </div>
                  <span className="text-sm text-gray-200 font-mono font-semibold">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent clicks */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <p className="text-sm font-semibold">Recent clicks</p>
            <p className="text-xs text-gray-600 mt-0.5">Last 15 affiliate link clicks.</p>
          </div>
          {(recentClicks ?? []).length === 0 ? (
            <p className="px-5 py-12 text-center text-gray-500 text-sm">No clicks yet.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {(recentClicks ?? []).map((c, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-xs text-orange-400 truncate">
                      {c.product_slug ?? '(unmatched)'}
                    </code>
                    <span className="text-[10px] text-gray-600 shrink-0">
                      {new Date(c.clicked_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600 truncate mt-0.5">{c.destination_url}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">{label}</p>
      <p className="text-2xl font-black text-white">{value}</p>
    </div>
  )
}

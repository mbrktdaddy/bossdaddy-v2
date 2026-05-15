import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RatingScore from '@/components/RatingScore'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import { getProductBySlug } from '@/lib/products'

export const revalidate = 60

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('collections')
    .select('slug')
    .eq('collection_type', 'comparison')
    .eq('is_visible', true)
  return (data ?? []).map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('collections')
    .select('title, description, meta_title, meta_description')
    .eq('slug', slug)
    .eq('collection_type', 'comparison')
    .eq('is_visible', true)
    .single()
  if (!data) return { title: 'Not Found' }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const metaTitle       = data.meta_title       ?? `${data.title} — Comparison`
  const metaDescription = data.meta_description ?? data.description ?? 'Head-to-head comparison from Boss Daddy.'
  return {
    title:       metaTitle,
    description: metaDescription,
    alternates:  { canonical: `${siteUrl}/comparisons/${slug}` },
    openGraph:   { title: metaTitle, description: metaDescription, url: `${siteUrl}/comparisons/${slug}` },
  }
}

type ReviewRow = {
  id: string
  slug: string
  title: string
  product_name: string
  rating: number | null
  excerpt: string | null
  image_url: string | null
  product_slug: string | null
  score_quality: number | null
  score_value: number | null
  score_ease: number | null
  score_daily_use: number | null
}

const SUBSCORE_ROWS: { key: 'score_quality' | 'score_value' | 'score_ease' | 'score_daily_use'; label: string }[] = [
  { key: 'score_quality',   label: 'Quality' },
  { key: 'score_value',     label: 'Value' },
  { key: 'score_ease',      label: 'Ease of Use' },
  { key: 'score_daily_use', label: 'Daily Use' },
]

export default async function ComparisonDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: comparison } = await supabase
    .from('collections')
    .select('id, slug, title, description, intro_html, hero_image_url, winner_summary, published_at')
    .eq('slug', slug)
    .eq('collection_type', 'comparison')
    .eq('is_visible', true)
    .single()

  if (!comparison) notFound()

  const admin = createAdminClient()
  const { data: rawItems } = await admin
    .from('collection_items')
    .select('position, blurb, wins_category, reviews(id, slug, title, product_name, rating, excerpt, image_url, product_slug, score_quality, score_value, score_ease, score_daily_use)')
    .eq('collection_id', comparison.id)
    .order('position')

  const items = (rawItems ?? []).map((it) => {
    const r = it.reviews
    const review = Array.isArray(r) ? r[0] : r
    return {
      position: it.position,
      blurb: it.blurb,
      wins_category: it.wins_category,
      review: review as ReviewRow | null,
    }
  }).filter((i) => i.review != null)

  // Fetch products for affiliate CTAs
  const productSlugs = [...new Set(items.map((i) => i.review?.product_slug).filter(Boolean) as string[])]
  const productMap = new Map<string, { slug: string; affiliate_url: string | null; non_affiliate_url: string | null }>()
  await Promise.all(productSlugs.map(async (ps) => {
    const product = await getProductBySlug(supabase, ps)
    if (product) productMap.set(ps, product)
  }))

  // Per sub-score row: which item has the highest value? Used to highlight winning cells.
  const rowWinners = new Map<string, number>() // key -> winning item index
  for (const { key } of SUBSCORE_ROWS) {
    let bestIdx = -1
    let bestVal = -Infinity
    items.forEach((it, idx) => {
      const v = it.review?.[key] ?? null
      if (v != null && v > bestVal) { bestVal = v; bestIdx = idx }
    })
    if (bestIdx !== -1) rowWinners.set(key, bestIdx)
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: comparison.title,
    description: comparison.description,
    datePublished: comparison.published_at,
    author: { '@type': 'Person', name: 'Boss Daddy' },
    publisher: { '@type': 'Organization', name: 'Boss Daddy Life', url: siteUrl },
    mainEntityOfPage: `${siteUrl}/comparisons/${slug}`,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-8">
          <Link href="/comparisons" className="hover:text-orange-400 transition-colors">Comparisons</Link>
          <span>/</span>
          <span className="text-gray-400">{comparison.title}</span>
        </div>

        {/* Hero image */}
        {comparison.hero_image_url && (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-10 bg-gray-900">
            <Image
              src={comparison.hero_image_url}
              alt={comparison.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1024px"
              priority
            />
          </div>
        )}

        {/* Header */}
        <div className="mb-10">
          <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">Comparison</p>
          <h1 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight leading-tight">{comparison.title}</h1>
          {comparison.description && (
            <p className="text-lg text-gray-400 leading-relaxed max-w-3xl">{comparison.description}</p>
          )}
        </div>

        {/* Bottom line — winner summary above everything else */}
        {comparison.winner_summary && (
          <section
            aria-label="Bottom line"
            className="mb-10 rounded-2xl border border-orange-900/40 bg-gradient-to-br from-orange-950/30 to-gray-900/60 ring-1 ring-inset ring-white/[0.02] p-5 sm:p-6"
          >
            <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">The Bottom Line</p>
            <p className="text-base sm:text-lg text-gray-100 leading-relaxed font-medium">{comparison.winner_summary}</p>
          </section>
        )}

        {/* Contender strip */}
        <section className="mb-10" aria-label="Contenders">
          <div className="mb-5">
            <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
            <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">The Contenders</p>
            <h2 className="text-2xl font-black text-white leading-tight">{items.length} on the scorecard</h2>
          </div>
          <div className={`grid gap-4 ${items.length <= 2 ? 'grid-cols-1 sm:grid-cols-2' : items.length === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5'}`}>
            {items.map(({ review, wins_category }) => {
              if (!review) return null
              return (
                <Link
                  key={review.id}
                  href={`/reviews/${review.slug}`}
                  className="group flex flex-col bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 hover:border-orange-900/40 hover:-translate-y-0.5 transition-all"
                >
                  <div className="relative w-full aspect-square bg-gray-950">
                    {review.image_url ? (
                      <Image src={review.image_url} alt={review.product_name} fill className="object-cover" sizes="200px" />
                    ) : null}
                    {(review.rating ?? 0) >= 8 && (
                      <div className="absolute top-2 right-2"><BossApprovedBadge size="sm" variant="card" /></div>
                    )}
                    {wins_category && (
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2.5 py-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300 leading-tight">{wins_category}</p>
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col flex-1">
                    <p className="text-xs text-gray-500 mb-1 truncate">{review.product_name}</p>
                    <p className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors line-clamp-2 leading-snug flex-1">{review.title}</p>
                    <div className="mt-2"><RatingScore rating={review.rating ?? 0} size="sm" /></div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>

        {/* Scorecard — head-to-head sub-scores */}
        {items.length >= 2 && (
          <section className="mb-12" aria-label="Scorecard">
            <div className="mb-5">
              <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
              <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">Head-to-head</p>
              <h2 className="text-2xl font-black text-white leading-tight">The Scorecard</h2>
            </div>
            <div className="overflow-x-auto -mx-6 px-6">
              <table className="w-full min-w-[600px] border-separate border-spacing-0 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] rounded-2xl overflow-hidden">
                <thead>
                  <tr>
                    <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-gray-500 font-semibold border-b border-gray-800/60">Criterion</th>
                    {items.map(({ review }) => (
                      <th key={review!.id} className="text-center px-4 py-3 text-xs uppercase tracking-widest text-orange-400 font-semibold border-b border-gray-800/60 min-w-[100px]">
                        <span className="line-clamp-2">{review!.product_name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SUBSCORE_ROWS.map(({ key, label }) => {
                    const winnerIdx = rowWinners.get(key)
                    return (
                      <tr key={key} className="border-t border-gray-800/40">
                        <td className="px-4 py-3 text-sm text-gray-300 font-medium border-t border-gray-800/40">{label}</td>
                        {items.map(({ review }, idx) => {
                          const v = review?.[key] ?? null
                          const isWinner = winnerIdx === idx && v != null
                          return (
                            <td
                              key={review!.id}
                              className={`px-4 py-3 text-center text-sm tabular-nums border-t border-gray-800/40 ${
                                isWinner ? 'bg-orange-600/15 text-orange-300 font-bold' : 'text-gray-300'
                              }`}
                            >
                              {v != null ? `${v}/10` : '—'}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  <tr className="border-t border-gray-800/60">
                    <td className="px-4 py-3 text-sm text-white font-black uppercase tracking-widest text-xs border-t border-gray-800/60">Overall</td>
                    {items.map(({ review }) => (
                      <td key={review!.id} className="px-4 py-3 text-center border-t border-gray-800/60">
                        <RatingScore rating={review!.rating ?? 0} size="sm" />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Editorial intro_html — long-form context */}
        {comparison.intro_html && (
          <section className="mb-12">
            <div
              className="prose prose-invert prose-orange max-w-none prose-p:text-gray-300 prose-p:leading-relaxed prose-strong:text-white prose-a:text-orange-400 hover:prose-a:text-orange-300 prose-a:no-underline"
              dangerouslySetInnerHTML={{ __html: comparison.intro_html }}
            />
          </section>
        )}

        {/* Per-product verdicts */}
        <section className="mb-12" aria-label="Per-product verdicts">
          <div className="mb-5">
            <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
            <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">The Breakdown</p>
            <h2 className="text-2xl font-black text-white leading-tight">Per-product verdicts</h2>
          </div>
          <div className="space-y-6">
            {items.map(({ review, blurb, wins_category }) => {
              if (!review) return null
              const product = review.product_slug ? productMap.get(review.product_slug) : null
              const href = product?.affiliate_url ? `/go/${product.slug}` : product?.non_affiliate_url ?? null
              return (
                <div key={review.id} className="flex flex-col sm:flex-row gap-5 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] hover:border-orange-900/40 rounded-2xl p-5 shadow-lg shadow-black/40 transition-colors">
                  {review.image_url && (
                    <div className="relative w-full sm:w-40 h-40 sm:h-32 shrink-0 rounded-xl overflow-hidden bg-gray-800">
                      <Image src={review.image_url} alt={review.product_name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 160px" />
                      {(review.rating ?? 0) >= 8 && (
                        <div className="absolute top-2 right-2"><BossApprovedBadge size="sm" variant="card" /></div>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col">
                    {wins_category && (
                      <span className="self-start text-[10px] font-bold uppercase tracking-widest text-orange-300 bg-orange-950/60 border border-orange-900/40 px-2.5 py-1 rounded-full mb-2">{wins_category}</span>
                    )}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-xs font-medium text-orange-500/80 uppercase tracking-widest mb-1">{review.product_name}</p>
                        <Link href={`/reviews/${review.slug}`} className="text-base font-bold text-white hover:text-orange-400 transition-colors leading-snug">
                          {review.title}
                        </Link>
                      </div>
                      <RatingScore rating={review.rating ?? 0} size="sm" />
                    </div>
                    {blurb && (
                      <p className="text-sm text-gray-400 leading-relaxed flex-1">{blurb}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      <Link href={`/reviews/${review.slug}`} className="text-xs text-gray-400 hover:text-orange-400 transition-colors font-semibold uppercase tracking-widest">
                        Read review →
                      </Link>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel={product?.affiliate_url ? 'sponsored nofollow noopener' : 'noopener'}
                          data-product-slug={review.product_slug ?? undefined}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-xl transition-colors min-h-[44px] flex items-center"
                        >
                          Check Price
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </>
  )
}

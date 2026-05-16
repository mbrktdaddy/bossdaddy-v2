import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RatingScore from '@/components/RatingScore'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import { getProductBySlug } from '@/lib/products'
import { getCategoryBySlug } from '@/lib/categories'
import ArticleTOC from '@/components/collections/ArticleTOC'
import EditorialMeta from '@/components/collections/EditorialMeta'
import MethodologyCallout from '@/components/collections/MethodologyCallout'
import FAQAccordion, { faqPageLd } from '@/components/collections/FAQAccordion'
import RelatedRail, { type RelatedItem } from '@/components/collections/RelatedRail'

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
  category: string | null
  rating: number | null
  excerpt: string | null
  tldr: string | null
  image_url: string | null
  product_slug: string | null
  pros: string[] | null
  cons: string[] | null
  key_takeaways: string[] | null
  best_for: string[] | null
  not_for: string[] | null
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
    .select('id, slug, title, description, intro_html, hero_image_url, winner_summary, published_at, updated_at')
    .eq('slug', slug)
    .eq('collection_type', 'comparison')
    .eq('is_visible', true)
    .single()

  if (!comparison) notFound()

  const admin = createAdminClient()
  const { data: rawItems } = await admin
    .from('collection_items')
    .select('position, blurb, wins_category, reviews(id, slug, title, product_name, category, rating, excerpt, tldr, image_url, product_slug, pros, cons, key_takeaways, best_for, not_for, score_quality, score_value, score_ease, score_daily_use)')
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

  // Affiliate CTAs + per-item price lookup
  const productSlugs = [...new Set(items.map((i) => i.review?.product_slug).filter(Boolean) as string[])]
  const productMap = new Map<string, { slug: string; affiliate_url: string | null; non_affiliate_url: string | null; price_cents: number | null }>()
  await Promise.all(productSlugs.map(async (ps) => {
    const product = await getProductBySlug(supabase, ps)
    if (product) productMap.set(ps, { slug: product.slug, affiliate_url: product.affiliate_url, non_affiliate_url: product.non_affiliate_url, price_cents: product.price_cents })
  }))

  // Dominant category among the items — drives methodology + FAQ + related selection
  const categoryCounts = new Map<string, number>()
  for (const it of items) {
    const c = it.review?.category
    if (c) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1)
  }
  const dominantCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const categoryDef = dominantCategory ? getCategoryBySlug(dominantCategory) : null

  // Per sub-score row: which item has the highest value?
  const rowWinners = new Map<string, number>()
  for (const { key } of SUBSCORE_ROWS) {
    let bestIdx = -1
    let bestVal = -Infinity
    items.forEach((it, idx) => {
      const v = it.review?.[key] ?? null
      if (v != null && v > bestVal) { bestVal = v; bestIdx = idx }
    })
    if (bestIdx !== -1) rowWinners.set(key, bestIdx)
  }

  // Related rail — 2 other comparisons + 1 pick + 1 stack, all visible.
  // Category matching would be nicer; for v1, recency is sufficient and
  // mixes flavors so the rail signals "more of this kind of work."
  const [
    { data: otherComparisons },
    { data: somePicks },
    { data: someStacks },
  ] = await Promise.all([
    admin.from('collections').select('slug, title, description, hero_image_url, collection_type').eq('collection_type', 'comparison').eq('is_visible', true).neq('id', comparison.id).order('published_at', { ascending: false }).limit(2),
    admin.from('collections').select('slug, title, description, hero_image_url, collection_type').in('collection_type', ['best_of', 'general']).eq('is_visible', true).order('published_at', { ascending: false }).limit(1),
    admin.from('collections').select('slug, title, description, hero_image_url, collection_type').eq('collection_type', 'stack').eq('is_visible', true).order('published_at', { ascending: false }).limit(1),
  ])
  const related: RelatedItem[] = [
    ...((otherComparisons ?? []) as RelatedItem[]),
    ...((somePicks       ?? []) as RelatedItem[]),
    ...((someStacks      ?? []) as RelatedItem[]),
  ]

  // TOC items in render order — must match the section ids below.
  const tocItems = [
    ...(comparison.winner_summary ? [{ id: 'bottom-line',  label: 'Bottom Line' }] : []),
    { id: 'contenders',  label: 'Contenders' },
    ...(categoryDef       ? [{ id: 'how-i-tested', label: 'How I Tested' }] : []),
    ...(items.length >= 2 ? [{ id: 'scorecard',    label: 'Scorecard' }] : []),
    ...(comparison.intro_html ? [{ id: 'overview', label: 'Overview' }] : []),
    ...items.map((it) => ({
      id:    `dive-${it.review!.slug}`,
      label: it.review!.product_name,
    })),
    ...(categoryDef?.faqs?.length ? [{ id: 'faq',     label: 'FAQ' }] : []),
    ...(related.length > 0        ? [{ id: 'related', label: 'Related' }] : []),
  ]

  // Reading time approximation — 235 wpm over intro + blurbs + winner.
  const wordsource = [
    comparison.intro_html ?? '',
    comparison.winner_summary ?? '',
    comparison.description ?? '',
    ...items.map((i) => i.blurb ?? i.review?.excerpt ?? ''),
  ].join(' ').replace(/<[^>]*>/g, ' ')
  const wordCount = wordsource.split(/\s+/).filter(Boolean).length
  const readingMinutes = Math.max(1, Math.round(wordCount / 235))

  const faqs = (categoryDef?.faqs ?? []).slice(0, 4)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  // ── JSON-LD: Article + ItemList + Review per product + FAQPage ────────────
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: comparison.title,
    description: comparison.description,
    datePublished: comparison.published_at,
    dateModified:  comparison.updated_at ?? comparison.published_at,
    author: { '@type': 'Person', name: 'Boss Daddy' },
    publisher: { '@type': 'Organization', name: 'Boss Daddy Life', url: siteUrl },
    mainEntityOfPage: `${siteUrl}/comparisons/${slug}`,
  }

  const itemListLd = items.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'ItemList',
    name:        comparison.title,
    description: comparison.description ?? undefined,
    numberOfItems: items.length,
    itemListElement: items.map((entry, idx) => ({
      '@type':   'ListItem',
      position:  idx + 1,
      url:       `${siteUrl}/reviews/${entry.review!.slug}`,
      name:      entry.review!.product_name,
      item: {
        '@type':         'Product',
        name:            entry.review!.product_name,
        image:           entry.review!.image_url ?? undefined,
        aggregateRating: entry.review!.rating != null ? {
          '@type':       'AggregateRating',
          ratingValue:   entry.review!.rating,
          bestRating:    10,
          worstRating:   1,
          ratingCount:   1,
        } : undefined,
      },
    })),
  } : null

  const faqLd = faqPageLd(faqs)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}
      {faqLd      && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-8">
          <Link href="/comparisons" className="hover:text-orange-400 transition-colors">Comparisons</Link>
          <span>/</span>
          <span className="text-gray-400">{comparison.title}</span>
        </div>

        <div className="lg:flex lg:gap-10 lg:items-start">
          <main className="lg:flex-1 lg:max-w-3xl min-w-0">
            {/* Editorial header — eyebrow + H1 + dek + byline */}
            <header className="mb-8">
              <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
              <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">Comparison</p>
              <h1 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight leading-tight">{comparison.title}</h1>
              {comparison.description && (
                <p className="text-lg text-gray-400 leading-relaxed mb-6">{comparison.description}</p>
              )}
              <EditorialMeta
                publishedAt={comparison.published_at}
                updatedAt={comparison.updated_at}
                readingMinutes={readingMinutes}
              />
            </header>

            {/* Mobile TOC pills */}
            <ArticleTOC items={tocItems} variant="mobile" />

            {/* Hero image */}
            {comparison.hero_image_url && (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-10 bg-gray-900">
                <Image
                  src={comparison.hero_image_url}
                  alt={comparison.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                  priority
                />
              </div>
            )}

            {/* Bottom Line */}
            {comparison.winner_summary && (
              <section
                id="bottom-line"
                aria-label="Bottom line"
                className="mb-12 rounded-2xl border border-orange-900/40 bg-gradient-to-br from-orange-950/30 to-gray-900/60 ring-1 ring-inset ring-white/[0.02] p-5 sm:p-7 shadow-lg shadow-black/40"
              >
                <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">The Bottom Line</p>
                <p className="text-base sm:text-lg text-gray-100 leading-relaxed font-medium">{comparison.winner_summary}</p>
                {/* Quick verdict chips per item */}
                {items.some((i) => i.wins_category) && (
                  <div className="mt-4 pt-4 border-t border-orange-900/30 flex flex-wrap gap-2">
                    {items.filter((i) => i.wins_category).map(({ review, wins_category }) => (
                      <a
                        key={review!.id}
                        href={`#dive-${review!.slug}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-900/60 border border-orange-900/40 hover:border-orange-700/60 rounded-full text-xs text-gray-300 hover:text-orange-300 transition-colors min-h-[36px]"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">{wins_category}</span>
                        <span className="font-semibold">{review!.product_name}</span>
                      </a>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* At-a-glance contender strip */}
            <section id="contenders" className="mb-12" aria-label="Contenders">
              <div className="mb-5">
                <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
                <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">The Contenders</p>
                <h2 className="text-2xl font-black text-white leading-tight">
                  {items.length} on the scorecard
                </h2>
              </div>

              {/* Mobile: horizontal scroll */}
              <div className="sm:hidden -mx-6 px-6">
                <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                  {items.map(({ review, wins_category }) => (
                    <ContenderCard key={review!.id} review={review!} winsCategory={wins_category} priceCents={productMap.get(review!.product_slug ?? '')?.price_cents ?? null} className="shrink-0 w-44" />
                  ))}
                </div>
              </div>

              {/* Desktop: grid */}
              <div className={`hidden sm:grid gap-4 ${items.length <= 2 ? 'grid-cols-2' : items.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
                {items.map(({ review, wins_category }) => (
                  <ContenderCard key={review!.id} review={review!} winsCategory={wins_category} priceCents={productMap.get(review!.product_slug ?? '')?.price_cents ?? null} />
                ))}
              </div>
            </section>

            {/* Methodology */}
            {categoryDef && (
              <MethodologyCallout categorySlug={dominantCategory} id="how-i-tested" />
            )}

            {/* Scorecard with image headers */}
            {items.length >= 2 && (
              <section id="scorecard" className="mb-12" aria-label="Scorecard">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
                  <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">Head-to-head</p>
                  <h2 className="text-2xl font-black text-white leading-tight">The Scorecard</h2>
                </div>

                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full min-w-[640px] border-separate border-spacing-0 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] rounded-2xl overflow-hidden">
                    <thead>
                      <tr>
                        <th className="text-left px-4 py-3 text-xs uppercase tracking-widest text-gray-500 font-semibold border-b border-gray-800/60 align-bottom">
                          Criterion
                        </th>
                        {items.map(({ review }) => (
                          <th key={review!.id} className="px-3 py-3 border-b border-gray-800/60 align-bottom min-w-[120px]">
                            <a href={`#dive-${review!.slug}`} className="group block text-center">
                              <div className="relative w-14 h-14 mx-auto mb-2 rounded-xl overflow-hidden bg-gray-950 border border-gray-800 group-hover:border-orange-700 transition-colors">
                                {review!.image_url && (
                                  <Image src={review!.image_url} alt={review!.product_name} fill className="object-cover" sizes="56px" />
                                )}
                              </div>
                              <p className="text-[11px] font-bold text-orange-400 leading-tight line-clamp-2 group-hover:text-orange-300 transition-colors">
                                {review!.product_name}
                              </p>
                            </a>
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
                      {/* Price row — only renders if any item has a price */}
                      {items.some((i) => productMap.get(i.review!.product_slug ?? '')?.price_cents != null) && (
                        <tr className="border-t border-gray-800/40">
                          <td className="px-4 py-3 text-sm text-gray-300 font-medium border-t border-gray-800/40">Price</td>
                          {items.map(({ review }) => {
                            const cents = productMap.get(review!.product_slug ?? '')?.price_cents ?? null
                            return (
                              <td key={review!.id} className="px-4 py-3 text-center text-sm text-gray-300 tabular-nums border-t border-gray-800/40">
                                {cents != null ? `$${(cents / 100).toFixed(0)}` : '—'}
                              </td>
                            )
                          })}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Editorial Overview */}
            {comparison.intro_html && (
              <section id="overview" className="mb-12">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
                  <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">The Overview</p>
                  <h2 className="text-2xl font-black text-white leading-tight">What sets these apart</h2>
                </div>
                <div
                  className="prose prose-invert prose-orange max-w-none prose-p:text-gray-300 prose-p:leading-relaxed prose-strong:text-white prose-a:text-orange-400 hover:prose-a:text-orange-300 prose-a:no-underline"
                  dangerouslySetInnerHTML={{ __html: comparison.intro_html }}
                />
              </section>
            )}

            {/* Per-product deep dives — alternating image position */}
            <section className="mb-12" aria-label="Per-product deep dives">
              <div className="mb-5">
                <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
                <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">The Breakdown</p>
                <h2 className="text-2xl font-black text-white leading-tight">Each contender, examined</h2>
              </div>

              <div className="space-y-10">
                {items.map(({ review, blurb, wins_category }, idx) => {
                  if (!review) return null
                  const product = review.product_slug ? productMap.get(review.product_slug) : null
                  const href = product?.affiliate_url ? `/go/${product.slug}` : product?.non_affiliate_url ?? null
                  const imageLeft = idx % 2 === 0
                  return (
                    <article
                      key={review.id}
                      id={`dive-${review.slug}`}
                      className="scroll-mt-28 rounded-2xl overflow-hidden bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] shadow-lg shadow-black/40"
                    >
                      <div className={`flex flex-col ${imageLeft ? 'sm:flex-row' : 'sm:flex-row-reverse'} gap-0`}>
                        {/* Hero image column */}
                        {review.image_url && (
                          <div className="relative w-full sm:w-2/5 aspect-[4/3] sm:aspect-auto sm:min-h-[280px] bg-gray-950 shrink-0">
                            <Image src={review.image_url} alt={review.product_name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 320px" />
                            {(review.rating ?? 0) >= 8 && (
                              <div className="absolute top-3 right-3"><BossApprovedBadge size="sm" variant="card" /></div>
                            )}
                          </div>
                        )}

                        {/* Body column */}
                        <div className="flex-1 min-w-0 p-5 sm:p-6 flex flex-col">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="min-w-0 flex-1">
                              {wins_category && (
                                <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-orange-300 bg-orange-950/60 border border-orange-900/40 px-2.5 py-1 rounded-full mb-2">{wins_category}</span>
                              )}
                              <p className="text-xs font-medium text-orange-500/80 uppercase tracking-widest mb-1">{review.product_name}</p>
                              <Link href={`/reviews/${review.slug}`} className="text-xl font-black text-white hover:text-orange-400 transition-colors leading-tight block">
                                {review.title}
                              </Link>
                            </div>
                            <RatingScore rating={review.rating ?? 0} size="sm" />
                          </div>

                          {/* Editor's comparison-specific blurb or review excerpt fallback */}
                          {(blurb || review.tldr || review.excerpt) && (
                            <p className="text-sm text-gray-300 leading-relaxed mb-4">{blurb || review.tldr || review.excerpt}</p>
                          )}

                          {/* Pros / Cons */}
                          {((review.pros?.length ?? 0) > 0 || (review.cons?.length ?? 0) > 0) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                              {(review.pros?.length ?? 0) > 0 && (
                                <div className="rounded-xl border border-green-900/30 bg-green-950/20 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-green-400 mb-2">What works</p>
                                  <ul className="space-y-1.5">
                                    {review.pros!.slice(0, 4).map((p, i) => (
                                      <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5 leading-snug">
                                        <svg className="w-3 h-3 mt-0.5 shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>{p}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(review.cons?.length ?? 0) > 0 && (
                                <div className="rounded-xl border border-red-900/30 bg-red-950/20 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-2">Watch outs</p>
                                  <ul className="space-y-1.5">
                                    {review.cons!.slice(0, 4).map((c, i) => (
                                      <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5 leading-snug">
                                        <svg className="w-3 h-3 mt-0.5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        <span>{c}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Best for / Not for */}
                          {((review.best_for?.length ?? 0) > 0 || (review.not_for?.length ?? 0) > 0) && (
                            <div className="text-xs text-gray-500 space-y-1 mb-4">
                              {(review.best_for?.length ?? 0) > 0 && (
                                <p><span className="text-orange-400 font-bold uppercase tracking-widest">Best for:</span> {review.best_for!.join(' · ')}</p>
                              )}
                              {(review.not_for?.length ?? 0) > 0 && (
                                <p><span className="text-gray-400 font-bold uppercase tracking-widest">Skip if:</span> {review.not_for!.join(' · ')}</p>
                              )}
                            </div>
                          )}

                          {/* CTAs */}
                          <div className="flex flex-wrap items-center gap-3 mt-auto pt-2">
                            <Link href={`/reviews/${review.slug}`} className="text-xs text-gray-400 hover:text-orange-400 transition-colors font-semibold uppercase tracking-widest">
                              Read full review →
                            </Link>
                            {href && (
                              <a
                                href={href}
                                target="_blank"
                                rel={product?.affiliate_url ? 'sponsored nofollow noopener' : 'noopener'}
                                data-product-slug={review.product_slug ?? undefined}
                                className="ml-auto px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-xl transition-colors min-h-[44px] flex items-center"
                              >
                                Check Price
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>

            {/* FAQ */}
            {faqs.length > 0 && (
              <FAQAccordion faqs={faqs} id="faq" />
            )}

            {/* Related */}
            <RelatedRail items={related} id="related" />
          </main>

          {/* Desktop right rail */}
          <ArticleTOC items={tocItems} variant="desktop" />
        </div>
      </div>
    </>
  )
}

// ── Sub-components ──────────────────────────────────────────────────────────

function ContenderCard({
  review,
  winsCategory,
  priceCents,
  className,
}: {
  review:        ReviewRow
  winsCategory:  string | null
  priceCents:    number | null
  className?:    string
}) {
  return (
    <a
      href={`#dive-${review.slug}`}
      className={`group flex flex-col bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] rounded-2xl overflow-hidden shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/50 hover:border-orange-900/40 hover:-translate-y-0.5 transition-all ${className ?? ''}`}
    >
      <div className="relative w-full aspect-square bg-gray-950">
        {review.image_url && (
          <Image src={review.image_url} alt={review.product_name} fill className="object-cover" sizes="200px" />
        )}
        {(review.rating ?? 0) >= 8 && (
          <div className="absolute top-2 right-2"><BossApprovedBadge size="sm" variant="card" /></div>
        )}
        {winsCategory && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300 leading-tight">{winsCategory}</p>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-gray-500 mb-1 truncate">{review.product_name}</p>
        <p className="text-sm font-bold text-white group-hover:text-orange-400 transition-colors line-clamp-2 leading-snug flex-1">{review.title}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <RatingScore rating={review.rating ?? 0} size="sm" />
          {priceCents != null && (
            <span className="text-xs text-gray-400 font-bold tabular-nums">${(priceCents / 100).toFixed(0)}</span>
          )}
        </div>
      </div>
    </a>
  )
}

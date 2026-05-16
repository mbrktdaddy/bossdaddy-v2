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

const PICK_TYPES = ['general', 'best_of'] as const

export async function generateStaticParams() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('collections')
    .select('slug')
    .eq('is_visible', true)
    .in('collection_type', PICK_TYPES)
  return (data ?? []).map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('collections')
    .select('title, description, meta_title, meta_description')
    .eq('slug', slug)
    .eq('is_visible', true)
    .in('collection_type', PICK_TYPES)
    .single()
  if (!data) return { title: 'Not Found' }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const metaTitle       = data.meta_title       ?? `${data.title} — Boss Daddy Picks`
  const metaDescription = data.meta_description ?? data.description ?? 'Dad-tested picks curated by Boss Daddy.'
  return {
    title:       metaTitle,
    description: metaDescription,
    alternates:  { canonical: `${siteUrl}/picks/${slug}` },
    openGraph:   { title: metaTitle, description: metaDescription, url: `${siteUrl}/picks/${slug}` },
  }
}

type ReviewRow = {
  id: string
  slug: string
  title: string
  product_name: string
  category: string | null
  rating: number
  excerpt: string | null
  tldr: string | null
  image_url: string | null
  product_slug: string | null
  pros: string[] | null
  cons: string[] | null
  best_for: string[] | null
  has_affiliate_links: boolean
}

export default async function PickDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: pick } = await supabase
    .from('collections')
    .select('id, slug, title, description, intro_html, hero_image_url, published_at, updated_at')
    .eq('slug', slug)
    .eq('is_visible', true)
    .in('collection_type', PICK_TYPES)
    .single()

  if (!pick) notFound()

  const admin = createAdminClient()
  const { data: pickItems } = await admin
    .from('collection_items')
    .select('position, blurb, reviews(id, slug, title, product_name, category, rating, excerpt, tldr, image_url, product_slug, pros, cons, best_for, has_affiliate_links)')
    .eq('collection_id', pick.id)
    .order('position')

  const items = (pickItems ?? []).map((pi) => {
    const r = pi.reviews
    const review = Array.isArray(r) ? r[0] : r
    return { position: pi.position, blurb: pi.blurb, review: review as ReviewRow | null }
  }).filter((i) => i.review != null)

  const productSlugs = [...new Set(items.map((i) => i.review?.product_slug).filter(Boolean) as string[])]
  const productMap = new Map<string, { slug: string; affiliate_url: string | null; non_affiliate_url: string | null; description: string | null; price_cents: number | null }>()
  await Promise.all(productSlugs.map(async (ps) => {
    const product = await getProductBySlug(supabase, ps)
    if (product) productMap.set(ps, { slug: product.slug, affiliate_url: product.affiliate_url, non_affiliate_url: product.non_affiliate_url, description: product.description, price_cents: product.price_cents })
  }))

  // Dominant category drives methodology + FAQ
  const categoryCounts = new Map<string, number>()
  for (const it of items) {
    const c = it.review?.category
    if (c) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1)
  }
  const dominantCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const categoryDef = dominantCategory ? getCategoryBySlug(dominantCategory) : null

  // Related rail — 2 sibling picks + 1 comparison + 1 stack
  const [
    { data: otherPicks },
    { data: someComparisons },
    { data: someStacks },
  ] = await Promise.all([
    admin.from('collections').select('slug, title, description, hero_image_url, collection_type').in('collection_type', PICK_TYPES).eq('is_visible', true).neq('id', pick.id).order('published_at', { ascending: false }).limit(2),
    admin.from('collections').select('slug, title, description, hero_image_url, collection_type').eq('collection_type', 'comparison').eq('is_visible', true).order('published_at', { ascending: false }).limit(1),
    admin.from('collections').select('slug, title, description, hero_image_url, collection_type').eq('collection_type', 'stack').eq('is_visible', true).order('published_at', { ascending: false }).limit(1),
  ])
  const related: RelatedItem[] = [
    ...((otherPicks      ?? []) as RelatedItem[]),
    ...((someComparisons ?? []) as RelatedItem[]),
    ...((someStacks      ?? []) as RelatedItem[]),
  ]

  const faqs = (categoryDef?.faqs ?? []).slice(0, 4)

  const tocItems = [
    ...(categoryDef        ? [{ id: 'how-i-tested', label: 'How I Tested' }] : []),
    { id: 'picks',     label: items.length === 1 ? 'The Pick' : 'The Picks' },
    ...(pick.intro_html ? [{ id: 'overview', label: 'Overview' }] : []),
    ...(faqs.length > 0    ? [{ id: 'faq',     label: 'FAQ' }] : []),
    ...(related.length > 0 ? [{ id: 'related', label: 'Related' }] : []),
  ]

  const wordsource = [
    pick.intro_html ?? '',
    pick.description ?? '',
    ...items.map((i) => i.blurb ?? i.review?.excerpt ?? ''),
  ].join(' ').replace(/<[^>]*>/g, ' ')
  const readingMinutes = Math.max(1, Math.round(wordsource.split(/\s+/).filter(Boolean).length / 235))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: pick.title,
    description: pick.description,
    datePublished: pick.published_at,
    dateModified:  pick.updated_at ?? pick.published_at,
    author: { '@type': 'Person', name: 'Boss Daddy' },
    publisher: { '@type': 'Organization', name: 'Boss Daddy Life', url: siteUrl },
    mainEntityOfPage: `${siteUrl}/picks/${slug}`,
  }

  const itemListLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: pick.title,
    description: pick.description,
    numberOfItems: items.length,
    itemListElement: items.map((entry, idx) => {
      const r = entry.review!
      return {
        '@type': 'ListItem',
        position: idx + 1,
        url:      `${siteUrl}/reviews/${r.slug}`,
        name:     r.product_name,
        item: {
          '@type': 'Product',
          name:    r.product_name,
          image:   r.image_url ?? undefined,
          aggregateRating: r.rating ? {
            '@type':       'AggregateRating',
            ratingValue:   r.rating,
            bestRating:    10,
            worstRating:   1,
            ratingCount:   1,
          } : undefined,
        },
      }
    }),
  }

  const faqLd = faqPageLd(faqs)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-8">
          <Link href="/picks" className="hover:text-orange-400 transition-colors">Boss Daddy Picks</Link>
          <span>/</span>
          <span className="text-gray-400">{pick.title}</span>
        </div>

        <div className="lg:flex lg:gap-10 lg:items-start">
          <main className="lg:flex-1 lg:max-w-3xl min-w-0">
            <header className="mb-8">
              <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
              <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">Boss Daddy Picks</p>
              <h1 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight leading-tight">{pick.title}</h1>
              {pick.description && (
                <p className="text-lg text-gray-400 leading-relaxed mb-6">{pick.description}</p>
              )}
              <EditorialMeta
                publishedAt={pick.published_at}
                updatedAt={pick.updated_at}
                readingMinutes={readingMinutes}
              />
            </header>

            <ArticleTOC items={tocItems} variant="mobile" />

            {pick.hero_image_url && (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-10 bg-gray-900">
                <Image src={pick.hero_image_url} alt={pick.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" priority />
              </div>
            )}

            {/* Methodology */}
            {categoryDef && (
              <MethodologyCallout categorySlug={dominantCategory} id="how-i-tested" />
            )}

            {/* The Picks — ranked list with medal icons for top 3 */}
            <section id="picks" className="mb-12" aria-label="The picks">
              <div className="mb-5">
                <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
                <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">
                  {items.length} dad-tested {items.length === 1 ? 'pick' : 'picks'}
                </p>
                <h2 className="text-2xl font-black text-white leading-tight">All personally bought and tested</h2>
              </div>

              <div className="space-y-5">
                {items.map(({ review, blurb }, idx) => {
                  if (!review) return null
                  const product = review.product_slug ? productMap.get(review.product_slug) : null
                  const href = product?.affiliate_url ? `/go/${product.slug}` : product?.non_affiliate_url ?? null
                  const rank = idx + 1
                  return (
                    <article key={review.id} className="flex flex-col sm:flex-row gap-5 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] hover:border-orange-900/40 rounded-2xl p-5 shadow-lg shadow-black/40 transition-colors">
                      {/* Rank — medal for top 3, number for the rest */}
                      <div className="flex sm:flex-col items-center gap-3 sm:gap-1 shrink-0">
                        <RankMedal rank={rank} />
                      </div>

                      {review.image_url && (
                        <div className="relative w-full sm:w-40 h-40 sm:h-32 shrink-0 rounded-xl overflow-hidden bg-gray-800">
                          <Image src={review.image_url} alt={review.product_name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 160px" />
                          {review.rating >= 8 && (
                            <div className="absolute top-2 right-2"><BossApprovedBadge size="sm" variant="card" /></div>
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <p className="text-xs font-medium text-orange-500/80 uppercase tracking-widest mb-1">{review.product_name}</p>
                            <Link href={`/reviews/${review.slug}`} className="text-lg font-bold text-white hover:text-orange-400 transition-colors leading-snug block">
                              {review.title}
                            </Link>
                          </div>
                          <RatingScore rating={review.rating} size="sm" />
                        </div>

                        <p className="text-sm text-gray-300 leading-relaxed mb-3">
                          {blurb ?? review.tldr ?? review.excerpt ?? product?.description ?? ''}
                        </p>

                        {/* Best for tags — small accents */}
                        {(review.best_for?.length ?? 0) > 0 && (
                          <p className="text-xs text-gray-500 mb-3">
                            <span className="text-orange-400 font-bold uppercase tracking-widest">Best for:</span> {review.best_for!.slice(0, 3).join(' · ')}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mt-auto pt-1">
                          <Link href={`/reviews/${review.slug}`} className="text-xs text-gray-400 hover:text-orange-400 transition-colors font-semibold uppercase tracking-widest">
                            Read full review →
                          </Link>
                          {product?.price_cents != null && (
                            <span className="text-xs text-gray-400 font-bold tabular-nums">${(product.price_cents / 100).toFixed(0)}</span>
                          )}
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
                    </article>
                  )
                })}
              </div>
            </section>

            {pick.intro_html && (
              <section id="overview" className="mb-12">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
                  <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">The Overview</p>
                  <h2 className="text-2xl font-black text-white leading-tight">Behind the picks</h2>
                </div>
                <div
                  className="prose prose-invert prose-orange max-w-none prose-p:text-gray-300 prose-p:leading-relaxed prose-strong:text-white prose-a:text-orange-400 hover:prose-a:text-orange-300 prose-a:no-underline"
                  dangerouslySetInnerHTML={{ __html: pick.intro_html }}
                />
              </section>
            )}

            {faqs.length > 0 && <FAQAccordion faqs={faqs} id="faq" />}

            <RelatedRail items={related} id="related" />
          </main>

          <ArticleTOC items={tocItems} variant="desktop" />
        </div>
      </div>
    </>
  )
}

function RankMedal({ rank }: { rank: number }) {
  if (rank <= 3) {
    const colors = {
      1: { bg: 'bg-gradient-to-br from-amber-400 to-amber-600', text: 'text-amber-900', label: 'No. 1' },
      2: { bg: 'bg-gradient-to-br from-gray-300 to-gray-500',   text: 'text-gray-800',  label: 'No. 2' },
      3: { bg: 'bg-gradient-to-br from-orange-700 to-orange-900', text: 'text-orange-100', label: 'No. 3' },
    }[rank as 1 | 2 | 3]!
    return (
      <div className="flex sm:flex-col items-center gap-2">
        <span className={`relative w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center font-black text-base ${colors.text} shadow-lg shadow-black/40 ring-2 ring-black/30`}>
          <svg className="absolute -top-1 -right-1 w-4 h-4 text-orange-400 drop-shadow" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {rank}
        </span>
        <span className="hidden sm:block text-[10px] text-gray-500 uppercase tracking-widest font-bold">{colors.label}</span>
      </div>
    )
  }
  return (
    <span className="w-12 h-12 rounded-full bg-orange-950/60 border border-orange-900/40 flex items-center justify-center text-orange-400 font-black text-sm tabular-nums">
      {rank}
    </span>
  )
}

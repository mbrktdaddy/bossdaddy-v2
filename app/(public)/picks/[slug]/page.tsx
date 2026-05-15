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
  const { data } = await admin.from('collections').select('slug').eq('is_visible', true)
  return (data ?? []).map(({ slug }) => ({ slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('collections')
    .select('title, description')
    .eq('slug', slug)
    .eq('is_visible', true)
    .single()
  if (!data) return { title: 'Not Found' }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return {
    title: `${data.title} — Boss Daddy Picks`,
    description: data.description ?? 'Dad-tested picks curated by Boss Daddy.',
    alternates: { canonical: `${siteUrl}/picks/${slug}` },
    openGraph: { title: data.title, description: data.description ?? undefined, url: `${siteUrl}/picks/${slug}` },
  }
}

export default async function PickDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: pick } = await supabase
    .from('collections')
    .select('id, slug, title, description, intro_html, hero_image_url, published_at')
    .eq('slug', slug)
    .eq('is_visible', true)
    .single()

  if (!pick) notFound()

  const admin = createAdminClient()
  const { data: pickItems } = await admin
    .from('collection_items')
    .select('position, blurb, reviews(id, slug, title, product_name, category, rating, excerpt, image_url, product_slug, has_affiliate_links)')
    .eq('collection_id', pick.id)
    .order('position')

  type ReviewRow = { id: string; slug: string; title: string; product_name: string; rating: number; excerpt: string | null; image_url: string | null; product_slug: string | null; has_affiliate_links: boolean }
  const items = (pickItems ?? []).map((pi) => {
    const reviews = pi.reviews
    const review = Array.isArray(reviews) ? reviews[0] : reviews
    return { position: pi.position, blurb: pi.blurb, review: review as ReviewRow | null }
  }).filter((i) => i.review != null)

  const productSlugs = [...new Set(items.map((i) => i.review?.product_slug).filter(Boolean) as string[])]
  const productMap = new Map<string, { slug: string; affiliate_url: string | null; non_affiliate_url: string | null; store: string; custom_store_name: string | null; description: string | null }>()
  await Promise.all(productSlugs.map(async (ps) => {
    const product = await getProductBySlug(supabase, ps)
    if (product) productMap.set(ps, product)
  }))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: pick.title,
    description: pick.description,
    datePublished: pick.published_at,
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
        url: `${siteUrl}/reviews/${r.slug}`,
        name: r.product_name,
        item: {
          '@type': 'Product',
          name: r.product_name,
          aggregateRating: r.rating ? {
            '@type': 'AggregateRating',
            ratingValue: r.rating,
            bestRating: 10,
            worstRating: 1,
            ratingCount: 1,
          } : undefined,
        },
      }
    }),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-8">
          <Link href="/picks" className="hover:text-orange-400 transition-colors">Boss Daddy Picks</Link>
          <span>/</span>
          <span className="text-gray-400">{pick.title}</span>
        </div>

        {/* Hero */}
        {pick.hero_image_url && (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-10 bg-gray-900">
            <Image
              src={pick.hero_image_url}
              alt={pick.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 896px"
              priority
            />
          </div>
        )}

        {/* Header */}
        <div className="mb-10">
          <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">Boss Daddy Picks</p>
          <h1 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight leading-tight">{pick.title}</h1>
          {pick.description && (
            <p className="text-lg text-gray-400 leading-relaxed max-w-2xl">{pick.description}</p>
          )}
          {pick.intro_html && (
            <div
              className="mt-6 prose prose-invert prose-orange max-w-none prose-p:text-gray-300 prose-p:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: pick.intro_html }}
            />
          )}
        </div>

        {/* Count */}
        <div className="flex items-center gap-2 mb-8 pb-6 border-b border-gray-800/60">
          <span className="text-sm text-gray-500">
            <span className="text-white font-bold tabular-nums">{items.length}</span> dad-tested {items.length === 1 ? 'pick' : 'picks'}, all personally bought and tested
          </span>
        </div>

        {/* Picks */}
        <div className="space-y-6">
          {items.map(({ review, blurb }, idx) => {
            if (!review) return null
            const product = review.product_slug ? productMap.get(review.product_slug) : null
            const href = product?.affiliate_url ? `/go/${product.slug}` : product?.non_affiliate_url ?? null

            return (
              <div key={review.id} className="flex flex-col sm:flex-row gap-5 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] hover:border-orange-900/40 rounded-2xl p-5 shadow-lg shadow-black/40 transition-colors">
                {/* Rank */}
                <div className="flex sm:flex-col items-center gap-3 sm:gap-0 shrink-0">
                  <span className="w-10 h-10 rounded-full bg-orange-950/60 border border-orange-900/40 flex items-center justify-center text-orange-400 font-black text-sm tabular-nums">
                    {idx + 1}
                  </span>
                </div>

                {/* Image */}
                {review.image_url && (
                  <div className="relative w-full sm:w-40 h-40 sm:h-32 shrink-0 rounded-xl overflow-hidden bg-gray-800">
                    <Image
                      src={review.image_url}
                      alt={review.product_name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 160px"
                    />
                    {review.rating >= 8 && (
                      <div className="absolute top-2 right-2">
                        <BossApprovedBadge size="sm" variant="card" />
                      </div>
                    )}
                  </div>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-xs font-medium text-orange-500/80 uppercase tracking-widest mb-1">{review.product_name}</p>
                      <Link href={`/reviews/${review.slug}`} className="text-base font-bold text-white hover:text-orange-400 transition-colors leading-snug">
                        {review.title}
                      </Link>
                    </div>
                    <RatingScore rating={review.rating} size="sm" />
                  </div>

                  <p className="text-sm text-gray-400 leading-relaxed flex-1">
                    {blurb ?? review.excerpt ?? product?.description ?? ''}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    <Link
                      href={`/reviews/${review.slug}`}
                      className="text-xs text-gray-400 hover:text-orange-400 transition-colors font-semibold uppercase tracking-widest"
                    >
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

        {/* Back link */}
        <div className="mt-16 pt-8 border-t border-gray-800/60">
          <Link href="/picks" className="text-sm text-gray-500 hover:text-orange-400 transition-colors">
            ← All Boss Daddy Picks
          </Link>
        </div>
      </div>
    </>
  )
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProductBySlug } from '@/lib/products'
import { OCCASIONS, getOccasion } from '@/lib/gift-occasions'
import RatingScore from '@/components/RatingScore'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import { EmailSignup } from '@/components/EmailSignup'

export const revalidate = 60

interface Props { params: Promise<{ occasion: string }> }

// Pre-build every defined occasion at deploy time so all /gifts/* URLs exist
// and accumulate SEO authority even before content is published.
export function generateStaticParams() {
  return OCCASIONS.map((o) => ({ occasion: o.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { occasion: slug } = await params
  const occ = getOccasion(slug)
  if (!occ) return { title: 'Not Found' }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return {
    title: occ.metaTitle,
    description: occ.metaDesc,
    alternates: { canonical: `${siteUrl}/gifts/${occ.slug}` },
    openGraph: {
      title: occ.metaTitle,
      description: occ.metaDesc,
      url: `${siteUrl}/gifts/${occ.slug}`,
    },
  }
}

export default async function GiftOccasionPage({ params }: Props) {
  const { occasion: slug } = await params
  const occ = getOccasion(slug)
  if (!occ) notFound()

  const supabase = await createClient()

  // Find the most recent published gift guide for this occasion
  const { data: pick } = await supabase
    .from('pick_lists')
    .select('id, slug, title, description, intro_html, hero_image_url, published_at')
    .eq('pick_type', 'gift_guide')
    .eq('occasion', occ.value)
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const admin = createAdminClient()
  let items: Array<{ position: number; blurb: string | null; review: ReviewRow }> = []

  type ReviewRow = { id: string; slug: string; title: string; product_name: string; rating: number | null; excerpt: string | null; image_url: string | null; product_slug: string | null; has_affiliate_links: boolean }

  if (pick) {
    const { data: pickItems } = await admin
      .from('pick_list_items')
      .select('position, blurb, reviews(id, slug, title, product_name, rating, excerpt, image_url, product_slug, has_affiliate_links)')
      .eq('pick_list_id', pick.id)
      .order('position')

    items = (pickItems ?? []).map((pi) => {
      const reviews = pi.reviews
      const review = Array.isArray(reviews) ? reviews[0] : reviews
      return { position: pi.position, blurb: pi.blurb, review: review as ReviewRow }
    }).filter((i) => i.review != null)
  }

  // Cross-link: a few other gift guides from the same group for the bottom strip
  const related = OCCASIONS.filter((o) => o.group === occ.group && o.value !== occ.value).slice(0, 6)

  // Product CTA links for items
  const productSlugs = [...new Set(items.map((i) => i.review?.product_slug).filter(Boolean) as string[])]
  const productMap = new Map<string, { slug: string; affiliate_url: string | null; non_affiliate_url: string | null }>()
  await Promise.all(productSlugs.map(async (ps) => {
    const product = await getProductBySlug(supabase, ps)
    if (product) productMap.set(ps, product)
  }))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  // Article schema (works whether content is live or empty)
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: occ.metaTitle,
    description: occ.metaDesc,
    datePublished: pick?.published_at ?? undefined,
    author: { '@type': 'Person', name: 'Boss Daddy' },
    publisher: { '@type': 'Organization', name: 'Boss Daddy Life', url: siteUrl },
    mainEntityOfPage: `${siteUrl}/gifts/${occ.slug}`,
  }

  // ItemList schema only if we have items
  const itemListLd = items.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: pick?.title ?? occ.label,
    description: occ.metaDesc,
    numberOfItems: items.length,
    itemListElement: items.map((entry, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `${siteUrl}/reviews/${entry.review.slug}`,
      name: entry.review.product_name,
      item: {
        '@type': 'Product',
        name: entry.review.product_name,
        aggregateRating: entry.review.rating ? {
          '@type': 'AggregateRating',
          ratingValue: entry.review.rating,
          bestRating: 10,
          worstRating: 1,
          ratingCount: 1,
        } : undefined,
      },
    })),
  } : null

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
          <Link href="/gifts" className="hover:text-orange-400 transition-colors">Gift Guides</Link>
          <span>/</span>
          <span className="text-gray-400">{occ.label}</span>
        </div>

        {/* Hero */}
        {pick?.hero_image_url ? (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-8 bg-gray-900">
            <Image
              src={pick.hero_image_url}
              alt={pick.title ?? occ.label}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 896px"
              priority
            />
          </div>
        ) : (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-orange-950/40 to-gray-900 flex items-center justify-center border border-orange-900/20">
            <span className="text-7xl md:text-8xl">{occ.emoji}</span>
          </div>
        )}

        {/* Header */}
        <div className="mb-10">
          <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">Gift Guide</p>
          <h1 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight leading-tight">
            {pick?.title ?? occ.label}
          </h1>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl">
            {pick?.description ?? occ.longBlurb}
          </p>
          {pick?.intro_html && (
            <div
              className="mt-6 prose prose-invert prose-orange max-w-none prose-p:text-gray-300 prose-p:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: pick.intro_html }}
            />
          )}
        </div>

        {/* Picks if available */}
        {items.length > 0 ? (
          <>
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-800/60">
              <span className="text-sm text-gray-500">
                <span className="text-white font-bold tabular-nums">{items.length}</span> dad-tested {items.length === 1 ? 'pick' : 'picks'}, all personally bought and used
              </span>
            </div>

            <div className="space-y-6">
              {items.map(({ review, blurb }, idx) => {
                const product = review.product_slug ? productMap.get(review.product_slug) : null
                const href = product?.affiliate_url ? `/go/${product.slug}` : product?.non_affiliate_url ?? null

                return (
                  <div key={review.id} className="flex flex-col sm:flex-row gap-5 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] hover:border-orange-900/40 rounded-2xl p-5 shadow-lg shadow-black/40 transition-colors">
                    <div className="flex sm:flex-col items-center gap-3 sm:gap-0 shrink-0">
                      <span className="w-10 h-10 rounded-full bg-orange-950/60 border border-orange-900/40 flex items-center justify-center text-orange-400 font-black text-sm tabular-nums">
                        {idx + 1}
                      </span>
                    </div>

                    {review.image_url && (
                      <div className="relative w-full sm:w-40 h-40 sm:h-32 shrink-0 rounded-xl overflow-hidden bg-gray-800">
                        <Image src={review.image_url} alt={review.product_name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 160px" />
                        {review.rating != null && review.rating >= 8 && (
                          <div className="absolute top-2 right-2"><BossApprovedBadge size="sm" variant="card" /></div>
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 flex flex-col">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <p className="text-xs font-medium text-orange-500/80 uppercase tracking-widest mb-1">{review.product_name}</p>
                          <Link href={`/reviews/${review.slug}`} className="text-base font-bold text-white hover:text-orange-400 transition-colors leading-snug">
                            {review.title}
                          </Link>
                        </div>
                        {review.rating != null && <RatingScore rating={review.rating} size="sm" />}
                      </div>

                      <p className="text-sm text-gray-400 leading-relaxed flex-1">
                        {blurb ?? review.excerpt ?? ''}
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
          </>
        ) : (
          /* Empty state — proper SEO landing page even with no content */
          <div className="bg-gradient-to-br from-orange-950/30 to-gray-900 rounded-2xl p-8 md:p-10 border border-orange-900/30 mb-10">
            <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
            <p className="text-xs text-orange-500 uppercase tracking-widest font-bold mb-3">Coming Soon</p>
            <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
              The {occ.label} list is being built
            </h2>
            <p className="text-gray-300 leading-relaxed mb-6 max-w-xl">
              Boss Daddy is curating the {occ.label.toLowerCase()} guide right now — every pick personally tested, no corporate gift-list filler. Drop your email and you&apos;ll be the first to know when it goes live.
            </p>
            <div className="max-w-md">
              <EmailSignup
                heading={null}
                description={null}
                buttonLabel="Notify me"
                successMessage="You're in. We'll send the list the moment it's live."
                interests={['newsletter']}
              />
            </div>
          </div>
        )}

        {/* Related occasions strip */}
        {related.length > 0 && (
          <section className="mt-14 pt-10 border-t border-gray-800/60">
            <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
            <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-5">More Gift Guides</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {related.map((r) => (
                <Link
                  key={r.value}
                  href={`/gifts/${r.slug}`}
                  className="flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] hover:bg-gray-800 hover:border-orange-900/40 rounded-xl transition-colors min-h-[44px]"
                >
                  <span className="text-2xl shrink-0">{r.emoji}</span>
                  <span className="text-sm font-semibold text-gray-300 hover:text-white transition-colors truncate">{r.label}</span>
                </Link>
              ))}
            </div>
            <div className="mt-4 text-center">
              <Link href="/gifts" className="text-sm text-gray-500 hover:text-orange-400 transition-colors">
                See all gift guides →
              </Link>
            </div>
          </section>
        )}
      </div>
    </>
  )
}

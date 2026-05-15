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
    .eq('collection_type', 'stack')
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
    .eq('collection_type', 'stack')
    .eq('is_visible', true)
    .single()
  if (!data) return { title: 'Not Found' }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const metaTitle       = data.meta_title       ?? `The ${data.title} Stack — Dad-Tested Kit`
  const metaDescription = data.meta_description ?? data.description ?? 'A curated kit-for-purpose from Boss Daddy.'
  return {
    title:       metaTitle,
    description: metaDescription,
    alternates:  { canonical: `${siteUrl}/stacks/${slug}` },
    openGraph:   { title: metaTitle, description: metaDescription, url: `${siteUrl}/stacks/${slug}` },
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
}

type ProductRow = {
  slug: string
  affiliate_url: string | null
  non_affiliate_url: string | null
  price_cents: number | null
}

export default async function StackDetailPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: stack } = await supabase
    .from('collections')
    .select('id, slug, title, description, intro_html, hero_image_url, bundle_total_cents, published_at')
    .eq('slug', slug)
    .eq('collection_type', 'stack')
    .eq('is_visible', true)
    .single()

  if (!stack) notFound()

  const admin = createAdminClient()
  const { data: rawItems } = await admin
    .from('collection_items')
    .select('position, blurb, role_label, reviews(id, slug, title, product_name, rating, excerpt, image_url, product_slug)')
    .eq('collection_id', stack.id)
    .order('position')

  const items = (rawItems ?? []).map((it) => {
    const r = it.reviews
    const review = Array.isArray(r) ? r[0] : r
    return {
      position: it.position,
      blurb: it.blurb,
      role_label: it.role_label,
      review: review as ReviewRow | null,
    }
  }).filter((i) => i.review != null)

  // Hydrate products for affiliate CTAs + price computation
  const productSlugs = [...new Set(items.map((i) => i.review?.product_slug).filter(Boolean) as string[])]
  const productMap = new Map<string, ProductRow>()
  await Promise.all(productSlugs.map(async (ps) => {
    const product = await getProductBySlug(supabase, ps)
    if (product) productMap.set(ps, product as ProductRow)
  }))

  // Compute total: prefer stored bundle_total_cents, else sum item prices.
  const computedTotal = items.reduce((sum, { review }) => {
    const product = review?.product_slug ? productMap.get(review.product_slug) : null
    return sum + (product?.price_cents ?? 0)
  }, 0)
  const total = stack.bundle_total_cents ?? (computedTotal > 0 ? computedTotal : null)

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: stack.title,
    description: stack.description,
    datePublished: stack.published_at,
    author: { '@type': 'Person', name: 'Boss Daddy' },
    publisher: { '@type': 'Organization', name: 'Boss Daddy Life', url: siteUrl },
    mainEntityOfPage: `${siteUrl}/stacks/${slug}`,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-8">
          <Link href="/stacks" className="hover:text-orange-400 transition-colors">Stacks</Link>
          <span>/</span>
          <span className="text-gray-400">{stack.title}</span>
        </div>

        {/* Hero image */}
        {stack.hero_image_url && (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-10 bg-gray-900">
            <Image
              src={stack.hero_image_url}
              alt={stack.title}
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
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">The Stack</p>
          <h1 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight leading-tight">{stack.title}</h1>
          {stack.description && (
            <p className="text-lg text-gray-400 leading-relaxed max-w-2xl">{stack.description}</p>
          )}
          {stack.intro_html && (
            <div
              className="mt-6 prose prose-invert prose-orange max-w-none prose-p:text-gray-300 prose-p:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: stack.intro_html }}
            />
          )}
        </div>

        {/* Lineup */}
        <section className="mb-12" aria-label="Stack lineup">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
              <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">The Lineup</p>
              <h2 className="text-2xl font-black text-white leading-tight">
                {items.length} {items.length === 1 ? 'piece' : 'pieces'} in this kit
              </h2>
            </div>
          </div>

          <div className="space-y-5">
            {items.map(({ review, blurb, role_label }) => {
              if (!review) return null
              const product = review.product_slug ? productMap.get(review.product_slug) : null
              const href = product?.affiliate_url ? `/go/${product.slug}` : product?.non_affiliate_url ?? null
              const priceCents = product?.price_cents ?? null
              return (
                <article
                  key={review.id}
                  className="flex flex-col sm:flex-row gap-5 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] hover:border-orange-900/40 rounded-2xl p-5 shadow-lg shadow-black/40 transition-colors"
                >
                  {review.image_url && (
                    <div className="relative w-full sm:w-44 h-44 sm:h-36 shrink-0 rounded-xl overflow-hidden bg-gray-800">
                      <Image src={review.image_url} alt={review.product_name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 176px" />
                      {(review.rating ?? 0) >= 8 && (
                        <div className="absolute top-2 right-2"><BossApprovedBadge size="sm" variant="card" /></div>
                      )}
                    </div>
                  )}
                  <div className="flex-1 min-w-0 flex flex-col">
                    {role_label && (
                      <span className="self-start text-[10px] font-black uppercase tracking-[0.2em] text-orange-300 bg-orange-950/60 border border-orange-900/40 px-3 py-1 rounded-full mb-2">
                        {role_label}
                      </span>
                    )}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="text-xs font-medium text-orange-500/80 uppercase tracking-widest mb-1">{review.product_name}</p>
                        <Link href={`/reviews/${review.slug}`} className="text-lg font-bold text-white hover:text-orange-400 transition-colors leading-snug">
                          {review.title}
                        </Link>
                      </div>
                      <RatingScore rating={review.rating ?? 0} size="sm" />
                    </div>
                    {blurb && (
                      <p className="text-sm text-gray-400 leading-relaxed flex-1">{blurb}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                      {priceCents != null && (
                        <span className="text-base font-black text-white tabular-nums">${(priceCents / 100).toFixed(2)}</span>
                      )}
                      <Link href={`/reviews/${review.slug}`} className="text-xs text-gray-400 hover:text-orange-400 transition-colors font-semibold uppercase tracking-widest">
                        Read review →
                      </Link>
                      {href && (
                        <a
                          href={href}
                          target="_blank"
                          rel={product?.affiliate_url ? 'sponsored nofollow noopener' : 'noopener'}
                          data-product-slug={review.product_slug ?? undefined}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-xl transition-colors min-h-[44px] flex items-center ml-auto"
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

        {/* Total */}
        {total != null && total > 0 && (
          <section className="mb-12 rounded-2xl border border-orange-900/40 bg-gradient-to-br from-orange-950/30 to-gray-900/60 ring-1 ring-inset ring-white/[0.02] p-5 sm:p-6 text-center">
            <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">Build the Stack</p>
            <p className="text-3xl sm:text-4xl font-black text-white tabular-nums mb-1">${(total / 100).toFixed(2)}</p>
            <p className="text-xs text-gray-500">Estimated total · {items.length} {items.length === 1 ? 'piece' : 'pieces'}</p>
          </section>
        )}
      </div>
    </>
  )
}

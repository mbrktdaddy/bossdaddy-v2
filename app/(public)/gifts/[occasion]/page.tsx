import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getProductBySlug } from '@/lib/products'
import { OCCASIONS, getOccasion } from '@/lib/gift-occasions'
import { getCategoryBySlug } from '@/lib/categories'
import RatingScore from '@/components/RatingScore'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import { EmailSignup } from '@/components/EmailSignup'
import OccasionIcon from '@/components/OccasionIcon'
import ArticleTOC from '@/components/collections/ArticleTOC'
import EditorialMeta from '@/components/collections/EditorialMeta'
import MethodologyCallout from '@/components/collections/MethodologyCallout'
import FAQAccordion, { faqPageLd } from '@/components/collections/FAQAccordion'
import RelatedRail, { type RelatedItem } from '@/components/collections/RelatedRail'

export const revalidate = 60

interface Props { params: Promise<{ occasion: string }> }

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
  best_for: string[] | null
  has_affiliate_links: boolean
}

export default async function GiftOccasionPage({ params }: Props) {
  const { occasion: slug } = await params
  const occ = getOccasion(slug)
  if (!occ) notFound()

  const supabase = await createClient()

  const { data: pick } = await supabase
    .from('collections')
    .select('id, slug, title, description, intro_html, hero_image_url, methodology_html, faqs, published_at, updated_at')
    .eq('collection_type', 'gift_guide')
    .eq('occasion', occ.value)
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const admin = createAdminClient()
  let items: Array<{ position: number; blurb: string | null; best_for: string | null; review: ReviewRow }> = []

  if (pick) {
    const { data: pickItems } = await admin
      .from('collection_items')
      .select('position, blurb, best_for, reviews(id, slug, title, product_name, category, rating, excerpt, tldr, image_url, product_slug, best_for, has_affiliate_links)')
      .eq('collection_id', pick.id)
      .order('position')

    items = (pickItems ?? []).map((pi) => {
      const reviews = pi.reviews
      const review = Array.isArray(reviews) ? reviews[0] : reviews
      return {
        position: pi.position,
        blurb:    pi.blurb,
        best_for: (pi as { best_for?: string | null }).best_for ?? null,
        review:   review as ReviewRow,
      }
    }).filter((i) => i.review != null)
  }

  // Related occasions strip — same group, different occasion. Kept distinct
  // from the cross-flavor RelatedRail because gift-occasion siblings are a
  // navigation pattern unique to /gifts (other categories like "Father's Day"
  // sit naturally next to "Mother's Day"). Both rails coexist on the page.
  const relatedOccasions = OCCASIONS.filter((o) => o.group === occ.group && o.value !== occ.value).slice(0, 6)

  const productSlugs = [...new Set(items.map((i) => i.review?.product_slug).filter(Boolean) as string[])]
  const productMap = new Map<string, { slug: string; affiliate_url: string | null; non_affiliate_url: string | null; price_cents: number | null }>()
  await Promise.all(productSlugs.map(async (ps) => {
    const product = await getProductBySlug(supabase, ps)
    if (product) productMap.set(ps, { slug: product.slug, affiliate_url: product.affiliate_url, non_affiliate_url: product.non_affiliate_url, price_cents: product.price_cents })
  }))

  // Dominant category from items — drives methodology + FAQ when there's content.
  const categoryCounts = new Map<string, number>()
  for (const it of items) {
    const c = it.review?.category
    if (c) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1)
  }
  const dominantCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const categoryDef = dominantCategory ? getCategoryBySlug(dominantCategory) : null

  // Cross-flavor related rail — only fetched when we have content to show.
  // Otherwise the empty state's email capture is the call to action.
  let related: RelatedItem[] = []
  if (pick) {
    const [
      { data: someComparisons },
      { data: somePicks },
      { data: someStacks },
    ] = await Promise.all([
      admin.from('collections').select('slug, title, description, hero_image_url, collection_type').eq('collection_type', 'comparison').eq('is_visible', true).order('published_at', { ascending: false }).limit(2),
      admin.from('collections').select('slug, title, description, hero_image_url, collection_type').in('collection_type', ['best_of', 'general']).eq('is_visible', true).order('published_at', { ascending: false }).limit(1),
      admin.from('collections').select('slug, title, description, hero_image_url, collection_type').eq('collection_type', 'stack').eq('is_visible', true).order('published_at', { ascending: false }).limit(1),
    ])
    related = [
      ...((someComparisons ?? []) as RelatedItem[]),
      ...((somePicks       ?? []) as RelatedItem[]),
      ...((someStacks      ?? []) as RelatedItem[]),
    ]
  }

  const collectionFaqs = (pick as { faqs?: { question: string; answer: string }[] | null } | null)?.faqs
  const faqs = (collectionFaqs && collectionFaqs.length > 0
    ? collectionFaqs
    : (categoryDef?.faqs ?? [])).slice(0, 6)
  const methodologyOverride = (pick as { methodology_html?: string | null } | null)?.methodology_html ?? null

  const tocItems = pick ? [
    ...(categoryDef        ? [{ id: 'how-i-tested', label: 'How I Pick Gifts' }] : []),
    { id: 'picks', label: 'The Gifts' },
    ...(pick.intro_html    ? [{ id: 'overview', label: 'Why These' }] : []),
    ...(faqs.length > 0    ? [{ id: 'faq',     label: 'FAQ' }] : []),
    ...(related.length > 0 ? [{ id: 'related', label: 'Also From The Vault' }] : []),
  ] : []

  const wordsource = [
    pick?.intro_html ?? '',
    pick?.description ?? occ.longBlurb,
    ...items.map((i) => i.blurb ?? i.review?.excerpt ?? ''),
  ].join(' ').replace(/<[^>]*>/g, ' ')
  const readingMinutes = Math.max(1, Math.round(wordsource.split(/\s+/).filter(Boolean).length / 235))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: occ.metaTitle,
    description: occ.metaDesc,
    datePublished: pick?.published_at ?? undefined,
    dateModified:  pick?.updated_at ?? pick?.published_at ?? undefined,
    author: { '@type': 'Person', name: 'Boss Daddy' },
    publisher: { '@type': 'Organization', name: 'Boss Daddy Life', url: siteUrl },
    mainEntityOfPage: `${siteUrl}/gifts/${occ.slug}`,
  }

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
        name:    entry.review.product_name,
        image:   entry.review.image_url ?? undefined,
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

  const faqLd = pick ? faqPageLd(faqs) : null

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}
      {faqLd      && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <div className={`${pick ? 'max-w-7xl' : 'max-w-4xl'} mx-auto px-6 py-12`}>
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
          <Link href="/gifts" className="hover:text-orange-400 transition-colors">Gift Guides</Link>
          <span>/</span>
          <span className="text-gray-400">{occ.label}</span>
        </div>

        <div className={pick ? 'lg:flex lg:gap-10 lg:items-start' : ''}>
          <main className={pick ? 'lg:flex-1 lg:max-w-3xl min-w-0' : ''}>
            {/* Hero — image if present, big occasion icon otherwise */}
            {pick?.hero_image_url ? (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-8 bg-gray-900">
                <Image src={pick.hero_image_url} alt={pick.title ?? occ.label} fill className="object-cover" sizes={pick ? '(max-width: 768px) 100vw, 768px' : '(max-width: 768px) 100vw, 896px'} priority />
              </div>
            ) : (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-8 bg-gradient-to-br from-orange-950/40 to-gray-900 flex items-center justify-center border border-orange-900/20">
                <OccasionIcon value={occ.value} className="w-20 h-20 md:w-24 md:h-24 text-orange-500/70" />
              </div>
            )}

            {/* Header */}
            <header className="mb-8">
              <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
              <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">Gift Guide · {occ.label}</p>
              <h1 className="text-4xl md:text-5xl font-black mb-4 text-white tracking-tight leading-tight">
                {pick?.title ?? occ.label}
              </h1>
              <p className="text-lg text-gray-400 leading-relaxed mb-6">
                {pick?.description ?? occ.longBlurb}
              </p>
              {pick && (
                <EditorialMeta
                  publishedAt={pick.published_at}
                  updatedAt={pick.updated_at}
                  readingMinutes={readingMinutes}
                />
              )}
            </header>

            {pick && <ArticleTOC items={tocItems} variant="mobile" />}

            {/* Methodology — only when we have content. Override takes precedence
                over the category default. */}
            {pick && (categoryDef || methodologyOverride) && (
              <MethodologyCallout
                categorySlug={dominantCategory}
                overrideText={methodologyOverride}
                id="how-i-tested"
              />
            )}

            {/* The Picks */}
            {items.length > 0 ? (
              <section id="picks" className="mb-12">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
                  <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">
                    {items.length} dad-tested {items.length === 1 ? 'pick' : 'picks'}
                  </p>
                  <h2 className="text-2xl font-black text-white leading-tight">All personally bought and used</h2>
                </div>

                <div className="space-y-5">
                  {items.map(({ review, blurb, best_for: itemBestFor }, idx) => {
                    const product = review.product_slug ? productMap.get(review.product_slug) : null
                    const href = product?.affiliate_url ? `/go/${product.slug}` : product?.non_affiliate_url ?? null
                    return (
                      <article key={review.id} className="flex flex-col sm:flex-row gap-5 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] hover:border-orange-900/40 rounded-2xl p-5 shadow-lg shadow-black/40 transition-colors">
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
                              <Link href={`/reviews/${review.slug}`} className="text-base font-bold text-white hover:text-orange-400 transition-colors leading-snug block">
                                {review.title}
                              </Link>
                            </div>
                            {review.rating != null && <RatingScore rating={review.rating} size="sm" />}
                          </div>

                          {/* Editor's per-collection "best for" tagline takes the prominent slot */}
                          {itemBestFor && (
                            <p className="text-sm italic text-orange-300/90 mb-2">Best for {itemBestFor}</p>
                          )}

                          <p className="text-sm text-gray-300 leading-relaxed mb-3">
                            {blurb ?? review.tldr ?? review.excerpt ?? ''}
                          </p>

                          {(review.best_for?.length ?? 0) > 0 && (
                            <p className="text-xs text-gray-500 mb-3">
                              <span className="text-orange-400 font-bold uppercase tracking-widest">Also good for:</span> {review.best_for!.slice(0, 3).join(' · ')}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 mt-auto pt-1">
                            <Link href={`/reviews/${review.slug}`} className="text-xs text-gray-400 hover:text-orange-400 transition-colors font-semibold uppercase tracking-widest">
                              Read review →
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
            ) : (
              /* Empty state — proper SEO landing page with email capture */
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

            {pick?.intro_html && (
              <section id="overview" className="mb-12">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
                  <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">Why These</p>
                  <h2 className="text-2xl font-black text-white leading-tight">Behind the picks</h2>
                </div>
                <div
                  className="prose prose-invert prose-orange max-w-none prose-p:text-gray-300 prose-p:leading-relaxed prose-strong:text-white prose-a:text-orange-400 hover:prose-a:text-orange-300 prose-a:no-underline"
                  dangerouslySetInnerHTML={{ __html: pick.intro_html }}
                />
              </section>
            )}

            {pick && faqs.length > 0 && <FAQAccordion faqs={faqs} id="faq" />}

            {pick && <RelatedRail items={related} id="related" heading="Also from The Vault" eyebrow="Beyond gifts" />}

            {/* Related occasions strip — siblings in the same occasion group */}
            {relatedOccasions.length > 0 && (
              <section className="mt-14 pt-10 border-t border-gray-800/60">
                <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
                <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-5">More Gift Guides</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {relatedOccasions.map((r) => (
                    <Link
                      key={r.value}
                      href={`/gifts/${r.slug}`}
                      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] hover:bg-gray-800 hover:border-orange-900/40 rounded-xl transition-colors min-h-[44px]"
                    >
                      <OccasionIcon value={r.value} className="w-6 h-6 shrink-0 text-orange-400" />
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
          </main>

          {pick && <ArticleTOC items={tocItems} variant="desktop" />}
        </div>
      </div>
    </>
  )
}

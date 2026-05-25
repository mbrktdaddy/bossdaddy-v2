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
import FAQAccordion from '@/components/collections/FAQAccordion'
import { faqPageLd } from '@/lib/seo/faq-ld'
import RelatedRail, { type RelatedItem } from '@/components/collections/RelatedRail'
import BenchStrip from '@/components/BenchStrip'

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
  const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(occ.metaTitle)}&type=guide`
  return {
    title: occ.metaTitle,
    description: occ.metaDesc,
    alternates: { canonical: `${siteUrl}/gifts/${occ.slug}` },
    openGraph: {
      title: occ.metaTitle,
      description: occ.metaDesc,
      url: `${siteUrl}/gifts/${occ.slug}`,
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: occ.metaTitle, description: occ.metaDesc, images: [ogImage] },
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
  let items: Array<{ position: number; blurb: string | null; best_for: string | null; role_label: string | null; review: ReviewRow }> = []

  if (pick) {
    const { data: pickItems } = await admin
      .from('collection_items')
      .select('position, blurb, best_for, role_label, reviews(id, slug, title, product_name, category, rating, excerpt, tldr, image_url, product_slug, best_for, has_affiliate_links)')
      .eq('collection_id', pick.id)
      .order('position')

    items = (pickItems ?? []).map((pi) => {
      const reviews = pi.reviews
      const review = Array.isArray(reviews) ? reviews[0] : reviews
      return {
        position:   pi.position,
        blurb:      pi.blurb,
        best_for:   (pi as { best_for?: string | null }).best_for ?? null,
        role_label: (pi as { role_label?: string | null }).role_label ?? null,
        review:     review as ReviewRow,
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

  // Price range pill for the gift-guide header — readers want the budget at a
  // glance before deciding whether to scroll. Skipped when nothing is priced.
  const priceCents = items
    .map((i) => (i.review?.product_slug ? productMap.get(i.review.product_slug)?.price_cents ?? null : null))
    .filter((c): c is number => typeof c === 'number' && c > 0)
  const priceRange = priceCents.length > 0
    ? { min: Math.min(...priceCents), max: Math.max(...priceCents) }
    : null
  const priceRangeLabel = priceRange
    ? (priceRange.min === priceRange.max
        ? `$${(priceRange.min / 100).toFixed(0)}`
        : `$${(priceRange.min / 100).toFixed(0)} – $${(priceRange.max / 100).toFixed(0)}`)
    : null

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

  // FAQs are collection-specific only — no fallback to the dominant category's
  // generic Q&As. Editors fill the FAQ override panel (manually or via the AI
  // fill button) or the section doesn't render. Avoids the "why is this here"
  // feeling when the fallback was a category-wide list unrelated to the gifts.
  const collectionFaqs = (pick as { faqs?: { question: string; answer: string }[] | null } | null)?.faqs
  const faqs = (collectionFaqs ?? []).slice(0, 6)
  const methodologyOverride = (pick as { methodology_html?: string | null } | null)?.methodology_html ?? null

  // TOC order mirrors the section order on the page: lead with the hook
  // (Why These), then methodology, then the picks, then FAQ + related. This
  // matches how readers actually consume a gift guide.
  const tocItems = pick ? [
    ...(pick.intro_html    ? [{ id: 'overview', label: 'Why These' }] : []),
    ...(categoryDef        ? [{ id: 'how-i-tested', label: 'How I Pick Gifts' }] : []),
    { id: 'picks', label: 'The Gifts' },
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
        <div className="flex items-center gap-2 text-xs text-prose-faint mb-6">
          <Link href="/gifts" className="hover:text-accent-text-soft transition-colors">Gift Guides</Link>
          <span>/</span>
          <span className="text-prose-muted">{occ.label}</span>
        </div>

        <div className={pick ? 'lg:flex lg:gap-10 lg:items-start' : ''}>
          <main className={pick ? 'lg:flex-1 lg:max-w-3xl min-w-0' : ''}>
            {/* Hero — image if present, big occasion icon otherwise */}
            {pick?.hero_image_url ? (
              <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden mb-8 bg-surface">
                <Image src={pick.hero_image_url} alt={pick.title ?? occ.label} fill className="object-cover" sizes={pick ? '(max-width: 768px) 100vw, 768px' : '(max-width: 768px) 100vw, 896px'} priority />
              </div>
            ) : (
              <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden mb-8 bg-accent-tint flex items-center justify-center border border-accent-border/20">
                <OccasionIcon value={occ.value} className="w-20 h-20 md:w-24 md:h-24 text-accent-text/70" />
              </div>
            )}

            {/* Header */}
            <header className="mb-8">
              <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
              <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">Gift Guide · {occ.label}</p>
              <h1 className="text-4xl md:text-5xl font-black mb-4 text-prose tracking-tight leading-tight">
                {pick?.title ?? occ.label}
              </h1>
              <p className="text-lg text-prose-muted leading-relaxed mb-6">
                {pick?.description ?? occ.longBlurb}
              </p>
              {pick && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <EditorialMeta
                    publishedAt={pick.published_at}
                    updatedAt={pick.updated_at}
                    readingMinutes={readingMinutes}
                  />
                  {priceRangeLabel && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-tint border border-accent-border/40 text-xs font-bold text-accent-text tabular-nums">
                      <span className="text-eyebrow/70 uppercase tracking-widest text-[10px]">Range</span>
                      {priceRangeLabel}
                    </span>
                  )}
                </div>
              )}
            </header>

            {pick && <ArticleTOC items={tocItems} variant="mobile" />}

            {/* Why These — the hook leads. Moved above methodology + picks so
                readers get context (the "why this list exists" beat) before
                scanning items, the way every major gift-guide reads. */}
            {pick?.intro_html && (
              <section id="overview" className="mb-10">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Why These</p>
                  <h2 className="text-2xl font-black text-prose leading-tight">Behind the picks</h2>
                </div>
                <div
                  className="prose prose-zinc prose-orange max-w-none prose-p:text-prose-muted prose-p:leading-relaxed prose-strong:text-prose prose-a:text-accent-text-soft hover:prose-a:text-accent prose-a:no-underline"
                  dangerouslySetInnerHTML={{ __html: pick.intro_html }}
                />
              </section>
            )}

            {/* Methodology — only when we have content. Override takes precedence
                over the category default. Eyebrow says "How I Pick Gifts" so
                the on-page heading matches the TOC entry one-for-one. */}
            {pick && (categoryDef || methodologyOverride) && (
              <MethodologyCallout
                categorySlug={dominantCategory}
                overrideText={methodologyOverride}
                id="how-i-tested"
                eyebrowLabel="How I Pick Gifts"
              />
            )}

            {/* The Gifts — eyebrow matches the TOC entry one-for-one. */}
            {items.length > 0 ? (
              <section id="picks" className="mb-12">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">The Gifts</p>
                  <h2 className="text-2xl font-black text-prose leading-tight">
                    {items.length} dad-tested {items.length === 1 ? 'gift' : 'gifts'}, all personally bought
                  </h2>
                </div>

                <div className="space-y-5">
                  {items.map(({ review, blurb, best_for: itemBestFor, role_label: itemRoleLabel }, idx) => {
                    const product = review.product_slug ? productMap.get(review.product_slug) : null
                    const href = product?.affiliate_url ? `/go/${product.slug}` : product?.non_affiliate_url ?? null
                    return (
                      <article key={review.id} className="flex flex-col sm:flex-row gap-5 bg-surface border border-soft hover:border-accent-border/40 rounded-xl p-5 shadow-lg shadow-black/5 transition-colors">
                        <div className="flex sm:flex-col items-center gap-3 sm:gap-0 shrink-0">
                          <span className="w-10 h-10 rounded-full bg-accent-tint border border-accent-border/40 flex items-center justify-center text-accent-text-soft font-black text-sm tabular-nums">
                            {idx + 1}
                          </span>
                        </div>

                        {review.image_url && (
                          <div className="relative w-full sm:w-40 h-40 sm:h-32 shrink-0 rounded-xl overflow-hidden bg-surface-raised">
                            <Image src={review.image_url} alt={review.product_name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 160px" />
                            {review.rating != null && review.rating >= 8 && (
                              <div className="absolute top-2 right-2"><BossApprovedBadge size="sm" variant="card" /></div>
                            )}
                          </div>
                        )}

                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="min-w-0">
                              {/* Role chip — the editorial "Best Overall", "For
                                  the New Dad", "Splurge Pick" tag. Sits above
                                  the product name eyebrow so it lands as the
                                  first thing the eye catches. */}
                              {itemRoleLabel && (
                                <span className="inline-block mb-2 px-2.5 py-1 rounded-md bg-accent/15 border border-accent-border/40 text-[10px] font-black uppercase tracking-widest text-accent-text">
                                  {itemRoleLabel}
                                </span>
                              )}
                              <Link href={`/reviews/${review.slug}`} className="text-base font-bold text-prose hover:text-accent-text-soft transition-colors leading-snug block">
                                {review.title}
                              </Link>
                            </div>
                            {review.rating != null && <RatingScore rating={review.rating} size="sm" />}
                          </div>

                          {/* Editor's per-collection "best for" tagline takes the prominent slot */}
                          {itemBestFor && (
                            <p className="text-sm italic text-accent-text/90 mb-2">Best for {itemBestFor}</p>
                          )}

                          <p className="text-sm text-prose-muted leading-relaxed mb-3">
                            {blurb ?? review.tldr ?? review.excerpt ?? ''}
                          </p>

                          {(review.best_for?.length ?? 0) > 0 && (
                            <p className="text-xs text-prose-faint mb-3">
                              <span className="text-accent-text-soft font-bold uppercase tracking-widest">Also good for:</span> {review.best_for!.slice(0, 3).join(' · ')}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 mt-auto pt-1">
                            <Link href={`/reviews/${review.slug}`} className="text-xs text-prose-muted hover:text-accent-text-soft transition-colors font-semibold uppercase tracking-widest">
                              Read review →
                            </Link>
                            {product?.price_cents != null && (
                              <span className="text-xs text-prose-muted font-bold tabular-nums">${(product.price_cents / 100).toFixed(0)}</span>
                            )}
                            {href && (
                              <a
                                href={href}
                                target="_blank"
                                rel={product?.affiliate_url ? 'sponsored nofollow noopener' : 'noopener'}
                                data-product-slug={review.product_slug ?? undefined}
                                className="ml-auto px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-bold rounded-xl transition-colors min-h-[44px] flex items-center"
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
              <div className="bg-accent-tint rounded-xl p-8 md:p-10 border border-accent-border/30 mb-10">
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-bold mb-3">Coming Soon</p>
                <h2 className="text-2xl md:text-3xl font-black text-prose mb-3">
                  The {occ.label} list is being built
                </h2>
                <p className="text-prose-muted leading-relaxed mb-6 max-w-xl">
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

            {pick && faqs.length > 0 && <FAQAccordion faqs={faqs} id="faq" />}

            {pick && <RelatedRail items={related} id="related" eyebrow="Also From The Vault" heading="Keep going beyond gifts" />}

            {/* Related occasions strip — siblings in the same occasion group */}
            {relatedOccasions.length > 0 && (
              <section className="mt-14 pt-10 border-t border-soft">
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-5">More Gift Guides</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {relatedOccasions.map((r) => (
                    <Link
                      key={r.value}
                      href={`/gifts/${r.slug}`}
                      className="flex items-center gap-3 px-4 py-3 bg-surface border border-soft hover:bg-surface-raised hover:border-accent-border/40 rounded-xl transition-colors min-h-[44px]"
                    >
                      <OccasionIcon value={r.value} className="w-6 h-6 shrink-0 text-accent-text-soft" />
                      <span className="text-sm font-semibold text-prose-muted hover:text-prose transition-colors truncate">{r.label}</span>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <Link href="/gifts" className="text-sm text-prose-faint hover:text-accent-text-soft transition-colors">
                    See all gift guides →
                  </Link>
                </div>
              </section>
            )}
            {/* On the Bench */}
            <div className="mt-16">
              <BenchStrip ctaText="See all on the bench" />
            </div>
          </main>

          {pick && <ArticleTOC items={tocItems} variant="desktop" />}
        </div>
      </div>
    </>
  )
}

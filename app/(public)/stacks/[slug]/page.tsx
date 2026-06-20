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
import FAQAccordion from '@/components/collections/FAQAccordion'
import { faqPageLd } from '@/lib/seo/faq-ld'
import { ogImageUrl, toAbsoluteUrl } from '@/lib/og'
import RelatedRail, { type RelatedItem } from '@/components/collections/RelatedRail'
import BenchStrip from '@/components/BenchStrip'

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
    .select('title, description, meta_title, meta_description, updated_at')
    .eq('slug', slug)
    .eq('collection_type', 'stack')
    .eq('is_visible', true)
    .single()
  if (!data) return { title: 'Not Found' }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const metaTitle       = data.meta_title       ?? `The ${data.title} Stack — Dad-Tested Kit`
  const metaDescription = data.meta_description ?? data.description ?? 'A curated kit-for-purpose from Boss Daddy.'
  const ogImage = ogImageUrl({ title: metaTitle, type: 'guide', updatedAt: data.updated_at, base: siteUrl })
  return {
    title:       metaTitle,
    description: metaDescription,
    alternates:  { canonical: `${siteUrl}/stacks/${slug}` },
    openGraph:   { title: metaTitle, description: metaDescription, url: `${siteUrl}/stacks/${slug}`, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter:     { card: 'summary_large_image', title: metaTitle, description: metaDescription, images: [ogImage] },
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
    .select('id, slug, title, description, intro_html, hero_image_url, bundle_total_cents, methodology_html, faqs, published_at, updated_at')
    .eq('slug', slug)
    .eq('collection_type', 'stack')
    .eq('is_visible', true)
    .single()

  if (!stack) notFound()

  const admin = createAdminClient()
  const { data: rawItems } = await admin
    .from('collection_items')
    .select('position, blurb, role_label, reviews(id, slug, title, product_name, category, rating, excerpt, tldr, image_url, product_slug, best_for)')
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

  const productSlugs = [...new Set(items.map((i) => i.review?.product_slug).filter(Boolean) as string[])]
  const productMap = new Map<string, ProductRow>()
  await Promise.all(productSlugs.map(async (ps) => {
    const product = await getProductBySlug(supabase, ps)
    if (product) productMap.set(ps, product as ProductRow)
  }))

  // Build-cost computation — prefer stored total, else sum known prices.
  const { computedTotal, pricedCount } = items.reduce<{ computedTotal: number; pricedCount: number }>(
    (acc, { review }) => {
      const product = review?.product_slug ? productMap.get(review.product_slug) : null
      if (product?.price_cents != null) {
        return { computedTotal: acc.computedTotal + product.price_cents, pricedCount: acc.pricedCount + 1 }
      }
      return acc
    },
    { computedTotal: 0, pricedCount: 0 },
  )
  const total = stack.bundle_total_cents ?? (computedTotal > 0 ? computedTotal : null)
  const partialPricing = stack.bundle_total_cents == null && pricedCount < items.length

  // Dominant category
  const categoryCounts = new Map<string, number>()
  for (const it of items) {
    const c = it.review?.category
    if (c) categoryCounts.set(c, (categoryCounts.get(c) ?? 0) + 1)
  }
  const dominantCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const categoryDef = dominantCategory ? getCategoryBySlug(dominantCategory) : null

  // Related — 2 sibling stacks + 1 comparison + 1 pick
  const [
    { data: otherStacks },
    { data: someComparisons },
    { data: somePicks },
  ] = await Promise.all([
    admin.from('collections').select('slug, title, description, hero_image_url, collection_type').eq('collection_type', 'stack').eq('is_visible', true).neq('id', stack.id).order('published_at', { ascending: false }).limit(2),
    admin.from('collections').select('slug, title, description, hero_image_url, collection_type').eq('collection_type', 'comparison').eq('is_visible', true).order('published_at', { ascending: false }).limit(1),
    admin.from('collections').select('slug, title, description, hero_image_url, collection_type').in('collection_type', ['best_of', 'general']).eq('is_visible', true).order('published_at', { ascending: false }).limit(1),
  ])
  const related: RelatedItem[] = [
    ...((otherStacks      ?? []) as RelatedItem[]),
    ...((someComparisons  ?? []) as RelatedItem[]),
    ...((somePicks        ?? []) as RelatedItem[]),
  ]

  // FAQs are collection-specific only — no fallback to the dominant category's
  // generic Q&As. Editors fill the panel (manually or via AI fill) or the
  // section doesn't render.
  const collectionFaqs = (stack as { faqs?: { question: string; answer: string }[] | null }).faqs
  const faqs = (collectionFaqs ?? []).slice(0, 6)
  const methodologyOverride = (stack as { methodology_html?: string | null }).methodology_html ?? null

  // TOC mirrors the new section order. Labels match the visible eyebrow on
  // each section one-for-one.
  const tocItems = [
    ...(stack.intro_html   ? [{ id: 'overview', label: 'Why These' }] : []),
    ...(categoryDef        ? [{ id: 'how-i-tested', label: 'How I Tested' }] : []),
    { id: 'lineup', label: 'The Lineup' },
    ...(total != null      ? [{ id: 'cost',         label: 'Build Cost' }] : []),
    ...(faqs.length > 0    ? [{ id: 'faq',     label: 'FAQ' }] : []),
    ...(related.length > 0 ? [{ id: 'related', label: 'Also From The Vault' }] : []),
  ]

  const wordsource = [
    stack.intro_html ?? '',
    stack.description ?? '',
    ...items.map((i) => i.blurb ?? i.review?.excerpt ?? ''),
  ].join(' ').replace(/<[^>]*>/g, ' ')
  const readingMinutes = Math.max(1, Math.round(wordsource.split(/\s+/).filter(Boolean).length / 235))

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: stack.title,
    image: toAbsoluteUrl(stack.hero_image_url, siteUrl)
      ?? ogImageUrl({ title: stack.title, type: 'guide', updatedAt: stack.updated_at, base: siteUrl }),
    description: stack.description,
    datePublished: stack.published_at,
    dateModified:  stack.updated_at ?? stack.published_at,
    author: { '@type': 'Person', name: 'Boss Daddy' },
    publisher: { '@type': 'Organization', name: 'Boss Daddy Life', url: siteUrl },
    mainEntityOfPage: `${siteUrl}/stacks/${slug}`,
  }

  const itemListLd = items.length > 0 ? {
    '@context': 'https://schema.org',
    '@type':    'ItemList',
    name:        stack.title,
    description: stack.description ?? undefined,
    numberOfItems: items.length,
    itemListElement: items.map((entry, idx) => ({
      '@type':  'ListItem',
      position: idx + 1,
      url:      `${siteUrl}/reviews/${entry.review!.slug}`,
      name:     entry.review!.product_name,
      item: {
        '@type': 'Product',
        name:    entry.review!.product_name,
        image:   toAbsoluteUrl(entry.review!.image_url, siteUrl),
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}
      {faqLd      && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-xs text-prose-faint mb-8">
          <Link href="/stacks" className="hover:text-accent-text-soft transition-colors">Stacks</Link>
          <span>/</span>
          <span className="text-prose-muted">{stack.title}</span>
        </div>

        <div className="lg:flex lg:gap-10 lg:items-start">
          <main className="lg:flex-1 lg:max-w-3xl min-w-0">
            <header className="mb-8">
              <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
              <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">The Stack</p>
              <h1 className="text-4xl md:text-5xl font-black mb-4 text-prose tracking-tight leading-tight">{stack.title}</h1>
              {stack.description && (
                <p className="text-lg text-prose-muted leading-relaxed mb-6">{stack.description}</p>
              )}
              <EditorialMeta
                publishedAt={stack.published_at}
                updatedAt={stack.updated_at}
                readingMinutes={readingMinutes}
              />
              {/* Build-cost pill in the header — quick-jumps to the breakdown */}
              {total != null && total > 0 && (
                <a
                  href="#cost"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent-tint border border-accent-border/40 hover:border-accent-border/60 rounded-full text-xs font-bold text-accent-text hover:text-accent transition-colors min-h-[36px]"
                >
                  <span className="text-eyebrow/80 uppercase tracking-widest text-[10px]">Build cost</span>
                  <span className="tabular-nums">${(total / 100).toFixed(0)}</span>
                  <span className="text-accent-text/60">·</span>
                  <span className="text-eyebrow/80 text-[10px] uppercase tracking-widest">{items.length} pieces</span>
                </a>
              )}
            </header>

            <ArticleTOC items={tocItems} variant="mobile" />

            {stack.hero_image_url && (
              <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden mb-10 bg-surface">
                <Image src={stack.hero_image_url} alt={stack.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" priority />
              </div>
            )}

            {/* Why These — the editorial framing leads, before methodology + lineup. */}
            {stack.intro_html && (
              <section id="overview" className="mb-10">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Why These</p>
                  <h2 className="text-2xl font-black text-prose leading-tight">Why this kit works together</h2>
                </div>
                <div
                  className="prose prose-zinc prose-orange max-w-none prose-p:text-prose-muted prose-p:leading-relaxed prose-strong:text-prose prose-a:text-accent-text-soft hover:prose-a:text-accent prose-a:no-underline"
                  dangerouslySetInnerHTML={{ __html: stack.intro_html }}
                />
              </section>
            )}

            {/* Methodology — override takes precedence over category default */}
            {(categoryDef || methodologyOverride) && (
              <MethodologyCallout
                categorySlug={dominantCategory}
                overrideText={methodologyOverride}
                id="how-i-tested"
              />
            )}

            {/* Lineup */}
            <section id="lineup" className="mb-12" aria-label="Stack lineup">
              <div className="mb-5">
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">The Lineup</p>
                <h2 className="text-2xl font-black text-prose leading-tight">
                  {items.length} {items.length === 1 ? 'piece' : 'pieces'} in this kit
                </h2>
              </div>

              <div className="space-y-5">
                {items.map(({ review, blurb, role_label }, idx) => {
                  if (!review) return null
                  const product = review.product_slug ? productMap.get(review.product_slug) : null
                  const href = product?.affiliate_url ? `/go/${product.slug}` : product?.non_affiliate_url ?? null
                  const priceCents = product?.price_cents ?? null
                  return (
                    <article
                      key={review.id}
                      className="relative flex flex-col sm:flex-row gap-5 bg-surface border border-soft hover:border-accent-border/40 rounded-xl p-5 shadow-lg shadow-black/5 hover:-translate-y-0.5 transition-all duration-200"
                    >
                      {/* Position number — subtle ordering signal */}
                      <span aria-hidden className="absolute top-3 left-3 text-[10px] font-black text-accent-text/30 tabular-nums tracking-widest">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {review.image_url && (
                        <div className="relative w-full sm:w-44 h-44 sm:h-36 shrink-0 rounded-xl overflow-hidden bg-surface-raised">
                          <Image src={review.image_url} alt={review.product_name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 176px" />
                          {(review.rating ?? 0) >= 8 && (
                            <div className="absolute top-2 right-2"><BossApprovedBadge size="sm" variant="card" /></div>
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0 flex flex-col">
                        {role_label && (
                          <span className="self-start text-[10px] font-black uppercase tracking-[0.2em] text-accent-text bg-accent-tint border border-accent-border/40 px-3 py-1 rounded-full mb-2">
                            {role_label}
                          </span>
                        )}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <Link href={`/reviews/${review.slug}`} className="text-lg font-bold text-prose hover:text-accent-text-soft transition-colors leading-snug block">
                              {review.title}
                            </Link>
                          </div>
                          <RatingScore rating={review.rating ?? 0} size="sm" />
                        </div>
                        {(blurb || review.tldr) && (
                          <p className="text-sm text-prose-muted leading-relaxed flex-1 mb-3">{blurb ?? review.tldr}</p>
                        )}
                        {(review.best_for?.length ?? 0) > 0 && (
                          <p className="text-xs text-prose-faint mb-3">
                            <span className="text-accent-text-soft font-bold uppercase tracking-widest">Best for:</span> {review.best_for!.slice(0, 3).join(' · ')}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-auto pt-1">
                          {priceCents != null && (
                            <span className="text-base font-black text-prose tabular-nums">${(priceCents / 100).toFixed(0)}</span>
                          )}
                          <Link href={`/reviews/${review.slug}`} className="text-xs text-prose-muted hover:text-accent-text-soft transition-colors font-semibold uppercase tracking-widest">
                            Read review →
                          </Link>
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

            {/* Total — prominent build-cost callout */}
            {total != null && total > 0 && (
              <section
                id="cost"
                aria-label="Build cost"
                className="mb-12 rounded-xl border border-accent-border/40 bg-accent-tint p-6 sm:p-8 shadow-lg shadow-black/5 text-center"
              >
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">Build Cost</p>
                <p className="text-4xl sm:text-5xl font-black text-prose tabular-nums mb-2">${(total / 100).toFixed(2)}</p>
                <p className="text-xs text-prose-faint">
                  {partialPricing
                    ? `Partial total · ${pricedCount} of ${items.length} pieces have a listed price`
                    : `Estimated total · ${items.length} ${items.length === 1 ? 'piece' : 'pieces'}`}
                </p>
              </section>
            )}

            {faqs.length > 0 && <FAQAccordion faqs={faqs} id="faq" />}

            <RelatedRail items={related} id="related" eyebrow="Also From The Vault" heading="Keep going" />

            {/* Same-flavor browse link — quiet footer affordance, mirrors the
                "See all gift guides" link gift pages already have. */}
            <div className="mt-8 text-center">
              <Link href="/stacks" className="text-sm text-prose-faint hover:text-accent-text-soft transition-colors">
                Browse all Stacks →
              </Link>
            </div>

            {/* On the Bench */}
            <div className="mt-16">
              <BenchStrip ctaText="See all on the bench" />
            </div>
          </main>

          <ArticleTOC items={tocItems} variant="desktop" />
        </div>
      </div>
    </>
  )
}

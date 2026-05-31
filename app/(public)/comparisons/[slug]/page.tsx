import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import RatingScore from '@/components/RatingScore'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import { getProductsBySlugs, specComparisonRenderable, type ProductSpec, type SpecComparisonColumn } from '@/lib/products'
import SpecComparisonTable from '@/components/products/SpecComparisonTable'
import { getCategoryBySlug } from '@/lib/categories'
import ArticleTOC from '@/components/collections/ArticleTOC'
import EditorialMeta from '@/components/collections/EditorialMeta'
import MethodologyCallout from '@/components/collections/MethodologyCallout'
import FAQAccordion from '@/components/collections/FAQAccordion'
import { faqPageLd } from '@/lib/seo/faq-ld'
import RelatedRail, { type RelatedItem } from '@/components/collections/RelatedRail'
import BenchStrip from '@/components/BenchStrip'

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
  const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(metaTitle)}&type=guide`
  return {
    title:       metaTitle,
    description: metaDescription,
    alternates:  { canonical: `${siteUrl}/comparisons/${slug}` },
    openGraph:   { title: metaTitle, description: metaDescription, url: `${siteUrl}/comparisons/${slug}`, images: [{ url: ogImage, width: 1200, height: 630 }] },
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
    .select('id, slug, title, description, intro_html, hero_image_url, winner_summary, methodology_html, faqs, published_at, updated_at')
    .eq('slug', slug)
    .eq('collection_type', 'comparison')
    .eq('is_visible', true)
    .single()

  if (!comparison) notFound()

  const admin = createAdminClient()
  const { data: rawItems } = await admin
    .from('collection_items')
    .select('position, blurb, wins_category, best_for, reviews(id, slug, title, product_name, category, rating, excerpt, tldr, image_url, product_slug, pros, cons, key_takeaways, best_for, not_for, score_quality, score_value, score_ease, score_daily_use)')
    .eq('collection_id', comparison.id)
    .order('position')

  const items = (rawItems ?? []).map((it) => {
    const r = it.reviews
    const review = Array.isArray(r) ? r[0] : r
    return {
      position: it.position,
      blurb: it.blurb,
      wins_category: it.wins_category,
      best_for: (it as { best_for?: string | null }).best_for ?? null,
      review: review as ReviewRow | null,
    }
  }).filter((i) => i.review != null)

  // Affiliate CTAs + per-item price lookup
  const productSlugs = [...new Set(items.map((i) => i.review?.product_slug).filter(Boolean) as string[])]
  const productMap = new Map<string, { slug: string; affiliate_url: string | null; non_affiliate_url: string | null; price_cents: number | null; brand: string | null; specs: ProductSpec[] }>()
  for (const product of await getProductsBySlugs(supabase, productSlugs)) {
    productMap.set(product.slug, { slug: product.slug, affiliate_url: product.affiliate_url, non_affiliate_url: product.non_affiliate_url, price_cents: product.price_cents, brand: product.brand, specs: product.specs ?? [] })
  }

  // Spec-comparison columns from the linked products, in scorecard order. Header
  // links jump to each contender's deep dive. Self-suppresses when < 2 products
  // carry specs.
  const specColumns: SpecComparisonColumn[] = items.flatMap(({ review }) => {
    const p = review?.product_slug ? productMap.get(review.product_slug) : null
    if (!review || !p) return []
    return [{
      slug: review.slug,
      name: review.product_name,
      brand: p.brand,
      imageUrl: review.image_url,
      href: `#dive-${review.slug}`,
      specs: p.specs,
    }]
  })
  const hasSpecSheet = specComparisonRenderable(specColumns)

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

  // FAQs are collection-specific only — no fallback to the dominant category's
  // generic Q&As. Editors fill the panel (manually or via AI fill) or the
  // section doesn't render. Computed before tocItems so the FAQ TOC entry
  // only appears when there's actually a section to scroll to.
  const collectionFaqs = (comparison as { faqs?: { question: string; answer: string }[] | null }).faqs
  const faqs = (collectionFaqs ?? []).slice(0, 6)

  // TOC items in render order — must match the section ids and eyebrows
  // below one-for-one. Order: Bottom Line (the hook) → Contenders strip →
  // The Take (editorial overview) → Methodology → Scorecard → per-product
  // dives → FAQ → related.
  const tocItems = [
    ...(comparison.winner_summary ? [{ id: 'bottom-line',  label: 'The Bottom Line' }] : []),
    { id: 'contenders',  label: 'The Contenders' },
    ...(comparison.intro_html ? [{ id: 'overview', label: 'The Take' }] : []),
    ...(categoryDef       ? [{ id: 'how-i-tested', label: 'How I Tested' }] : []),
    ...(items.length >= 2 ? [{ id: 'scorecard',    label: 'The Scorecard' }] : []),
    ...(hasSpecSheet       ? [{ id: 'spec-sheet',   label: 'The Spec Sheet' }] : []),
    ...items.map((it) => ({
      id:    `dive-${it.review!.slug}`,
      label: it.review!.product_name,
    })),
    ...(faqs.length > 0    ? [{ id: 'faq',     label: 'FAQ' }] : []),
    ...(related.length > 0 ? [{ id: 'related', label: 'Also From The Vault' }] : []),
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
  const methodologyOverride = (comparison as { methodology_html?: string | null }).methodology_html ?? null
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
    itemListElement: items.map((entry, idx) => {
      const p = entry.review!.product_slug ? productMap.get(entry.review!.product_slug) : null
      const props = (p?.specs ?? []).filter((s) => s.label?.trim() && s.value?.trim())
      return {
        '@type':   'ListItem',
        position:  idx + 1,
        url:       `${siteUrl}/reviews/${entry.review!.slug}`,
        name:      entry.review!.product_name,
        item: {
          '@type':         'Product',
          name:            entry.review!.product_name,
          image:           entry.review!.image_url ?? undefined,
          ...(p?.brand ? { brand: { '@type': 'Brand', name: p.brand } } : {}),
          ...(props.length ? { additionalProperty: props.map((s) => ({ '@type': 'PropertyValue', name: s.label, value: s.value })) } : {}),
          aggregateRating: entry.review!.rating != null ? {
            '@type':       'AggregateRating',
            ratingValue:   entry.review!.rating,
            bestRating:    10,
            worstRating:   1,
            ratingCount:   1,
          } : undefined,
        },
      }
    }),
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
        <div className="flex items-center gap-2 text-xs text-prose-faint mb-8">
          <Link href="/comparisons" className="hover:text-accent-text-soft transition-colors">Comparisons</Link>
          <span>/</span>
          <span className="text-prose-muted">{comparison.title}</span>
        </div>

        <div className="lg:flex lg:gap-10 lg:items-start">
          <main className="lg:flex-1 lg:max-w-3xl min-w-0">
            {/* Editorial header — eyebrow + H1 + dek + byline */}
            <header className="mb-8">
              <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
              <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">Comparison</p>
              <h1 className="text-4xl md:text-5xl font-black mb-4 text-prose tracking-tight leading-tight">{comparison.title}</h1>
              {comparison.description && (
                <p className="text-lg text-prose-muted leading-relaxed mb-6">{comparison.description}</p>
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
              <div className="relative w-full aspect-[16/10] rounded-xl overflow-hidden mb-10 bg-surface">
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
                className="mb-12 rounded-xl border border-accent-border/40 bg-accent-tint p-5 sm:p-7 shadow-lg shadow-black/5"
              >
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">The Bottom Line</p>
                <p className="text-base sm:text-lg text-prose leading-relaxed font-medium">{comparison.winner_summary}</p>
                {/* Quick verdict chips per item */}
                {items.some((i) => i.wins_category) && (
                  <div className="mt-4 pt-4 border-t border-accent-border/30 flex flex-wrap gap-2">
                    {items.filter((i) => i.wins_category).map(({ review, wins_category }) => (
                      <a
                        key={review!.id}
                        href={`#dive-${review!.slug}`}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface border border-accent-border/40 hover:border-accent-border/60 rounded-full text-xs text-prose-muted hover:text-accent transition-colors min-h-[36px]"
                      >
                        <span className="text-[10px] font-bold uppercase tracking-widest text-accent-text-soft">{wins_category}</span>
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
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">The Contenders</p>
                <h2 className="text-2xl font-black text-prose leading-tight">
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

            {/* The Take — editorial overview between the contender strip and
                the scorecard so readers form a narrative mental model before
                they stare at numbers. Eyebrow matches the TOC entry. */}
            {comparison.intro_html && (
              <section id="overview" className="mb-12">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">The Take</p>
                  <h2 className="text-2xl font-black text-prose leading-tight">What sets these apart</h2>
                </div>
                <div
                  className="prose prose-zinc prose-orange max-w-none prose-p:text-prose-muted prose-p:leading-relaxed prose-strong:text-prose prose-a:text-accent-text-soft hover:prose-a:text-accent prose-a:no-underline"
                  dangerouslySetInnerHTML={{ __html: comparison.intro_html }}
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

            {/* Scorecard with image headers — eyebrow matches the TOC entry. */}
            {items.length >= 2 && (
              <section id="scorecard" className="mb-12" aria-label="Scorecard">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">The Scorecard</p>
                  <h2 className="text-2xl font-black text-prose leading-tight">Head-to-head</h2>
                </div>

                <div className="overflow-x-auto -mx-6 px-6">
                  <table className="w-full min-w-[640px] border-separate border-spacing-0 bg-surface border border-soft rounded-xl overflow-hidden">
                    <thead>
                      <tr>
                        <th scope="col" className="text-left px-4 py-3 text-xs uppercase tracking-widest text-prose-faint font-semibold border-b border-soft align-bottom">
                          Criterion
                        </th>
                        {items.map(({ review }) => (
                          <th key={review!.id} scope="col" className="px-3 py-3 border-b border-soft align-bottom min-w-[120px]">
                            <a href={`#dive-${review!.slug}`} className="group block text-center">
                              <div className="relative w-14 h-14 mx-auto mb-2 rounded-xl overflow-hidden bg-surface-sunken border border-soft group-hover:border-accent-border transition-colors">
                                {review!.image_url && (
                                  <Image src={review!.image_url} alt={review!.product_name} fill className="object-cover" sizes="56px" />
                                )}
                              </div>
                              <p className="text-[11px] font-bold text-accent-text-soft leading-tight line-clamp-2 group-hover:text-accent transition-colors">
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
                          <tr key={key} className="border-t border-soft/40">
                            <td className="px-4 py-3 text-sm text-prose-muted font-medium border-t border-soft/40">{label}</td>
                            {items.map(({ review }, idx) => {
                              const v = review?.[key] ?? null
                              const isWinner = winnerIdx === idx && v != null
                              return (
                                <td
                                  key={review!.id}
                                  className={`px-4 py-3 text-center text-sm tabular-nums border-t border-soft/40 ${
                                    isWinner ? 'bg-accent/15 text-accent-text font-bold' : 'text-prose-muted'
                                  }`}
                                >
                                  {v != null ? `${v}/10` : '—'}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                      <tr className="border-t border-soft">
                        <td className="px-4 py-3 text-sm text-prose font-black uppercase tracking-widest text-xs border-t border-soft">Overall</td>
                        {items.map(({ review }) => (
                          <td key={review!.id} className="px-4 py-3 text-center border-t border-soft">
                            <RatingScore rating={review!.rating ?? 0} size="sm" />
                          </td>
                        ))}
                      </tr>
                      {/* Price row — only renders if any item has a price */}
                      {items.some((i) => productMap.get(i.review!.product_slug ?? '')?.price_cents != null) && (
                        <tr className="border-t border-soft/40">
                          <td className="px-4 py-3 text-sm text-prose-muted font-medium border-t border-soft/40">Price</td>
                          {items.map(({ review }) => {
                            const cents = productMap.get(review!.product_slug ?? '')?.price_cents ?? null
                            return (
                              <td key={review!.id} className="px-4 py-3 text-center text-sm text-prose-muted tabular-nums border-t border-soft/40">
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

            {/* Spec sheet — physical specs side by side, complementing the
                sub-score scorecard above. Self-suppresses when < 2 products
                carry specs. */}
            {hasSpecSheet && (
              <SpecComparisonTable
                columns={specColumns}
                id="spec-sheet"
                eyebrow="The Spec Sheet"
                heading="Specs, side by side"
              />
            )}

            {/* Per-product deep dives — alternating image position */}
            <section className="mb-12" aria-label="Per-product deep dives">
              <div className="mb-5">
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">The Breakdown</p>
                <h2 className="text-2xl font-black text-prose leading-tight">Each contender, examined</h2>
              </div>

              <div className="space-y-10">
                {items.map(({ review, blurb, wins_category, best_for: itemBestFor }, idx) => {
                  if (!review) return null
                  const product = review.product_slug ? productMap.get(review.product_slug) : null
                  const href = product?.affiliate_url ? `/go/${product.slug}` : product?.non_affiliate_url ?? null
                  const imageLeft = idx % 2 === 0
                  return (
                    <article
                      key={review.id}
                      id={`dive-${review.slug}`}
                      className="scroll-mt-28 rounded-xl overflow-hidden bg-surface border border-soft shadow-lg shadow-black/5"
                    >
                      <div className={`flex flex-col ${imageLeft ? 'sm:flex-row' : 'sm:flex-row-reverse'} gap-0`}>
                        {/* Hero image column */}
                        {review.image_url && (
                          <div className="relative w-full sm:w-2/5 aspect-[4/3] sm:aspect-auto sm:min-h-[280px] bg-surface-sunken shrink-0">
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
                                <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-accent-text bg-accent-tint border border-accent-border/40 px-2.5 py-1 rounded-full mb-2">{wins_category}</span>
                              )}
                              {itemBestFor && (
                                <p className="text-sm italic text-accent-text/90 mb-2">Best for {itemBestFor}</p>
                              )}
                              <Link href={`/reviews/${review.slug}`} className="text-xl font-black text-prose hover:text-accent-text-soft transition-colors leading-tight block">
                                {review.title}
                              </Link>
                            </div>
                            <RatingScore rating={review.rating ?? 0} size="sm" />
                          </div>

                          {/* Editor's comparison-specific blurb or review excerpt fallback */}
                          {(blurb || review.tldr || review.excerpt) && (
                            <p className="text-sm text-prose-muted leading-relaxed mb-4">{blurb || review.tldr || review.excerpt}</p>
                          )}

                          {/* Pros / Cons */}
                          {((review.pros?.length ?? 0) > 0 || (review.cons?.length ?? 0) > 0) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                              {(review.pros?.length ?? 0) > 0 && (
                                <div className="rounded-xl border border-green-300 bg-green-50 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-forest mb-2">What works</p>
                                  <ul className="space-y-1.5">
                                    {review.pros!.slice(0, 4).map((p, i) => (
                                      <li key={i} className="text-xs text-prose-muted flex items-start gap-1.5 leading-snug">
                                        <svg className="w-3 h-3 mt-0.5 shrink-0 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                        </svg>
                                        <span>{p}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {(review.cons?.length ?? 0) > 0 && (
                                <div className="rounded-xl border border-red-300 bg-red-50 p-3">
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-2">Watch outs</p>
                                  <ul className="space-y-1.5">
                                    {review.cons!.slice(0, 4).map((c, i) => (
                                      <li key={i} className="text-xs text-prose-muted flex items-start gap-1.5 leading-snug">
                                        <svg className="w-3 h-3 mt-0.5 shrink-0 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
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
                            <div className="text-xs text-prose-faint space-y-1 mb-4">
                              {(review.best_for?.length ?? 0) > 0 && (
                                <p><span className="text-accent-text-soft font-bold uppercase tracking-widest">Best for:</span> {review.best_for!.join(' · ')}</p>
                              )}
                              {(review.not_for?.length ?? 0) > 0 && (
                                <p><span className="text-prose-muted font-bold uppercase tracking-widest">Skip if:</span> {review.not_for!.join(' · ')}</p>
                              )}
                            </div>
                          )}

                          {/* CTAs */}
                          <div className="flex flex-wrap items-center gap-3 mt-auto pt-2">
                            <Link href={`/reviews/${review.slug}`} className="text-xs text-prose-muted hover:text-accent-text-soft transition-colors font-semibold uppercase tracking-widest">
                              Read full review →
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
            <RelatedRail items={related} id="related" eyebrow="Also From The Vault" heading="Keep going" />

            {/* Same-flavor browse link — quiet footer affordance for readers
                who finished one head-to-head and want another. */}
            <div className="mt-8 text-center">
              <Link href="/comparisons" className="text-sm text-prose-faint hover:text-accent-text-soft transition-colors">
                Browse all Comparisons →
              </Link>
            </div>

            {/* On the Bench */}
            <div className="mt-16">
              <BenchStrip ctaText="See all on the bench" />
            </div>
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
      className={`group flex flex-col bg-surface border border-soft rounded-xl overflow-hidden shadow-md shadow-black/5 hover:shadow-lg hover:shadow-black/10 hover:border-accent-border/40 hover:-translate-y-1 transition-all ${className ?? ''}`}
    >
      <div className="relative w-full aspect-square bg-surface-sunken">
        {review.image_url && (
          <Image src={review.image_url} alt={review.product_name} fill className="object-cover" sizes="200px" />
        )}
        {(review.rating ?? 0) >= 8 && (
          <div className="absolute top-2 right-2"><BossApprovedBadge size="sm" variant="card" /></div>
        )}
        {winsCategory && (
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-zinc-900/85 via-zinc-900/40 to-transparent px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-700 leading-tight">{winsCategory}</p>
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-prose-faint mb-1 truncate">{review.product_name}</p>
        <p className="text-sm font-bold text-prose group-hover:text-accent-text-soft transition-colors line-clamp-2 leading-snug flex-1">{review.title}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <RatingScore rating={review.rating ?? 0} size="sm" />
          {priceCents != null && (
            <span className="text-xs text-prose-muted font-bold tabular-nums">${(priceCents / 100).toFixed(0)}</span>
          )}
        </div>
      </div>
    </a>
  )
}

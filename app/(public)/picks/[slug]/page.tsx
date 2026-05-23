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
    .select('id, slug, title, description, intro_html, hero_image_url, methodology_html, faqs, published_at, updated_at')
    .eq('slug', slug)
    .eq('is_visible', true)
    .in('collection_type', PICK_TYPES)
    .single()

  if (!pick) notFound()

  const admin = createAdminClient()
  const { data: pickItems } = await admin
    .from('collection_items')
    .select('position, blurb, best_for, role_label, reviews(id, slug, title, product_name, category, rating, excerpt, tldr, image_url, product_slug, pros, cons, best_for, has_affiliate_links)')
    .eq('collection_id', pick.id)
    .order('position')

  const items = (pickItems ?? []).map((pi) => {
    const r = pi.reviews
    const review = Array.isArray(r) ? r[0] : r
    return {
      position:   pi.position,
      blurb:      pi.blurb,
      best_for:   (pi as { best_for?: string | null }).best_for ?? null,
      role_label: (pi as { role_label?: string | null }).role_label ?? null,
      review:     review as ReviewRow | null,
    }
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

  // FAQs are collection-specific only — no fallback to the dominant category's
  // generic Q&As. Editors fill the panel (manually or via AI fill) or the
  // section doesn't render.
  const collectionFaqs = (pick as { faqs?: { question: string; answer: string }[] | null }).faqs
  const faqs = (collectionFaqs ?? []).slice(0, 6)
  const methodologyOverride = (pick as { methodology_html?: string | null }).methodology_html ?? null

  // TOC mirrors the new section order — intro leads, then methodology, then
  // picks, then FAQ + related. Labels match the visible eyebrow on each
  // section one-for-one so jumping to an anchor lands on a heading that
  // says the same words.
  const tocItems = [
    ...(pick.intro_html    ? [{ id: 'overview', label: 'Why These' }] : []),
    ...(categoryDef        ? [{ id: 'how-i-tested', label: 'How I Tested' }] : []),
    { id: 'picks',     label: items.length === 1 ? 'The Pick' : 'The Picks' },
    ...(faqs.length > 0    ? [{ id: 'faq',     label: 'FAQ' }] : []),
    ...(related.length > 0 ? [{ id: 'related', label: 'Also From The Vault' }] : []),
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

  // Skip ItemList when empty — schema.org rejects numberOfItems: 0 and
  // Google flags it as malformed structured data.
  const itemListLd = items.length > 0 ? {
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
  } : null

  const faqLd = faqPageLd(faqs)

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      {itemListLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }} />}
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center gap-2 text-xs text-prose-faint mb-8">
          <Link href="/picks" className="hover:text-accent-text-soft transition-colors">Boss Daddy Picks</Link>
          <span>/</span>
          <span className="text-prose-muted">{pick.title}</span>
        </div>

        <div className="lg:flex lg:gap-10 lg:items-start">
          <main className="lg:flex-1 lg:max-w-3xl min-w-0">
            <header className="mb-8">
              <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
              <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">Boss Daddy Picks</p>
              <h1 className="text-4xl md:text-5xl font-black mb-4 text-prose tracking-tight leading-tight">{pick.title}</h1>
              {pick.description && (
                <p className="text-lg text-prose-muted leading-relaxed mb-6">{pick.description}</p>
              )}
              <EditorialMeta
                publishedAt={pick.published_at}
                updatedAt={pick.updated_at}
                readingMinutes={readingMinutes}
              />
            </header>

            <ArticleTOC items={tocItems} variant="mobile" />

            {pick.hero_image_url && (
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-10 bg-surface">
                <Image src={pick.hero_image_url} alt={pick.title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 768px" priority />
              </div>
            )}

            {/* Why These — the editorial hook leads, before methodology + picks. */}
            {pick.intro_html && (
              <section id="overview" className="mb-10">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Why These</p>
                  <h2 className="text-2xl font-black text-prose leading-tight">Behind the picks</h2>
                </div>
                <div
                  className="prose prose-orange max-w-none prose-p:text-prose-muted prose-p:leading-relaxed prose-strong:text-prose prose-a:text-accent-text-soft hover:prose-a:text-accent prose-a:no-underline"
                  dangerouslySetInnerHTML={{ __html: pick.intro_html }}
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

            {/* The Picks — eyebrow matches the TOC entry. */}
            <section id="picks" className="mb-12" aria-label="The picks">
              <div className="mb-5">
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">
                  {items.length === 1 ? 'The Pick' : 'The Picks'}
                </p>
                <h2 className="text-2xl font-black text-prose leading-tight">
                  {items.length} dad-tested {items.length === 1 ? 'pick' : 'picks'}, all personally tested
                </h2>
              </div>

              <div className="space-y-5">
                {items.map(({ review, blurb, best_for: itemBestFor, role_label: itemRoleLabel }, idx) => {
                  if (!review) return null
                  const product = review.product_slug ? productMap.get(review.product_slug) : null
                  const href = product?.affiliate_url ? `/go/${product.slug}` : product?.non_affiliate_url ?? null
                  const rank = idx + 1
                  return (
                    <article key={review.id} className="flex flex-col sm:flex-row gap-5 bg-gradient-to-br from-surface to-surface/60 border border-soft/60 ring-1 ring-inset ring-stone-900/[0.04] hover:border-accent-border/40 rounded-2xl p-5 shadow-lg shadow-stone-900/[0.06] transition-colors">
                      {/* Rank — medal for top 3, number for the rest */}
                      <div className="flex sm:flex-col items-center gap-3 sm:gap-1 shrink-0">
                        <RankMedal rank={rank} />
                      </div>

                      {review.image_url && (
                        <div className="relative w-full sm:w-40 h-40 sm:h-32 shrink-0 rounded-xl overflow-hidden bg-surface-raised">
                          <Image src={review.image_url} alt={review.product_name} fill className="object-cover" sizes="(max-width: 640px) 100vw, 160px" />
                          {review.rating >= 8 && (
                            <div className="absolute top-2 right-2"><BossApprovedBadge size="sm" variant="card" /></div>
                          )}
                        </div>
                      )}

                      <div className="flex-1 min-w-0 flex flex-col">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            {/* Role chip — editorial tag from the workspace. */}
                            {itemRoleLabel && (
                              <span className="inline-block mb-2 px-2.5 py-1 rounded-md bg-accent/15 border border-accent-border/40 text-[10px] font-black uppercase tracking-widest text-accent-text">
                                {itemRoleLabel}
                              </span>
                            )}
                            <Link href={`/reviews/${review.slug}`} className="text-lg font-bold text-prose hover:text-accent-text-soft transition-colors leading-snug block">
                              {review.title}
                            </Link>
                          </div>
                          <RatingScore rating={review.rating} size="sm" />
                        </div>

                        {/* Editor's per-collection "best for" tagline — italic, prominent */}
                        {itemBestFor && (
                          <p className="text-sm italic text-accent-text/90 mb-2">Best for {itemBestFor}</p>
                        )}

                        <p className="text-sm text-prose-muted leading-relaxed mb-3">
                          {blurb ?? review.tldr ?? review.excerpt ?? product?.description ?? ''}
                        </p>

                        {/* Review's own best_for tags — generic audience hints */}
                        {(review.best_for?.length ?? 0) > 0 && (
                          <p className="text-xs text-prose-faint mb-3">
                            <span className="text-accent-text-soft font-bold uppercase tracking-widest">Also good for:</span> {review.best_for!.slice(0, 3).join(' · ')}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mt-auto pt-1">
                          <Link href={`/reviews/${review.slug}`} className="text-xs text-prose-muted hover:text-accent-text-soft transition-colors font-semibold uppercase tracking-widest">
                            Read full review →
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

            {faqs.length > 0 && <FAQAccordion faqs={faqs} id="faq" />}

            <RelatedRail items={related} id="related" eyebrow="Also From The Vault" heading="Keep going" />

            {/* Same-flavor browse link — a quiet footer affordance for readers
                who finished one list and want more of the same kind. The
                RelatedRail above handles cross-flavor discovery; this is
                the "I want another list like this" path. */}
            <div className="mt-8 text-center">
              <Link href="/picks" className="text-sm text-prose-faint hover:text-accent-text-soft transition-colors">
                Browse all Boss Daddy Picks →
              </Link>
            </div>
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
        <span className={`relative w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center font-black text-base ${colors.text} shadow-lg shadow-stone-900/[0.06] ring-2 ring-stone-900/30`}>
          <svg className="absolute -top-1 -right-1 w-4 h-4 text-accent-text-soft drop-shadow" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          {rank}
        </span>
        <span className="hidden sm:block text-[10px] text-prose-faint uppercase tracking-widest font-bold">{colors.label}</span>
      </div>
    )
  }
  return (
    <span className="w-12 h-12 rounded-full bg-accent-tint border border-accent-border/40 flex items-center justify-center text-accent-text-soft font-black text-sm tabular-nums">
      {rank}
    </span>
  )
}

import { cache, Suspense } from 'react'
import dynamic from 'next/dynamic'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { FTC_DISCLOSURE_HTML } from '@/lib/affiliate'
import { getCategoryBySlug } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import ProductCtaCard from '@/components/ProductCtaCard'
import CollectionEmbed from '@/components/CollectionEmbed'
import ReadingProgressBar from '@/components/ReadingProgressBar'
import RatingScore from '@/components/RatingScore'
import ShareButtons from '@/components/ShareButtons'
import ViewTracker from '@/components/ViewTracker'
import LikeButton from '@/components/LikeButton'
import CommentForm from '@/components/CommentForm'
import CommentList from '@/components/CommentList'
import ImageLightbox from '@/components/ImageLightbox'
import { MerchCallout } from '@/components/MerchCallout'
import { LightboxImage } from '@/components/LightboxImage'
import { EmailSignup } from '@/components/EmailSignup'
import AuthorBio from '@/components/AuthorBio'
import CategoryIcon from '@/components/CategoryIcon'
import TrackView from '@/components/TrackView'
import RecentlyViewedStrip from '@/components/RecentlyViewedStrip'
import AskTheBoss from '@/components/AskTheBoss'

const TableOfContents = dynamic(() => import('@/components/TableOfContents'))
const EngagementTracker = dynamic(() => import('@/components/EngagementTracker'))

export const revalidate = 60

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('guides')
    .select('slug')
    .eq('status', 'approved')
    .eq('is_visible', true)
  return (data ?? []).map(({ slug }) => ({ slug }))
}

const getGuide = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('guides')
    .select('id, title, slug, category, content, excerpt, image_url, has_affiliate_links, published_at, reading_time_minutes, meta_title, meta_description, tldr, key_takeaways, faqs, profiles(username)')
    .eq('slug', slug)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .single()
  return data
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getGuide(slug)

  if (!data) return { title: 'Guide Not Found' }

  const pageTitle       = data.meta_title?.trim()       || data.title
  const pageDescription = data.meta_description?.trim() || data.excerpt || undefined

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const canonicalUrl = `${siteUrl}/guides/${slug}`
  const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(data.title)}&type=guide`

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: { canonical: canonicalUrl },
    openGraph: { title: pageTitle, description: pageDescription, type: 'article', url: canonicalUrl, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: pageTitle, description: pageDescription, images: [ogImage] },
  }
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const guide = await getGuide(slug)

  if (!guide) notFound()

  const supabase = await createClient()

  // Extract product slugs referenced inline in the guide body
  const mentionedSlugs = extractProductSlugs(guide.content)

  const [{ data: related }, { data: relatedReviews }, { data: mentionedProducts }] = await Promise.all([
    // Related guides — same category, exclude current
    supabase
      .from('guides')
      .select('id, slug, title, excerpt, image_url, reading_time_minutes, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .eq('category', guide.category)
      .neq('slug', slug)
      .order('published_at', { ascending: false })
      .limit(3),
    // Top-rated reviews in the same category
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, rating, excerpt, image_url')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .eq('category', guide.category)
      .order('rating', { ascending: false })
      .limit(3),
    // Products referenced inline via [[BUY:slug]] tokens
    mentionedSlugs.length > 0
      ? supabase
          .from('products')
          .select('slug, name, affiliate_url, non_affiliate_url, store, custom_store_name, image_url')
          .in('slug', mentionedSlugs)
      : Promise.resolve({ data: [] as { slug: string; name: string; affiliate_url: string | null; non_affiliate_url: string | null; store: string; custom_store_name: string | null; image_url: string | null }[], error: null }),
  ])

  type FAQ = { question: string; answer: string }
  const guideFaqs = (guide.faqs ?? []) as FAQ[]
  const guideKeyTakeaways = (guide.key_takeaways ?? []) as string[]

  const profileData = Array.isArray(guide.profiles)
    ? guide.profiles[0]
    : (guide.profiles as unknown as { username: string } | null)
  const author = profileData?.username ?? 'Boss Daddy'
  const category = getCategoryBySlug(guide.category ?? '')

  const faqJsonLd = guideFaqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: guideFaqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    author: { '@type': 'Person', name: author },
    datePublished: guide.published_at,
    publisher: { '@type': 'Organization', name: 'Boss Daddy Life', url: siteUrl },
    url: `${siteUrl}/guides/${slug}`,
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Guides', item: `${siteUrl}/guides` },
      ...(category ? [{ '@type': 'ListItem', position: 3, name: category.label, item: `${siteUrl}/category/${category.slug}` }] : []),
      { '@type': 'ListItem', position: category ? 4 : 3, name: guide.title, item: `${siteUrl}/guides/${slug}` },
    ],
  }

  return (
    <>
      <ReadingProgressBar />
      <ViewTracker id={guide.id} type="guide" />
      <TrackView slug={guide.slug} title={guide.title} type="guide" category={guide.category ?? null} image_url={guide.image_url ?? null} />
      <EngagementTracker contentType="guide" contentId={guide.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <div className="max-w-[1100px] mx-auto px-6 py-12">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3 text-sm text-prose-muted mb-8 flex-wrap">
          <Link href="/guides" className="py-2 inline-block hover:text-prose transition-colors">← Guides</Link>
          {category && (
            <>
              <span className="text-prose-faint">/</span>
              <Link href={`/category/${category.slug}`} className="flex items-center gap-1.5 py-2 inline-block hover:text-prose transition-colors text-prose-muted">
                <CategoryIcon slug={category.slug} className="w-4 h-4 text-accent-text" /> {category.label}
              </Link>
            </>
          )}
        </div>

        {/* FTC Disclosure — rendered whenever the guide contains affiliate links */}
        {guide.has_affiliate_links && (
          <div
            className="mb-8 text-xs text-prose-faint bg-surface rounded-xl px-4 py-3 shadow-md shadow-black/5"
            dangerouslySetInnerHTML={{ __html: FTC_DISCLOSURE_HTML }}
          />
        )}

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-6 tracking-tight">{guide.title}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-prose-muted pb-6">
            <span>by <Link href={`/author/${author}`} className="text-prose-muted hover:text-accent-text-soft transition-colors">@{author}</Link></span>
            {guide.published_at && (
              <span>
                {new Date(guide.published_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </span>
            )}
            {guide.reading_time_minutes && (
              <span>{guide.reading_time_minutes} min read</span>
            )}
          </div>
        </div>

        {/* Hero image */}
        {guide.image_url && (
          <LightboxImage src={guide.image_url} alt={guide.title}>
            <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden mb-10 bg-surface">
              <Image
                src={guide.image_url}
                alt={guide.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 768px"
                priority
              />
            </div>
          </LightboxImage>
        )}

        {/* TL;DR box */}
        {(guide.tldr || guideKeyTakeaways.length > 0) && (
          <div className="mb-10 bg-accent-tint border border-accent-border/40 rounded-xl p-5 sm:p-6">
            <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
            <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">TL;DR</p>
            {guide.tldr && (
              <p className="text-prose leading-relaxed text-sm sm:text-base mb-4">{guide.tldr}</p>
            )}
            {guideKeyTakeaways.length > 0 && (
              <ul className="space-y-2">
                {guideKeyTakeaways.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-prose-muted">
                    <span className="text-accent-text mt-0.5 shrink-0">→</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div className="lg:grid lg:grid-cols-[1fr_280px] lg:gap-10 lg:items-start">

          {/* Main column */}
          <div className="min-w-0">

            {/* TOC — mobile/tablet only; desktop version lives in sidebar */}
            <div className="mb-10 lg:hidden">
              <TableOfContents />
            </div>

            {/* Guide body — ProductCtaCards injected inline at [[BUY:slug]] positions */}
            <div className="overflow-x-auto min-w-0 w-full">
              <ImageLightbox className="bd-content">
                {splitContentForInlineCards(guide.content, mentionedProducts ?? []).map((segment, i) => {
                  if (segment.type === 'product') {
                    return (
                      <ProductCtaCard
                        key={`card-${i}`}
                        product={segment.product}
                        variant="prominent"
                      />
                    )
                  }
                  if (segment.type === 'collection') {
                    return <CollectionEmbed key={`embed-${i}`} slug={segment.slug} />
                  }
                  return segment.content ? (
                    <div
                      key={`html-${i}`}
                      className="bd-editorial prose prose-lg prose-zinc prose-orange mx-auto max-w-[68ch]
                        prose-headings:font-black prose-headings:tracking-tight prose-headings:font-sans prose-headings:leading-[1.15]
                        prose-h2:text-2xl prose-h2:mt-14 prose-h2:mb-5
                        prose-h3:mt-10 prose-h3:mb-3
                        [&>*:first-child]:mt-0
                        prose-p:text-prose-muted prose-p:leading-[1.85]
                        prose-a:text-accent-text-soft prose-a:no-underline hover:prose-a:text-accent
                        prose-strong:text-prose
                        prose-li:text-prose-muted prose-li:leading-[1.85]"
                      dangerouslySetInnerHTML={{ __html: segment.content }}
                    />
                  ) : null
                })}
              </ImageLightbox>
            </div>

            {/* FAQ accordion */}
            {guideFaqs.length > 0 && (
              <div className="mt-12 pt-8 border-t border-soft">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Common Questions</p>
                  <h2 className="text-xl font-black">Frequently Asked Questions</h2>
                </div>
                <div className="space-y-2">
                  {guideFaqs.map((faq, i) => (
                    <details key={i} className="group bg-surface border border-soft hover:border-accent-border/40 transition-colors rounded-xl overflow-hidden">
                      <summary className="flex items-center justify-between gap-3 px-4 py-3.5 cursor-pointer list-none min-h-[44px]">
                        <span className="text-sm font-semibold text-prose leading-snug">{faq.question}</span>
                        <svg className="w-4 h-4 shrink-0 text-accent-text transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </summary>
                      <div className="px-4 pb-4 pt-1 text-sm text-prose-muted leading-relaxed border-t border-soft">
                        {faq.answer}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {/* Email signup CTA */}
            <div className="mt-12 pt-8">
              <div className="bg-surface-raised border border-soft rounded-xl p-6 sm:p-8 text-center shadow-xl shadow-black/5">
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3 mx-auto" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Liked this guide?</p>
                <h3 className="text-xl font-black mb-2">Get the next one in your inbox</h3>
                <p className="text-sm text-prose-muted mb-5 max-w-md mx-auto">
                  One email when there&apos;s actually something worth saying. Plus dad-tested stuff before they go up.
                </p>
                <div className="max-w-md mx-auto">
                  <EmailSignup
                    heading={null}
                    description={null}
                    buttonLabel="Sign me up"
                    successMessage="You're in. Welcome to the crew."
                    interests={['newsletter']}
                  />
                </div>
              </div>
            </div>

            {/* Related reviews */}
            {relatedReviews && relatedReviews.length > 0 && (
              <div className="mt-12">
                <div className="flex items-end justify-between mb-5">
                  <div>
                    <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                    <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Reviews</p>
                    <h2 className="text-lg font-black">
                      {category ? `${category.label} Reviews` : 'Related Reviews'}
                    </h2>
                  </div>
                  {category && (
                    <Link href={`/category/${category.slug}`} className="text-xs text-prose-faint hover:text-accent-text-soft transition-colors font-medium">
                      Browse all →
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {relatedReviews.map((r, i) => (
                    <Link
                      key={r.id}
                      href={`/reviews/${r.slug}`}
                      className="group flex flex-col bg-surface border border-soft rounded-xl overflow-hidden shadow-md shadow-black/5 hover:shadow-lg hover:shadow-black/10 hover:border-accent-border/40 hover:-translate-y-1 transition-all duration-200"
                    >
                      {r.image_url ? (
                        <div className="relative w-full h-36 bg-surface-raised shrink-0">
                          <Image
                            src={r.image_url}
                            alt={r.product_name}
                            fill
                            priority={i === 0}
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="(max-width: 640px) 100vw, 33vw"
                          />
                          {(r.rating ?? 0) >= 8 && (
                            <div className="absolute top-2 right-2">
                              <BossApprovedBadge size="sm" variant="card" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-36 bg-surface-raised flex items-center justify-center shrink-0">
                          {category && <CategoryIcon slug={category.slug} className="w-7 h-7 text-accent-text opacity-30" />}
                        </div>
                      )}
                      <div className="p-4 flex flex-col flex-1">
                        <div className="flex items-center justify-end mb-2">
                          <RatingScore rating={r.rating ?? 0} size="sm" />
                        </div>
                        <p className="text-sm font-semibold leading-snug group-hover:text-accent-text-soft transition-colors flex-1">
                          {r.title}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Related guides */}
            {related && related.length > 0 && (
              <div className="mt-12">
                <div className="mb-5">
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Guides</p>
                  <h2 className="text-lg font-black">More Guides</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {related.map((a, i) => (
                    <Link
                      key={a.id}
                      href={`/guides/${a.slug}`}
                      className="group flex flex-col bg-surface border border-soft rounded-xl overflow-hidden shadow-md shadow-black/5 hover:shadow-lg hover:shadow-black/10 hover:border-accent-border/40 hover:-translate-y-1 transition-all duration-200"
                    >
                      {a.image_url ? (
                        <div className="relative w-full h-36 bg-surface-raised shrink-0 overflow-hidden">
                          <Image
                            src={a.image_url}
                            alt={a.title}
                            fill
                            priority={i === 0}
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            sizes="(max-width: 640px) 100vw, 33vw"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-36 bg-surface-raised flex items-center justify-center shrink-0">
                          {category && <CategoryIcon slug={category.slug} className="w-7 h-7 text-accent-text opacity-30" />}
                        </div>
                      )}
                      <div className="p-4 flex flex-col flex-1">
                        <p className="text-sm font-semibold leading-snug group-hover:text-accent-text-soft transition-colors flex-1">
                          {a.title}
                        </p>
                        {a.excerpt && (
                          <p className="text-xs text-prose-faint mt-1.5 line-clamp-2">{a.excerpt}</p>
                        )}
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-prose-faint">
                            {a.published_at ? new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                          </span>
                          {a.reading_time_minutes && (
                            <span className="text-xs text-prose-faint">{a.reading_time_minutes} min read</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Author bio */}
            <AuthorBio username={author} />

            <AskTheBoss
              context={`the guide: ${guide.title}`}
              prompt="Want tested gear that fits what this guide covers? Ask the Boss."
              className="mt-12"
            />

            {/* Like + Share */}
            <div className="mt-8 pt-6 flex items-center justify-between flex-wrap gap-4">
              <LikeButton contentType="guide" contentId={guide.id} />
              <ShareButtons title={guide.title} />
            </div>

            {/* Comments */}
            <div className="mt-12">
              <h2 className="text-lg font-black mb-6">Comments</h2>
              <CommentList contentType="guide" contentId={guide.id} />
              <div className="mt-6">
                <CommentForm contentType="guide" contentId={guide.id} />
              </div>
            </div>

            {/* Merch callout */}
            <Suspense fallback={null}>
              <MerchCallout />
            </Suspense>

            {/* Recently viewed — client-side localStorage, excludes current page */}
            <RecentlyViewedStrip
              exclude={{ slug: guide.slug, type: 'guide' }}
              className="mt-12"
            />

          </div>{/* end main column */}

          {/* ── Sidebar — desktop only ──────────────────────────────────── */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-5">

              {/* Sticky TOC */}
              <TableOfContents />

              {/* Compact products panel — in mention order */}
              {mentionedProducts && mentionedProducts.length > 0 && (
                <div className="bg-surface border border-soft hover:border-accent-border/40 transition-colors rounded-xl p-4">
                  <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                  <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">Products Mentioned</p>
                  <ul className="space-y-3">
                    {mentionedSlugs
                      .map((s) => mentionedProducts.find((p) => p.slug === s))
                      .filter(Boolean)
                      .map((product) => {
                        const href = product!.affiliate_url ? `/go/${product!.slug}` : product!.non_affiliate_url
                        if (!href) return null
                        const isAffiliate = Boolean(product!.affiliate_url)
                        return (
                          <li key={product!.slug} className="flex items-start gap-2.5">
                            {product!.image_url && (
                              <div className="relative w-9 h-9 shrink-0 rounded-lg overflow-hidden bg-surface-sunken">
                                <Image
                                  src={product!.image_url}
                                  alt={product!.name}
                                  fill
                                  className="object-contain p-0.5"
                                  sizes="36px"
                                />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-prose leading-snug line-clamp-2 mb-1.5">{product!.name}</p>
                              <a
                                href={href}
                                target="_blank"
                                rel={isAffiliate ? 'sponsored nofollow noopener' : 'noopener'}
                                data-product-slug={product!.slug}
                                className="text-[10px] font-bold text-accent-text-soft hover:text-accent transition-colors uppercase tracking-wide"
                              >
                                Check Price →
                              </a>
                            </div>
                          </li>
                        )
                      })}
                  </ul>
                </div>
              )}

            </div>
          </aside>

        </div>{/* end two-column grid */}

      </div>
    </>
  )
}

function extractProductSlugs(html: string): string[] {
  const seen = new Set<string>()
  const regex = /data-product-slug="([^"]+)"/g
  let match
  while ((match = regex.exec(html)) !== null) {
    seen.add(match[1])
  }
  return Array.from(seen)
}

type InlineProduct = {
  slug: string
  name: string
  affiliate_url: string | null
  non_affiliate_url: string | null
  store: string
  custom_store_name: string | null
  image_url: string | null
}

type ContentSegment =
  | { type: 'html'; content: string }
  | { type: 'product'; product: InlineProduct }
  | { type: 'collection'; slug: string }

function splitContentForInlineCards(html: string, products: InlineProduct[]): ContentSegment[] {
  // Standalone [[BUY:slug]] anchor (post-resolve form)
  const productRe = /<p>\s*<a\s[^>]*data-product-slug="([^"]+)"[^>]*>[^<]*<\/a>\s*<\/p>/g
  // Standalone [[COLLECTION:slug]] embed marker (post-resolve form)
  const collectionRe = /<div\s+class="bd-collection-embed"\s+data-collection-slug="([a-z0-9-]+)"[^>]*>\s*<\/div>/g

  // Gather both kinds of inline-replaceable matches, sort by position, then
  // weave them into segments so the prose between them stays intact.
  type RawMatch = { index: number; length: number; segment: ContentSegment }
  const matches: RawMatch[] = []
  let m: RegExpExecArray | null
  while ((m = productRe.exec(html)) !== null) {
    const product = products.find((p) => p.slug === m![1])
    if (!product) continue
    matches.push({ index: m.index, length: m[0].length, segment: { type: 'product', product } })
  }
  while ((m = collectionRe.exec(html)) !== null) {
    matches.push({ index: m.index, length: m[0].length, segment: { type: 'collection', slug: m[1] } })
  }
  matches.sort((a, b) => a.index - b.index)

  const segments: ContentSegment[] = []
  let lastIndex = 0
  for (const match of matches) {
    if (match.index > lastIndex) {
      segments.push({ type: 'html', content: html.slice(lastIndex, match.index) })
    }
    segments.push(match.segment)
    lastIndex = match.index + match.length
  }
  if (lastIndex < html.length) {
    segments.push({ type: 'html', content: html.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'html', content: html }]
}

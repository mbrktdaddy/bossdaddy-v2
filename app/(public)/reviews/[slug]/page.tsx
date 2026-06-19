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
import ShareButtons from '@/components/ShareButtons'
import RatingScore from '@/components/RatingScore'
import VerdictCard from '@/components/reviews/VerdictCard'
import TakeawaysCard from '@/components/reviews/TakeawaysCard'
import TrustReceipt from '@/components/reviews/TrustReceipt'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import ViewTracker from '@/components/ViewTracker'
import LikeButton from '@/components/LikeButton'
import CommentForm from '@/components/CommentForm'
import CommentList from '@/components/CommentList'
import RatingWidget from '@/components/RatingWidget'
import ImageLightbox from '@/components/ImageLightbox'
import { LightboxImage } from '@/components/LightboxImage'
import { MerchCallout } from '@/components/MerchCallout'
import CollectionsForReview from '@/components/CollectionsForReview'
import ProductCtaCard from '@/components/ProductCtaCard'
import StickyMobileCta from '@/components/StickyMobileCta'
import ReadingProgressBar from '@/components/ReadingProgressBar'
import { EmailSignup } from '@/components/EmailSignup'
import AuthorBio from '@/components/AuthorBio'
import { getProductBySlug, getProductsBySlugs, columnHasSpecs, specComparisonRenderable, type SpecComparisonColumn } from '@/lib/products'
import SpecComparisonTable from '@/components/products/SpecComparisonTable'
import BenchStrip from '@/components/BenchStrip'
import AskTheBoss from '@/components/AskTheBoss'
import CategoryIcon from '@/components/CategoryIcon'
import { ReviewTimelineStrip } from '@/components/reviews/ReviewTimelineStrip'
import { VerdictChangeBadge } from '@/components/reviews/VerdictChangeBadge'
import { getReviewTimeline, transformFollowupContent, parseSpecsGradeData, type VerdictChange } from '@/lib/reviews'
import TrackView from '@/components/TrackView'
import RecentlyViewedStrip from '@/components/RecentlyViewedStrip'

const EngagementTracker = dynamic(() => import('@/components/EngagementTracker'))

export const revalidate = 60

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('reviews')
    .select('slug')
    .eq('status', 'approved')
    .eq('is_visible', true)
  return (data ?? []).map(({ slug }) => ({ slug }))
}

const getReview = cache(async (slug: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, content, rating, excerpt, image_url, has_affiliate_links, product_slug, comparison_product_slugs, published_at, meta_title, meta_description, tldr, key_takeaways, faqs, testing_duration, testing_since, testing_note, price_paid_cents, score_quality, score_value, score_ease, score_daily_use, score_specs, specs_grade_rationale, specs_grade_data, would_rebuy, parent_review_id, milestone_label, milestone_days, previous_rating, verdict_change, reading_time_minutes, profiles(username)')
    .eq('slug', slug)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .single()
  return data
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const data = await getReview(slug)

  if (!data) return { title: 'Review Not Found' }

  const pageTitle       = data.meta_title?.trim()       || data.title
  const pageDescription = data.meta_description?.trim() || data.excerpt
    || `Dad-tested review of the ${data.product_name}. Honest pros, cons, and verdict.`

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const canonicalUrl = `${siteUrl}/reviews/${slug}`
  const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(data.title)}&type=review`

  return {
    title: pageTitle,
    description: pageDescription,
    alternates: { canonical: canonicalUrl },
    openGraph: { title: pageTitle, description: pageDescription, type: 'article', url: canonicalUrl, images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: pageTitle, description: pageDescription, images: [ogImage] },
  }
}


export default async function ReviewPage({ params }: Props) {
  const { slug } = await params
  const review = await getReview(slug)

  if (!review) notFound()

  const supabase = await createClient()

  // Related reviews + product + bench back-link + lifecycle timeline fetched
  // in parallel — they don't depend on each other. Bench back-link closes the
  // first lifecycle loop (wishlist → review); timeline closes the second
  // (review → follow-up → re-verdict).
  const comparisonSlugs = (review.comparison_product_slugs as string[] | null) ?? []

  const [{ data: related }, product, { data: benchItem }, timeline, competitorProducts] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, rating, excerpt')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .eq('category', review.category)
      .neq('slug', slug)
      .order('published_at', { ascending: false })
      .limit(3),
    review.product_slug
      ? getProductBySlug(supabase, review.product_slug)
      : Promise.resolve(null),
    supabase
      .from('products')
      .select('slug, title:name')
      .eq('review_id', review.id)
      .maybeSingle(),
    getReviewTimeline(supabase, review.id, review.parent_review_id),
    comparisonSlugs.length ? getProductsBySlugs(supabase, comparisonSlugs) : Promise.resolve([]),
  ])

  // Spec-comparison columns: the review's own product first (highlighted), then
  // each chosen competitor in saved order. The table self-suppresses when there
  // are < 2 columns or no shared/known specs, so this is safe to always build.
  // A "how it compares" table only makes sense with the reviewed product as the
  // subject — so competitor columns are built only when this review links a
  // catalog product. Without that primary, we render nothing (a head-to-head of
  // rivals with no subject would be misleading).
  const specColumns: SpecComparisonColumn[] = []
  if (product) {
    specColumns.push({
      slug: product.slug,
      name: review.product_name,
      brand: product.brand,
      imageUrl: product.image_url,
      isPrimary: true,
      specs: product.specs ?? [],
    })
    for (const cs of comparisonSlugs) {
      const cp = competitorProducts.find((p) => p.slug === cs)
      if (cp) specColumns.push({ slug: cp.slug, name: cp.name, brand: cp.brand, imageUrl: cp.image_url, specs: cp.specs ?? [] })
    }
  }
  // Show the review's comparison table only when the reviewed product itself
  // carries specs AND ≥2 columns have real specs. A specs-only review (no
  // competitors, or sparse competitor data) shows no table here — its specs
  // still power the draft prose + structured data. Full comparisons are the
  // Vault's job; this surface stays opt-in.
  const hasSpecComparison =
    specColumns.length > 0 && columnHasSpecs(specColumns[0]) && specComparisonRenderable(specColumns)

  const isFollowup = review.parent_review_id !== null
  const parentNode = timeline.find((n) => n.is_parent) ?? null
  const verdictChange = review.verdict_change as VerdictChange | null

  // On follow-up pages, transform the body so the 4 required headings render
  // as <details open> blocks (skim-readers can collapse; SEO still sees the h2).
  // Top-level reviews keep the existing plain-prose treatment.
  const bodyTransform = isFollowup ? transformFollowupContent(review.content) : null
  const renderedBodyHtml = bodyTransform ? bodyTransform.html : review.content
  const followupToc = bodyTransform?.toc ?? []

  const profileData = Array.isArray(review.profiles)
    ? review.profiles[0]
    : (review.profiles as unknown as { username: string } | null)
  const author = profileData?.username ?? 'Boss Daddy'
  const category = getCategoryBySlug(review.category ?? '')

  const tldr          = review.tldr as string | null
  const keyTakeaways  = (review.key_takeaways as string[] | null) ?? []
  const faqs          = (review.faqs as { question: string; answer: string }[] | null) ?? []

  const subScores = {
    quality:  review.score_quality   ?? null,
    value:    review.score_value     ?? null,
    ease:     review.score_ease      ?? null,
    dailyUse: review.score_daily_use ?? null,
    specs:    review.score_specs     ?? null,
  }

  const specsData = parseSpecsGradeData(review.specs_grade_data)
  const hasSpecsGrade = review.score_specs != null && !!review.specs_grade_rationale?.trim()

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    name: review.title,
    reviewBody: review.content.replace(/<[^>]+>/g, '').slice(0, 500),
    reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 10, worstRating: 1 },
    author: { '@type': 'Person', name: author },
    itemReviewed: {
      '@type': 'Product',
      name: review.product_name,
      ...(product?.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
      ...(product?.specs?.length
        ? {
            additionalProperty: product.specs
              .filter((s) => s.label?.trim() && s.value?.trim())
              .map((s) => ({ '@type': 'PropertyValue', name: s.label, value: s.value })),
          }
        : {}),
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: review.rating,
        bestRating: 10,
        worstRating: 1,
        ratingCount: 1,
      },
    },
    datePublished: review.published_at,
  }

  // Link follow-up reviews back to the parent for SEO clustering. Each follow-up
  // remains its own canonical page (own slug, own meta), but `isPartOf` tells
  // crawlers these belong to the same review lineage.
  if (isFollowup && parentNode?.slug) {
    jsonLd.isPartOf = {
      '@type': 'Review',
      '@id': `${siteUrl}/reviews/${parentNode.slug}`,
      name: parentNode.title,
    }
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Reviews', item: `${siteUrl}/reviews` },
      ...(category ? [{ '@type': 'ListItem', position: 3, name: category.label, item: `${siteUrl}/category/${category.slug}` }] : []),
      { '@type': 'ListItem', position: category ? 4 : 3, name: review.title, item: `${siteUrl}/reviews/${slug}` },
    ],
  }

  const faqJsonLd = faqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />}
      <ReadingProgressBar />
      <ViewTracker id={review.id} type="review" />
      <TrackView slug={review.slug} title={review.title} type="review" category={review.category ?? null} image_url={review.image_url ?? null} />
      <EngagementTracker contentType="review" contentId={review.id} />
      {product && <StickyMobileCta product={product} />}

      <div className="w-full max-w-6xl mx-auto px-6 py-12 overflow-x-clip">
        <div className="flex flex-col xl:flex-row gap-12 xl:items-start">

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">

        {/* Back to original — only on follow-up pages */}
        {isFollowup && parentNode?.slug && (
          <Link
            href={`/reviews/${parentNode.slug}`}
            className="inline-flex items-center gap-1.5 text-xs text-prose-muted hover:text-accent-text-soft transition-colors mb-4"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back to the original review
          </Link>
        )}

        {/* Lifecycle timeline strip — parent + every follow-up, chronological.
            Renders nothing when there are no follow-ups (timeline length === 1). */}
        <ReviewTimelineStrip nodes={timeline} activeId={review.id} />

        {/* FTC Disclosure */}
        {review.has_affiliate_links && (
          <div
            className="mb-8 text-xs text-prose-faint bg-surface-raised border border-soft rounded-xl px-4 py-3"
            dangerouslySetInnerHTML={{ __html: FTC_DISCLOSURE_HTML }}
          />
        )}

        {/* Article header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {/* Product name — primary context, orange chip */}
            <span className="text-xs font-medium text-eyebrow uppercase tracking-widest bg-accent-tint px-3 py-1 rounded-full">
              {review.product_name}
            </span>
            {/* Category — secondary context, gray chip with icon */}
            {category && (
              <Link
                href={`/category/${category.slug}`}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-surface border border-soft text-prose-muted hover:border-strong hover:text-prose transition-colors"
              >
                <CategoryIcon slug={category.slug} className="w-4 h-4 text-accent-text" /> {category.label}
              </Link>
            )}
            {/* "From the Bench" — closes the lifecycle loop when this review
                was promoted from a wishlist item. Trust signal: shows the
                product went through the testing pipeline, not the listicle
                pipeline. Hover tooltip carries the bench tagline. */}
            {benchItem && (
              <Link
                href={`/bench/${benchItem.slug}`}
                title="Products lined up for testing — vote on what gets reviewed next."
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-accent-tint border border-accent-border/40 text-accent-text hover:border-accent-border/60 hover:bg-accent-tint hover:text-accent transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-accent-text-soft" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                From the Bench
              </Link>
            )}
          </div>

          {/* Verdict change badge — only on follow-ups with an editor-set verdict change */}
          {isFollowup && verdictChange && (
            <div className="mb-4">
              <VerdictChangeBadge
                verdictChange={verdictChange}
                previousRating={review.previous_rating ?? null}
                currentRating={review.rating}
                milestoneLabel={review.milestone_label ?? 'Update'}
              />
            </div>
          )}

          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4 tracking-tight">{review.title}</h1>

          {/* Author + date meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-prose-muted">
            <span>by <Link href={`/author/${author}`} className="text-prose-muted hover:text-accent-text-soft transition-colors">@{author}</Link></span>
            {review.published_at && (
              <span>
                {new Date(review.published_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </span>
            )}
            {review.reading_time_minutes && (
              <span>{review.reading_time_minutes} min read</span>
            )}
          </div>

          {/* Trust receipt — what I paid + how long I tested. Sits right under the
              byline so the reader has trust context before the verdict lands. */}
          <TrustReceipt
            pricePaidCents={review.price_paid_cents}
            testingDuration={review.testing_duration}
            testingSince={review.testing_since}
            testingNote={review.testing_note}
            className="mt-2 pb-6"
          />
        </div>

        {/* Hero image — moved above the verdict so readers see the product first.
            Boss Approved stamp lives in the top-right corner (matches the pattern
            used on every other surface: HeroCarousel, FeaturedReviewCard, etc.) */}
        {review.image_url && (
          <div className="relative mb-8">
            <LightboxImage src={review.image_url} alt={review.product_name}>
              <div className="relative w-full h-64 md:h-80 rounded-xl overflow-hidden bg-surface-raised border border-soft">
                <Image
                  src={review.image_url}
                  alt={review.product_name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 768px"
                  priority
                />
              </div>
            </LightboxImage>
            {(review.rating ?? 0) >= 8 && (
              <div className="absolute top-3 right-3 pointer-events-none">
                <BossApprovedBadge size="sm" variant="card" />
              </div>
            )}
          </div>
        )}

        {/* Verdict Card — score arc (with approved check) + re-buy chip + bars + CTA */}
        <VerdictCard
          variant="inbody"
          productName={review.product_name}
          rating={review.rating ?? 0}
          tldr={tldr}
          product={product}
          wouldRebuy={review.would_rebuy}
          subScores={subScores}
        />

        {/* Key Takeaways — separate block, visually quieter than the verdict */}
        <TakeawaysCard items={keyTakeaways} />

        {/* Follow-up TOC — auto-generated from the required headings the body contains */}
        {isFollowup && followupToc.length >= 2 && (
          <nav
            aria-label="Follow-up sections"
            className="mt-8 mb-4 px-4 py-3 rounded-xl bg-surface border border-soft"
          >
            <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">In this update</p>
            <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {followupToc.map((entry) => (
                <li key={entry.anchor}>
                  <a
                    href={`#${entry.anchor}`}
                    className="inline-flex items-center gap-2 text-sm text-prose-muted hover:text-accent-text-soft transition-colors min-h-[36px]"
                  >
                    <span aria-hidden className="text-prose-faint">›</span>
                    <span className="capitalize">{entry.label}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Review body — primary CTA lives in the VerdictCard above; final CTA below */}
        <div className="min-w-0 w-full">
          <ImageLightbox className="bd-content">
            <div
              className="bd-editorial prose prose-lg prose-invert prose-orange mx-auto max-w-[68ch]
                prose-headings:font-black prose-headings:tracking-tight prose-headings:font-sans prose-headings:leading-[1.15] prose-headings:text-prose
                prose-h2:text-2xl prose-h2:mt-14 prose-h2:mb-5
                prose-h3:mt-10 prose-h3:mb-3
                prose-p:text-prose-muted prose-p:leading-[1.85]
                prose-a:text-accent prose-a:no-underline hover:prose-a:text-accent-hover
                prose-strong:text-prose
                prose-li:text-prose-muted prose-li:leading-[1.85]"
              dangerouslySetInnerHTML={{ __html: renderedBodyHtml }}
            />
          </ImageLightbox>
        </div>

        {/* Specs grade — how the measurable specs rank vs comparable models.
            The comparison happens under the hood; readers see the grade + the
            sources/models it was based on. Independent of the opt-in table below. */}
        {hasSpecsGrade && (
          <section className="mt-12 pt-8 border-t border-soft" aria-label="Specs grade">
            <div className="mb-4">
              <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
              <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-1">Specs Grade</p>
              <h2 className="text-2xl font-black text-prose leading-tight">How the specs stack up</h2>
            </div>
            <div className="rounded-xl border border-soft bg-surface p-5 sm:p-6">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="text-3xl font-black text-prose tabular-nums leading-none">
                  {review.score_specs}<span className="text-base text-prose-faint font-bold">/10</span>
                </span>
                <span className="text-xs text-prose-faint uppercase tracking-widest font-semibold">vs comparable models</span>
              </div>
              <p className="text-sm sm:text-base text-prose-muted leading-relaxed whitespace-pre-line">{review.specs_grade_rationale}</p>

              {(specsData.comparedAgainst.length > 0 || specsData.sources.length > 0) && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-prose-muted hover:text-accent-text-soft font-medium">
                    What this was compared against
                  </summary>
                  <div className="mt-3 space-y-2">
                    {specsData.comparedAgainst.map((c, i) => (
                      <div key={i} className="rounded-lg border border-soft bg-surface-sunken p-3">
                        <p className="font-semibold text-prose">{c.brand ? `${c.brand} · ` : ''}{c.name}</p>
                        {c.keySpecs.length > 0 && (
                          <p className="text-xs text-prose-faint mt-1">{c.keySpecs.map((s) => `${s.label}: ${s.value}`).join(' · ')}</p>
                        )}
                      </div>
                    ))}
                    {specsData.sources.length > 0 && (
                      <div className="pt-1">
                        <p className="text-xs font-semibold text-prose-faint uppercase tracking-widest mb-1">Sources</p>
                        <ul className="space-y-1">
                          {specsData.sources.map((s, i) => (
                            <li key={i} className="truncate">
                              <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-text-soft hover:text-accent">{s.title}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          </section>
        )}

        {/* Spec comparison — this product vs. the author's chosen rivals. */}
        {hasSpecComparison && (
          <div className="mt-12 pt-8 border-t border-soft">
            <SpecComparisonTable
              columns={specColumns}
              eyebrow="Head-to-Head"
              heading="How it compares"
            />
          </div>
        )}

        {/* Final product CTA — last chance to convert, before the newsletter box */}
        {product && (
          <ProductCtaCard product={product} rating={review.rating ?? undefined} variant="final" />
        )}

        {/* FAQs — collapsible, SEO + reader utility */}
        {faqs.length > 0 && (
          <div className="mt-12 pt-8 border-t border-soft">
            <div className="mb-6">
              <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
              <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Common Questions</p>
              <h2 className="text-xl font-black">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group bg-surface border border-soft hover:border-accent rounded-xl overflow-hidden transition-colors"
                >
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 hover:bg-surface-raised transition-colors min-h-[44px]">
                    <p className="font-bold text-sm text-prose leading-snug">{faq.question}</p>
                    <svg
                      className="w-4 h-4 text-accent-text shrink-0 transition-transform duration-200 group-open:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-5 pb-5">
                    <p className="text-sm text-prose-muted leading-relaxed whitespace-pre-line">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA — email signup */}
        <div className="mt-12 pt-8">
          <div className="bg-surface-raised border-t-[3px] border-accent rounded-xl p-6 sm:p-8 text-center">
            <p className="text-[11px] font-black text-accent uppercase tracking-[0.22em] mb-3">Liked this review?</p>
            <h3 className="text-2xl font-black mb-2 text-prose tracking-tight">Get the next one in your inbox</h3>
            <p className="text-sm text-prose-muted mb-5 max-w-md mx-auto">Sunday morning. One email. No PR-speak.</p>
            <div className="max-w-md mx-auto">
              <EmailSignup
                heading={null}
                description={null}
                buttonLabel="Subscribe"
                successMessage="You're in. Welcome to the crew."
                interests={['newsletter', 'review_alerts']}
              />
            </div>
          </div>
        </div>

        {/* Like + Share */}
        <div className="mt-8 pt-6 flex items-center justify-between flex-wrap gap-4">
          <LikeButton contentType="review" contentId={review.id} />
          <ShareButtons title={review.title} />
        </div>

        {/* Featured in collections — cross-link strip */}
        <CollectionsForReview reviewId={review.id} />

        {/* Author bio */}
        <AuthorBio username={author} />

        <AskTheBoss
          context={`the ${review.product_name} review`}
          prompt={`Comparing the ${review.product_name} to something else? Ask the Boss.`}
          className="mt-12"
        />

        {/* On the Bench */}
        <div className="mt-12">
          <p className="text-xs text-prose-faint mb-3">Liked this review? Here&apos;s what I&apos;m testing next — vote to move it up.</p>
          <BenchStrip ctaText="See all on the bench" />
        </div>

        {/* Comments */}
        <div className="mt-12">
          <h2 className="text-lg font-black mb-6">Comments</h2>
          <CommentList contentType="review" contentId={review.id} />
          <div className="mt-6 space-y-4">
            <RatingWidget reviewId={review.id} />
            <CommentForm contentType="review" contentId={review.id} />
          </div>
        </div>

        {/* Merch callout */}
        <Suspense fallback={null}>
          <MerchCallout />
        </Suspense>

        {/* Related reviews — mobile only */}
        {related && related.length > 0 && (
          <div className="mt-12 xl:hidden">
            <div className="mb-4 flex items-stretch gap-3">
              <div className="w-[3px] bg-accent rounded-full shrink-0" />
              <div>
                <p className="text-[13px] uppercase tracking-[0.18em] font-black text-prose">More Reviews</p>
                <h2 className="mt-1 text-lg font-black text-prose">Keep reading</h2>
              </div>
            </div>
            <div className="space-y-2">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/reviews/${r.slug}`}
                  className="flex items-center justify-between p-4 bg-surface border border-soft rounded-xl hover:border-accent hover:-translate-y-0.5 transition-all group"
                >
                  <p className="text-sm font-semibold text-prose group-hover:text-accent transition-colors truncate min-w-0 mr-4">{r.title}</p>
                  <RatingScore rating={r.rating ?? 0} size="sm" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recently viewed — last (lowest priority; you've already seen these).
            Comes after "More Reviews" on mobile so editorial content leads. */}
        <RecentlyViewedStrip
          exclude={{ slug: review.slug, type: 'review' }}
          className="mt-12"
        />

        </main>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside className="hidden xl:flex flex-col gap-4 w-72 shrink-0 sticky top-6 self-start">

          {/* Quick Verdict — same VerdictCard component, sidebar variant */}
          <VerdictCard
            variant="sidebar"
            productName={review.product_name}
            rating={review.rating ?? 0}
            tldr={tldr}
            product={product}
            wouldRebuy={review.would_rebuy}
            subScores={subScores}
          />

          {category && (
            <Link
              href={`/category/${category.slug}`}
              className="flex items-center gap-2 px-1 text-xs text-prose-muted hover:text-accent-text-soft transition-colors"
            >
              <CategoryIcon slug={category.slug} className="w-4 h-4 text-prose-muted" />
              <span>Browse all {category.label} →</span>
            </Link>
          )}

          {/* Related Reviews */}
          {related && related.length > 0 && (
            <div className="bg-surface border border-soft rounded-xl p-5">
              <div className="flex items-stretch gap-3 mb-4">
                <div className="w-[3px] bg-accent rounded-full shrink-0" />
                <p className="text-[12px] uppercase tracking-[0.18em] font-black text-prose self-center">More Reviews</p>
              </div>
              <div className="space-y-4">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/reviews/${r.slug}`}
                    className="block group"
                  >
                    <p className="text-sm font-semibold text-prose group-hover:text-accent transition-colors leading-snug">{r.title}</p>
                    <RatingScore rating={r.rating ?? 0} />
                  </Link>
                ))}
              </div>
            </div>
          )}

        </aside>

        </div>
      </div>
    </>
  )
}

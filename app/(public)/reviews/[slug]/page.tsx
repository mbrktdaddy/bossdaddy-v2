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
import { getProductBySlug } from '@/lib/products'
import BenchStrip from '@/components/BenchStrip'
import CategoryIcon from '@/components/CategoryIcon'

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
    .select('id, title, product_name, category, content, rating, excerpt, image_url, has_affiliate_links, product_slug, published_at, meta_title, meta_description, tldr, key_takeaways, faqs, testing_duration, price_paid_cents, score_quality, score_value, score_ease, score_daily_use, would_rebuy, profiles(username)')
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

  // Related reviews + product fetched in parallel — they don't depend on each other
  const [{ data: related }, product] = await Promise.all([
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
  ])

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
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    name: review.title,
    reviewBody: review.content.replace(/<[^>]+>/g, '').slice(0, 500),
    reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 10, worstRating: 1 },
    author: { '@type': 'Person', name: author },
    itemReviewed: {
      '@type': 'Product',
      name: review.product_name,
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
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />}
      <ReadingProgressBar />
      <ViewTracker id={review.id} type="review" />
      <EngagementTracker contentType="review" contentId={review.id} />
      {product && <StickyMobileCta product={product} />}

      <div className="w-full max-w-6xl mx-auto px-6 py-12 overflow-x-clip">
        <div className="flex flex-col xl:flex-row gap-12 xl:items-start">

        {/* ── Main content ──────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0">

        {/* FTC Disclosure */}
        {review.has_affiliate_links && (
          <div
            className="mb-8 text-xs text-gray-500 bg-gray-900 rounded-2xl px-4 py-3 shadow-md shadow-black/30"
            dangerouslySetInnerHTML={{ __html: FTC_DISCLOSURE_HTML }}
          />
        )}

        {/* Article header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            {/* Product name — primary context, orange chip */}
            <span className="text-xs font-medium text-orange-500 uppercase tracking-widest bg-orange-950/40 px-3 py-1 rounded-full">
              {review.product_name}
            </span>
            {/* Category — secondary context, gray chip with icon */}
            {category && (
              <Link
                href={`/category/${category.slug}`}
                className="flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              >
                <CategoryIcon slug={category.slug} className="w-4 h-4 text-orange-500" /> {category.label}
              </Link>
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-black leading-tight mb-4 tracking-tight">{review.title}</h1>

          {/* Author + date meta */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
            <span>by <Link href={`/author/${author}`} className="text-gray-300 hover:text-orange-400 transition-colors">@{author}</Link></span>
            {review.published_at && (
              <span>
                {new Date(review.published_at).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </span>
            )}
          </div>

          {/* Trust receipt — what I paid + how long I tested. Sits right under the
              byline so the reader has trust context before the verdict lands. */}
          <TrustReceipt
            pricePaidCents={review.price_paid_cents}
            testingDuration={review.testing_duration}
            className="mt-2 pb-6"
          />
        </div>

        {/* Hero image — moved above the verdict so readers see the product first.
            Boss Approved stamp lives in the top-right corner (matches the pattern
            used on every other surface: HeroCarousel, FeaturedReviewCard, etc.) */}
        {review.image_url && (
          <div className="relative mb-8">
            <LightboxImage src={review.image_url} alt={review.product_name}>
              <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden bg-gray-900">
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

        {/* Review body — primary CTA lives in the VerdictCard above; final CTA below */}
        <div className="min-w-0 w-full">
          <ImageLightbox className="bd-content">
            <div
              className="bd-editorial prose prose-lg prose-invert prose-orange max-w-none
                prose-headings:font-black prose-headings:tracking-tight prose-headings:font-sans
                prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
                prose-p:text-gray-300 prose-p:leading-[1.75]
                prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
                prose-strong:text-white
                prose-li:text-gray-300 prose-li:leading-[1.75]"
              dangerouslySetInnerHTML={{ __html: review.content }}
            />
          </ImageLightbox>
        </div>

        {/* Final product CTA — last chance to convert, before the newsletter box */}
        {product && (
          <ProductCtaCard product={product} rating={review.rating ?? undefined} variant="final" />
        )}

        {/* FAQs — collapsible, SEO + reader utility */}
        {faqs.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-800/60">
            <div className="mb-6">
              <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
              <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">Common Questions</p>
              <h2 className="text-xl font-black">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <details
                  key={i}
                  className="group bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] hover:border-orange-900/40 rounded-2xl shadow-md shadow-black/30 overflow-hidden transition-colors"
                >
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 hover:bg-gray-800/60 transition-colors min-h-[44px]">
                    <p className="font-bold text-sm text-white leading-snug">{faq.question}</p>
                    <svg
                      className="w-4 h-4 text-orange-500 shrink-0 transition-transform duration-200 group-open:rotate-180"
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
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">{faq.answer}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA — email signup */}
        <div className="mt-12 pt-8">
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] rounded-2xl p-6 sm:p-8 text-center shadow-xl shadow-black/40">
            <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3 mx-auto" />
            <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-2">Liked this review?</p>
            <h3 className="text-xl font-black mb-4">Get the next one in your inbox</h3>
            <div className="max-w-md mx-auto">
              <EmailSignup
                heading={null}
                description={null}
                buttonLabel="Sign me up"
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

        {/* On the Bench */}
        <div className="mt-12">
          <p className="text-xs text-gray-500 mb-3">Liked this review? Here&apos;s what I&apos;m testing next — vote to move it up.</p>
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
            <div className="mb-4">
              <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
              <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-1">More Reviews</p>
              <h2 className="text-lg font-black">Keep reading</h2>
            </div>
            <div className="space-y-2">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/reviews/${r.slug}`}
                  className="flex items-center justify-between p-4 bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] rounded-2xl shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/40 hover:border-orange-900/40 hover:-translate-y-0.5 transition-all group"
                >
                  <p className="text-sm font-semibold group-hover:text-orange-400 transition-colors truncate min-w-0 mr-4">{r.title}</p>
                  <RatingScore rating={r.rating ?? 0} size="sm" />
                </Link>
              ))}
            </div>
          </div>
        )}

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
              className="flex items-center gap-2 px-1 text-xs text-gray-400 hover:text-orange-400 transition-colors"
            >
              <CategoryIcon slug={category.slug} className="w-4 h-4 text-gray-400" />
              <span>Browse all {category.label} →</span>
            </Link>
          )}

          {/* Related Reviews */}
          {related && related.length > 0 && (
            <div className="bg-gradient-to-br from-gray-900 to-gray-900/60 border border-gray-800/60 ring-1 ring-inset ring-white/[0.02] rounded-2xl p-5 shadow-lg shadow-black/40">
              <span aria-hidden className="block h-px w-6 bg-orange-600/60 mb-3" />
              <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">More Reviews</p>
              <div className="space-y-4">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/reviews/${r.slug}`}
                    className="block group"
                  >
                    <p className="text-sm font-semibold group-hover:text-orange-400 transition-colors leading-snug">{r.title}</p>
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

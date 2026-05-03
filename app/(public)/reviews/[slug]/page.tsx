import { cache } from 'react'
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
import BossApprovedBadge from '@/components/BossApprovedBadge'
import RatingScore from '@/components/RatingScore'
import ViewTracker from '@/components/ViewTracker'
import LikeButton from '@/components/LikeButton'
import CommentForm from '@/components/CommentForm'
import CommentList from '@/components/CommentList'
import RatingWidget from '@/components/RatingWidget'
import ImageLightbox from '@/components/ImageLightbox'
import { LightboxImage } from '@/components/LightboxImage'
import ProductCtaCard from '@/components/ProductCtaCard'
import { EmailSignup } from '@/components/EmailSignup'
import AuthorBio from '@/components/AuthorBio'
import { getProductBySlug } from '@/lib/products'
import BenchStrip from '@/components/BenchStrip'

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
    .select('id, title, product_name, category, content, rating, pros, cons, excerpt, image_url, has_affiliate_links, product_slug, published_at, meta_title, meta_description, tldr, key_takeaways, best_for, not_for, faqs, profiles(username)')
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

  // Related reviews — same category, exclude current
  const { data: related } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, rating, excerpt')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .eq('category', review.category)
    .neq('slug', slug)
    .order('published_at', { ascending: false })
    .limit(3)

  const product = review.product_slug
    ? await getProductBySlug(supabase, review.product_slug)
    : null

  const profileData = Array.isArray(review.profiles)
    ? review.profiles[0]
    : (review.profiles as unknown as { username: string } | null)
  const author = profileData?.username ?? 'Boss Daddy'
  const category = getCategoryBySlug(review.category ?? '')
  const pros = (review.pros as string[]) ?? []
  const cons = (review.cons as string[]) ?? []

  const tldr          = review.tldr as string | null
  const keyTakeaways  = (review.key_takeaways as string[] | null) ?? []
  const bestFor       = (review.best_for as string[] | null) ?? []
  const notFor        = (review.not_for as string[] | null) ?? []
  const faqs          = (review.faqs as { question: string; answer: string }[] | null) ?? []

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    name: review.title,
    reviewBody: review.content.replace(/<[^>]+>/g, '').slice(0, 500),
    reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 10, worstRating: 1 },
    author: { '@type': 'Person', name: author },
    itemReviewed: { '@type': 'Product', name: review.product_name },
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
      <ViewTracker id={review.id} type="review" />
      <EngagementTracker contentType="review" contentId={review.id} />

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
                className="text-xs font-medium px-3 py-1 rounded-full bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
              >
                {category.icon} {category.label}
              </Link>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-6">{review.title}</h1>

          {/* Rating + meta */}
          <div className="flex flex-wrap items-center gap-5 pb-6">
            <RatingScore rating={review.rating ?? 0} size="lg" />
            {(review.rating ?? 0) >= 8 && <BossApprovedBadge size="lg" />}
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <span>by <Link href={`/author/${author}`} className="text-gray-300 hover:text-orange-400 transition-colors">@{author}</Link></span>
              {review.published_at && (
                <span>
                  {new Date(review.published_at).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* TL;DR + Key Takeaways — above the fold for skimmers */}
        {(tldr || keyTakeaways.length > 0) && (
          <div className="mb-8 bg-orange-950/30 border border-orange-900/40 rounded-2xl p-5 shadow-md shadow-black/30">
            {tldr && (
              <p className="text-gray-200 leading-relaxed text-sm sm:text-base mb-4">{tldr}</p>
            )}
            {keyTakeaways.length > 0 && (
              <>
                <p className="text-xs text-orange-400 uppercase tracking-widest font-semibold mb-2">Key Takeaways</p>
                <ul className="space-y-1.5">
                  {keyTakeaways.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-orange-500 mt-0.5 shrink-0">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {/* Hero image */}
        {review.image_url && (
          <LightboxImage src={review.image_url} alt={review.product_name}>
            <div className="relative w-full h-64 md:h-80 rounded-2xl overflow-hidden mb-10 bg-gray-900">
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
        )}

        {/* Pros / Cons */}
        {(pros.length > 0 || cons.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {pros.length > 0 && (
              <div className="bg-green-950/30 rounded-2xl p-5 shadow-md shadow-black/30">
                <p className="text-green-400 font-bold text-sm uppercase tracking-wide mb-3">
                  ✓ The Good
                </p>
                <ul className="space-y-2">
                  {pros.map((pro, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-green-500 mt-0.5 shrink-0">+</span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cons.length > 0 && (
              <div className="bg-red-950/30 rounded-2xl p-5 shadow-md shadow-black/30">
                <p className="text-red-400 font-bold text-sm uppercase tracking-wide mb-3">
                  ✗ The Bad
                </p>
                <ul className="space-y-2">
                  {cons.map((con, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-red-500 mt-0.5 shrink-0">−</span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Best For / Not For — purchase decision block */}
        {(bestFor.length > 0 || notFor.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {bestFor.length > 0 && (
              <div className="bg-gray-900 rounded-2xl p-5 shadow-md shadow-black/30">
                <p className="text-xs text-green-400 uppercase tracking-widest font-semibold mb-3">✓ Best For</p>
                <ul className="space-y-2">
                  {bestFor.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-green-500 mt-0.5 shrink-0">+</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {notFor.length > 0 && (
              <div className="bg-gray-900 rounded-2xl p-5 shadow-md shadow-black/30">
                <p className="text-xs text-red-400 uppercase tracking-widest font-semibold mb-3">✗ Not For</p>
                <ul className="space-y-2">
                  {notFor.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-red-500 mt-0.5 shrink-0">−</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Primary product CTA — after pros/cons, before the article body */}
        {product && (
          <ProductCtaCard product={product} rating={review.rating ?? undefined} variant="prominent" />
        )}

        {/* Review body */}
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

        {/* FAQs — SEO + reader utility */}
        {faqs.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-800/60">
            <h2 className="text-xl font-black mb-6">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-gray-900 rounded-2xl p-5 shadow-md shadow-black/30">
                  <p className="font-bold text-sm text-white mb-2">{faq.question}</p>
                  <p className="text-sm text-gray-300 leading-relaxed">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom CTA — email signup */}
        <div className="mt-12 pt-8">
          <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl p-6 sm:p-8 text-center shadow-xl shadow-black/40">
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

        {/* Related reviews — mobile only */}
        {related && related.length > 0 && (
          <div className="mt-12 xl:hidden">
            <h2 className="text-lg font-black mb-4">More Reviews</h2>
            <div className="space-y-2">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/reviews/${r.slug}`}
                  className="flex items-center justify-between p-4 bg-gray-900 rounded-2xl shadow-md shadow-black/30 hover:shadow-lg hover:shadow-black/40 transition-all group"
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

          {/* Quick Verdict */}
          <div className="bg-gray-900 rounded-2xl p-5 shadow-lg shadow-black/40">
            <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-4">Quick Verdict</p>
            <p className="font-black text-base mb-3">{review.product_name}</p>
            <RatingScore rating={review.rating ?? 0} size="sm" />
            {(review.rating ?? 0) >= 8 && (
              <div className="mt-3">
                <BossApprovedBadge size="sm" />
              </div>
            )}
            {pros.length > 0 && (
              <div className="mt-4 pt-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">The Good</p>
                <ul className="space-y-1.5">
                  {pros.slice(0, 3).map((pro, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                      <span className="text-green-500 shrink-0 mt-0.5">+</span>
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {cons.length > 0 && (
              <div className="mt-4 pt-4">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">The Bad</p>
                <ul className="space-y-1.5">
                  {cons.slice(0, 2).map((con, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                      <span className="text-red-500 shrink-0 mt-0.5">−</span>
                      {con}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {category && (
              <Link
                href={`/category/${category.slug}`}
                className="mt-4 pt-4 flex items-center gap-2 text-xs text-gray-400 hover:text-orange-400 transition-colors"
              >
                <span>{category.icon}</span>
                <span>Browse all {category.label} →</span>
              </Link>
            )}
          </div>

          {/* Related Reviews */}
          {related && related.length > 0 && (
            <div className="bg-gray-900 rounded-2xl p-5 shadow-lg shadow-black/40">
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

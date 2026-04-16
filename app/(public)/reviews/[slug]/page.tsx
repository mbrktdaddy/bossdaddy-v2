import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { FTC_DISCLOSURE_HTML } from '@/lib/affiliate'
import { getCategoryBySlug } from '@/lib/categories'
import ShareButtons from '@/components/ShareButtons'
import ViewTracker from '@/components/ViewTracker'
import LikeButton from '@/components/LikeButton'
import CommentForm from '@/components/CommentForm'
import CommentList from '@/components/CommentList'

export const revalidate = 3600

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('reviews')
    .select('title, product_name, excerpt')
    .eq('slug', slug)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .single()

  if (!data) return { title: 'Review Not Found' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bossdaddylife.com'
  const ogImage = `${siteUrl}/api/og?title=${encodeURIComponent(data.title)}&type=review`

  return {
    title: data.title,
    description: data.excerpt ?? `Dad-tested review of the ${data.product_name}. Honest pros, cons, and verdict.`,
    openGraph: { title: data.title, type: 'article', images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: data.title, images: [ogImage] },
  }
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} className={`w-5 h-5 ${n <= rating ? 'text-yellow-400' : 'text-gray-700'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-2 text-sm font-semibold text-white">{rating}/5</span>
    </div>
  )
}

export default async function ReviewPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: review } = await supabase
    .from('reviews')
    .select('id, title, product_name, category, content, rating, pros, cons, excerpt, image_url, has_affiliate_links, published_at, profiles(username)')
    .eq('slug', slug)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .single()

  if (!review) notFound()

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

  const profileData = Array.isArray(review.profiles)
    ? review.profiles[0]
    : (review.profiles as unknown as { username: string } | null)
  const author = profileData?.username ?? 'Boss Daddy'
  const category = getCategoryBySlug(review.category ?? '')
  const pros = (review.pros as string[]) ?? []
  const cons = (review.cons as string[]) ?? []

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    name: review.title,
    reviewBody: review.content.replace(/<[^>]+>/g, '').slice(0, 500),
    reviewRating: { '@type': 'Rating', ratingValue: review.rating, bestRating: 5 },
    author: { '@type': 'Person', name: author },
    itemReviewed: { '@type': 'Product', name: review.product_name },
    datePublished: review.published_at,
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ViewTracker id={review.id} type="review" />

      <main className="max-w-3xl mx-auto px-6 py-12">

        {/* FTC Disclosure */}
        {review.has_affiliate_links && (
          <div
            className="mb-8 text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
            dangerouslySetInnerHTML={{ __html: FTC_DISCLOSURE_HTML }}
          />
        )}

        {/* Article header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-xs font-medium text-orange-500 uppercase tracking-widest bg-orange-950/40 px-3 py-1 rounded-full">
              {review.product_name}
            </span>
            {category && (
              <Link
                href={`/category/${category.slug}`}
                className={`text-xs font-medium px-3 py-1 rounded-full bg-gray-900 border border-gray-800 ${category.accent} hover:border-gray-600 transition-colors`}
              >
                {category.icon} {category.label}
              </Link>
            )}
          </div>

          <h1 className="text-3xl md:text-4xl font-black leading-tight mb-6">{review.title}</h1>

          {/* Rating + meta */}
          <div className="flex flex-wrap items-center gap-5 pb-6 border-b border-gray-800">
            <StarRating rating={review.rating} />
            <div className="flex items-center gap-4 text-sm text-gray-500">
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

        {/* Hero image */}
        {review.image_url && (
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
        )}

        {/* Pros / Cons */}
        {(pros.length > 0 || cons.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {pros.length > 0 && (
              <div className="bg-green-950/30 border border-green-800/40 rounded-2xl p-5">
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
              <div className="bg-red-950/30 border border-red-800/40 rounded-2xl p-5">
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

        {/* Review body */}
        <div
          className="prose prose-invert prose-orange max-w-none
            prose-headings:font-black prose-headings:tracking-tight
            prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4
            prose-p:text-gray-300 prose-p:leading-relaxed
            prose-a:text-orange-400 prose-a:no-underline hover:prose-a:text-orange-300
            prose-strong:text-white
            prose-li:text-gray-300"
          dangerouslySetInnerHTML={{ __html: review.content }}
        />

        {/* Bottom CTA */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-400 mb-1">Want more dad-tested picks?</p>
            <p className="font-bold text-lg mb-4">Join the Boss Daddy crew.</p>
            <form action="/api/newsletter/subscribe" method="POST" className="flex gap-3 max-w-sm mx-auto">
              <input
                type="email"
                name="email"
                required
                placeholder="your@email.com"
                className="flex-1 px-4 py-2.5 bg-gray-950 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold rounded-xl transition-colors text-sm"
              >
                Join
              </button>
            </form>
          </div>
        </div>

        {/* Like + Share */}
        <div className="mt-8 pt-6 border-t border-gray-800 flex items-center justify-between flex-wrap gap-4">
          <LikeButton contentType="review" contentId={review.id} />
          <ShareButtons title={review.title} />
        </div>

        {/* Comments */}
        <div className="mt-12">
          <h2 className="text-lg font-black mb-6">Comments</h2>
          <CommentList contentType="review" contentId={review.id} />
          <div className="mt-6">
            <CommentForm contentType="review" contentId={review.id} />
          </div>
        </div>

        {/* Related reviews */}
        {related && related.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-black mb-4">More Reviews</h2>
            <div className="space-y-2">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/reviews/${r.slug}`}
                  className="flex items-center justify-between p-4 bg-gray-900 border border-gray-800 hover:border-orange-700/50 rounded-2xl transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-orange-500/80 font-medium uppercase tracking-wide mb-1">{r.product_name}</p>
                    <p className="text-sm font-semibold group-hover:text-orange-400 transition-colors truncate">{r.title}</p>
                  </div>
                  <span className="text-sm text-yellow-400 font-bold ml-4 shrink-0">{'★'.repeat(r.rating)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

      </main>
    </>
  )
}

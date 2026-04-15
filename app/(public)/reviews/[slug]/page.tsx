import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { FTC_DISCLOSURE_HTML } from '@/lib/affiliate'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('reviews')
    .select('title, product_name')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single()

  if (!data) return { title: 'Review Not Found' }

  return {
    title: data.title,
    description: `Dad-tested review of the ${data.product_name}. Honest pros, cons, and verdict.`,
    openGraph: { title: data.title, type: 'article' },
  }
}

export default async function ReviewPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: review } = await supabase
    .from('reviews')
    .select('id, title, product_name, content, rating, has_affiliate_links, published_at, profiles(username)')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single()

  if (!review) notFound()

  const profileData = Array.isArray(review.profiles) ? review.profiles[0] : review.profiles as unknown as { username: string } | null
  const author = profileData?.username ?? 'Boss Daddy'

  // JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    name: review.title,
    reviewBody: review.content.replace(/<[^>]+>/g, '').slice(0, 500),
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
    },
    author: { '@type': 'Person', name: author },
    itemReviewed: { '@type': 'Product', name: review.product_name },
    datePublished: review.published_at,
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="border-b border-gray-800 px-6 py-4">
        <Link href="/" className="text-orange-500 font-bold text-xl">Boss Daddy</Link>
      </header>

      <article className="max-w-2xl mx-auto px-6 py-12">
        {/* Affiliate disclosure */}
        {review.has_affiliate_links && (
          <div
            className="mb-6 text-xs text-gray-500"
            dangerouslySetInnerHTML={{ __html: FTC_DISCLOSURE_HTML }}
          />
        )}

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs text-orange-500 uppercase tracking-wide mb-2">{review.product_name}</p>
          <h1 className="text-3xl font-bold leading-tight mb-4">{review.title}</h1>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="text-yellow-400 text-lg">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
            <span>by @{author}</span>
            {review.published_at && (
              <span>{new Date(review.published_at).toLocaleDateString()}</span>
            )}
          </div>
        </div>

        {/* Body */}
        <div
          className="prose prose-invert prose-orange max-w-none"
          dangerouslySetInnerHTML={{ __html: review.content }}
        />
      </article>
    </main>
  )
}

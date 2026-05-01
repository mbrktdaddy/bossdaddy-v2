import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import RatingScore from '@/components/RatingScore'

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  const admin = createAdminClient()
  const { data } = await admin.from('tags').select('slug')
  return (data ?? []).map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const admin = createAdminClient()
  const { data: tag } = await admin.from('tags').select('slug, label').eq('slug', slug).single()
  if (!tag) return { title: 'Not Found' }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return {
    title: `${tag.label} Reviews — Dad-Tested | Boss Daddy`,
    description: `Dad-tested reviews tagged "${tag.label}" — hands-on, no-BS gear reviews from a real dad.`,
    alternates: { canonical: `${siteUrl}/reviews/tag/${slug}` },
  }
}

export default async function TagPage({ params }: Props) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: tag } = await admin.from('tags').select('slug, label, tag_group').eq('slug', slug).single()
  if (!tag) notFound()

  const { data: tagRows } = await admin
    .from('review_tags')
    .select('review_id')
    .eq('tag_slug', slug)

  const reviewIds = (tagRows ?? []).map((r) => r.review_id)
  const reviews = reviewIds.length > 0
    ? (await admin
        .from('reviews')
        .select('id, slug, title, product_name, rating, excerpt, image_url, category')
        .eq('status', 'approved')
        .eq('is_visible', true)
        .in('id', reviewIds)
        .order('published_at', { ascending: false })
        .limit(24)
      ).data ?? []
    : []

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Reviews', item: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/reviews` },
      { '@type': 'ListItem', position: 2, name: tag.label, item: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/reviews/tag/${slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="w-full max-w-6xl mx-auto px-6 py-12">

        <nav className="flex items-center gap-2 text-xs text-gray-500 mb-8">
          <Link href="/reviews" className="hover:text-orange-400 transition-colors">Reviews</Link>
          <span>/</span>
          <span className="text-gray-300">#{tag.label}</span>
        </nav>

        <div className="mb-10">
          <span className="text-xs text-orange-500 uppercase tracking-widest font-semibold">{tag.tag_group}</span>
          <h1 className="text-3xl md:text-4xl font-black mt-2 mb-3">{tag.label}</h1>
          <p className="text-gray-400">Dad-tested reviews tagged <strong>{tag.label}</strong>.</p>
        </div>

        {reviews.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((r) => (
              <Link key={r.id} href={`/reviews/${r.slug}`}
                className="group bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all">
                {r.image_url ? (
                  <div className="relative w-full h-48">
                    <Image
                      src={r.image_url}
                      alt={r.product_name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-gray-800" />
                )}
                <div className="p-5 space-y-2">
                  <span className="text-xs font-medium text-orange-500 uppercase tracking-widest bg-orange-950/40 px-2.5 py-0.5 rounded-full">
                    {r.product_name}
                  </span>
                  <h2 className="font-black text-base leading-snug group-hover:text-orange-400 transition-colors line-clamp-2">{r.title}</h2>
                  {r.excerpt && <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{r.excerpt}</p>}
                  <RatingScore rating={r.rating ?? 0} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
            <p className="text-gray-400 text-lg font-semibold mb-2">No reviews tagged &ldquo;{tag.label}&rdquo; yet.</p>
            <p className="text-gray-600 text-sm">Check back soon — more reviews are on the way.</p>
          </div>
        )}

      </div>
    </>
  )
}

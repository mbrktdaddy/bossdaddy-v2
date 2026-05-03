import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug, CATEGORIES } from '@/lib/categories'
import RatingScore from '@/components/RatingScore'

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) return { title: 'Not Found' }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return {
    title: `${cat.label} Reviews — Dad-Tested | Boss Daddy`,
    description: cat.description,
    alternates: { canonical: `${siteUrl}/reviews/category/${slug}` },
    openGraph: {
      title: `${cat.label} Reviews | Boss Daddy`,
      description: cat.description,
      url: `${siteUrl}/reviews/category/${slug}`,
    },
  }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const supabase = await createClient()
  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, rating, excerpt, image_url, published_at')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .eq('category', slug)
    .order('published_at', { ascending: false })
    .limit(24)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Reviews', item: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/reviews` },
      { '@type': 'ListItem', position: 2, name: cat.label, item: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/reviews/category/${slug}` },
    ],
  }

  const pillActive = 'bg-orange-600 text-white shadow-md shadow-black/30'
  const pillInactive = 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20'

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="w-full max-w-6xl mx-auto px-6 py-12">

        {/* Category filter — horizontal scroll strip */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 mb-10 pb-1">
          <Link href="/reviews"
            className="shrink-0 flex items-center px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 transition-colors">
            All Reviews
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/reviews/category/${c.slug}`}
              className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
                c.slug === slug ? pillActive : pillInactive
              }`}
            >
              <span>{c.icon}</span>
              <span>{c.label}</span>
            </Link>
          ))}
        </div>

        {/* Category header */}
        <div className="mb-10">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">
            {cat.icon} Reviews
          </p>
          <h1 className="text-3xl md:text-4xl font-black mb-4">{cat.label}</h1>
          <p className="text-gray-400 max-w-2xl leading-relaxed">{cat.description}</p>
        </div>

        {/* Review grid */}
        {reviews && reviews.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((r) => (
              <Link
                key={r.id}
                href={`/reviews/${r.slug}`}
                className="group bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all"
              >
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
                  <div className="w-full h-48 bg-gray-800 flex items-center justify-center text-4xl">
                    {cat.icon}
                  </div>
                )}
                <div className="p-5 space-y-2">
                  <span className="text-xs font-medium text-orange-500 uppercase tracking-widest bg-orange-950/40 px-2.5 py-0.5 rounded-full">
                    {r.product_name}
                  </span>
                  <h2 className="font-black text-base leading-snug group-hover:text-orange-400 transition-colors line-clamp-2">
                    {r.title}
                  </h2>
                  {r.excerpt && (
                    <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">{r.excerpt}</p>
                  )}
                  <RatingScore rating={r.rating ?? 0} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
            <p className="text-5xl mb-4">{cat.icon}</p>
            <p className="text-gray-400 text-lg font-semibold mb-2">No {cat.label} reviews yet.</p>
            <p className="text-gray-600 text-sm">Check back soon — the first one is in progress.</p>
          </div>
        )}

      </div>
    </>
  )
}

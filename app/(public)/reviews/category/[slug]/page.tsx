import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="w-full max-w-6xl mx-auto px-6 py-12">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-500 mb-8">
          <Link href="/reviews" className="hover:text-orange-400 transition-colors">Reviews</Link>
          <span>/</span>
          <span className="text-gray-300">{cat.icon} {cat.label}</span>
        </nav>

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">{cat.icon} Category</p>
          <h1 className="text-3xl md:text-4xl font-black mb-4">{cat.label}</h1>
          <p className="text-gray-400 max-w-2xl leading-relaxed">{cat.description}</p>
        </div>

        {/* Grid */}
        {reviews && reviews.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((r) => (
              <Link
                key={r.id}
                href={`/reviews/${r.slug}`}
                className="group bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all"
              >
                {r.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.image_url} alt={r.product_name} className="w-full h-44 object-cover" />
                ) : (
                  <div className="w-full h-44 bg-gray-800 flex items-center justify-center text-4xl">{cat.icon}</div>
                )}
                <div className="p-4 space-y-2">
                  <p className="text-xs text-orange-400 font-medium">{r.product_name}</p>
                  <h2 className="font-black text-sm leading-snug group-hover:text-orange-400 transition-colors line-clamp-2">{r.title}</h2>
                  {r.excerpt && <p className="text-xs text-gray-500 line-clamp-2">{r.excerpt}</p>}
                  <RatingScore rating={r.rating ?? 0} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg mb-2">{cat.icon} No reviews yet in {cat.label}.</p>
            <p className="text-gray-600 text-sm">Check back soon — the first one is in progress.</p>
          </div>
        )}

        {/* All categories */}
        <div className="mt-16 pt-10 border-t border-gray-800/60">
          <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-4">Browse all categories</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/reviews/category/${c.slug}`}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  c.slug === slug
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {c.icon} {c.label}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}

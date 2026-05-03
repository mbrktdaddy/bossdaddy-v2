import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug, CATEGORIES } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import RatingScore from '@/components/RatingScore'

interface Props { params: Promise<{ slug: string }> }

export const revalidate = 3600

export async function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) return { title: 'Not Found' }
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return {
    title: `${cat.label} — Dad-Tested Reviews & Guides | Boss Daddy`,
    description: cat.description,
    alternates: { canonical: `${siteUrl}/category/${slug}` },
    openGraph: {
      title: `${cat.label} | Boss Daddy`,
      description: cat.description,
      url: `${siteUrl}/category/${slug}`,
    },
  }
}

export default async function CategoryHubPage({ params }: Props) {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const supabase = await createClient()

  const [{ data: topReviews }, { data: latestGuides }] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, rating, excerpt, image_url, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .eq('category', slug)
      .order('rating', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(3),
    supabase
      .from('guides')
      .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .eq('category', slug)
      .order('published_at', { ascending: false })
      .limit(3),
  ])

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: cat.label, item: `${siteUrl}/category/${slug}` },
    ],
  }

  const hasReviews = topReviews && topReviews.length > 0
  const hasGuides = latestGuides && latestGuides.length > 0

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="w-full max-w-6xl mx-auto px-6 py-12">

        {/* ── Category hero ─────────────────────────────────────────────── */}
        <div className="mb-16">
          <p className="text-xs text-orange-500 uppercase tracking-widest font-semibold mb-3">
            {cat.icon} Boss Daddy
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-5 leading-tight">{cat.label}</h1>
          <p className="text-gray-400 max-w-2xl leading-relaxed text-lg">{cat.description}</p>
          <Link
            href={`/reviews/category/${slug}`}
            className="inline-block mt-5 text-sm text-gray-500 hover:text-orange-400 transition-colors font-medium"
          >
            All {cat.label} reviews →
          </Link>
        </div>

        {/* ── Best reviews ──────────────────────────────────────────────── */}
        {hasReviews && (
          <section className="mb-20">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-stretch gap-4">
                <div className="w-[3px] bg-orange-600 rounded-full" />
                <div>
                  <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-1">Top Rated</p>
                  <h2 className="text-2xl font-black text-white leading-tight">Best {cat.label}</h2>
                </div>
              </div>
              <Link
                href={`/reviews/category/${slug}`}
                className="hidden sm:inline-flex text-xs text-gray-500 hover:text-orange-400 transition-colors uppercase tracking-widest font-semibold"
              >
                All Reviews
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {topReviews.map((r, i) => (
                <Link
                  key={r.id}
                  href={`/reviews/${r.slug}`}
                  className="group flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200"
                >
                  {r.image_url ? (
                    <div className="relative w-full h-48 bg-gray-800 shrink-0">
                      <Image
                        src={r.image_url}
                        alt={r.product_name}
                        fill
                        priority={i === 0}
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                      {(r.rating ?? 0) >= 8 && (
                        <div className="absolute top-3 right-3">
                          <BossApprovedBadge size="sm" variant="card" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-48 bg-gray-800 flex items-center justify-center text-4xl shrink-0">
                      {cat.icon}
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-orange-500/80 uppercase tracking-widest bg-orange-950/40 px-2.5 py-1 rounded-full truncate max-w-[60%]">
                        {r.product_name}
                      </span>
                      <RatingScore rating={r.rating ?? 0} size="sm" />
                    </div>
                    <h3 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
                      {r.title}
                    </h3>
                    {r.excerpt && (
                      <p className="text-gray-500 text-sm mt-2 line-clamp-2">{r.excerpt}</p>
                    )}
                    <span className="text-xs text-orange-500 font-medium mt-4">Read review →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Guides ────────────────────────────────────────────────────── */}
        {hasGuides && (
          <section className="mb-20">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-stretch gap-4">
                <div className="w-[3px] bg-orange-600 rounded-full" />
                <div>
                  <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-1">Know-How</p>
                  <h2 className="text-2xl font-black text-white leading-tight">{cat.label} Guides</h2>
                </div>
              </div>
              <Link
                href="/guides"
                className="hidden sm:inline-flex text-xs text-gray-500 hover:text-orange-400 transition-colors uppercase tracking-widest font-semibold"
              >
                All Guides
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {latestGuides.map((g, i) => (
                <Link
                  key={g.id}
                  href={`/guides/${g.slug}`}
                  className="group flex flex-col bg-gray-900 rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 transition-all duration-200"
                >
                  {g.image_url ? (
                    <div className="relative w-full h-44 bg-gray-800 shrink-0 overflow-hidden">
                      <Image
                        src={g.image_url}
                        alt={g.title}
                        fill
                        priority={i === 0}
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                  ) : (
                    <div className="w-full h-44 bg-gradient-to-br from-gray-800/50 to-gray-900/40 flex items-center justify-center shrink-0">
                      <span className="text-4xl opacity-40">{cat.icon}</span>
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-base font-semibold leading-snug group-hover:text-orange-400 transition-colors flex-1">
                      {g.title}
                    </h3>
                    {g.excerpt && (
                      <p className="text-gray-500 text-sm mt-2 line-clamp-2">{g.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-xs text-gray-600">
                        {g.published_at
                          ? new Date(g.published_at).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : ''}
                      </span>
                      <div className="flex items-center gap-2">
                        {g.reading_time_minutes && (
                          <span className="text-xs text-gray-600">{g.reading_time_minutes} min</span>
                        )}
                        <span className="text-xs text-orange-500 font-medium">Read →</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!hasReviews && !hasGuides && (
          <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
            <p className="text-5xl mb-4">{cat.icon}</p>
            <p className="text-gray-400 text-lg font-semibold mb-2">No {cat.label} content yet.</p>
            <p className="text-gray-600 text-sm">Check back soon — it&apos;s on the bench.</p>
            <Link
              href="/bench"
              className="inline-block mt-6 text-sm text-orange-400 hover:text-orange-300 font-medium transition-colors"
            >
              See what&apos;s coming →
            </Link>
          </div>
        )}

        {/* ── Other categories ──────────────────────────────────────────── */}
        <section className="mt-12 pt-12 border-t border-gray-800/60">
          <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-5">More Categories</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1">
            {CATEGORIES.filter((c) => c.slug !== slug).map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 transition-colors"
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </>
  )
}

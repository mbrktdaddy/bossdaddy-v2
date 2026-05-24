import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug, CATEGORIES } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import CategoryIcon from '@/components/CategoryIcon'
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
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: cat.label, item: `${siteUrl}/category/${slug}` },
    ],
  }

  type FAQ = { question: string; answer: string }
  const catFaqs = (cat.faqs ?? []) as unknown as FAQ[]

  const faqLd = catFaqs.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: catFaqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null

  const hasReviews = topReviews && topReviews.length > 0
  const hasGuides = latestGuides && latestGuides.length > 0

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <div className="w-full max-w-6xl mx-auto px-6 py-12">

        {/* ── Category hero ─────────────────────────────────────────────── */}
        <div className="mb-16">
          <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
          <p className="flex items-center gap-1.5 text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">
            <CategoryIcon slug={cat.slug} className="w-4 h-4 text-accent-text" /> Boss Daddy
          </p>
          <h1 className="text-4xl md:text-5xl font-black mb-5 leading-tight">{cat.label}</h1>
          <p className="text-prose-muted max-w-2xl leading-relaxed text-lg">{cat.description}</p>
          {cat.pov && (
            <p className="mt-5 text-prose-muted max-w-2xl leading-relaxed italic border-l-2 border-accent/50 pl-4">
              {cat.pov as string}
            </p>
          )}
          <Link
            href={`/reviews/category/${slug}`}
            className="inline-block mt-5 text-sm text-prose-faint hover:text-accent-text-soft transition-colors font-medium"
          >
            All {cat.label} reviews →
          </Link>
        </div>

        {/* ── Best reviews ──────────────────────────────────────────────── */}
        {hasReviews && (
          <section className="mb-20">
            <div className="flex items-end justify-between mb-8">
              <div>
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Top Rated</p>
                <h2 className="text-2xl font-black text-prose leading-tight">Best {cat.label}</h2>
              </div>
              <Link
                href={`/reviews/category/${slug}`}
                className="hidden sm:inline-flex text-xs text-prose-faint hover:text-accent-text-soft transition-colors uppercase tracking-widest font-semibold"
              >
                All Reviews →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {topReviews.map((r, i) => (
                <Link
                  key={r.id}
                  href={`/reviews/${r.slug}`}
                  className="group flex flex-col bg-gradient-to-br from-surface to-surface/60 border border-soft rounded-xl overflow-hidden shadow-lg shadow-black/30 hover:shadow-xl hover:shadow-black/50 hover:border-accent-border/40 hover:-translate-y-1 transition-all duration-200"
                >
                  {r.image_url ? (
                    <div className="relative w-full h-48 bg-surface-raised shrink-0">
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
                    <div className="w-full h-48 bg-surface-raised flex items-center justify-center shrink-0">
                      <CategoryIcon slug={cat.slug} className="w-8 h-8 text-accent-text" />
                    </div>
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center justify-end mb-3">
                      <RatingScore rating={r.rating ?? 0} size="sm" />
                    </div>
                    <h3 className="text-base font-semibold leading-snug group-hover:text-accent-text-soft transition-colors flex-1">
                      {r.title}
                    </h3>
                    {r.excerpt && (
                      <p className="text-prose-faint text-sm mt-2 line-clamp-2">{r.excerpt}</p>
                    )}
                    <span className="text-xs text-accent-text font-medium mt-4">Read review →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Guides — editorial rows (geometry variation vs Best Reviews grid above) */}
        {hasGuides && (
          <section className="mb-20">
            <div className="flex items-end justify-between mb-8">
              <div>
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Know-How</p>
                <h2 className="text-2xl font-black text-prose leading-tight">{cat.label} Guides</h2>
              </div>
              <Link
                href={`/guides/category/${slug}`}
                className="hidden sm:inline-flex text-xs text-prose-faint hover:text-accent-text-soft transition-colors uppercase tracking-widest font-semibold"
              >
                All Guides →
              </Link>
            </div>

            <ul className="divide-y divide-soft">
              {latestGuides.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/guides/${g.slug}`}
                    className="group flex items-center gap-4 sm:gap-5 py-5 -mx-2 px-2 rounded-xl hover:bg-surface/50 transition-colors"
                  >
                    {/* Thumbnail — fixed square, fills */}
                    <div className="relative shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface border border-soft">
                      {g.image_url ? (
                        <Image
                          src={g.image_url}
                          alt={g.title}
                          fill
                          className="object-cover"
                          sizes="96px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <CategoryIcon slug={cat.slug} className="w-7 h-7 text-accent-text/40" />
                        </div>
                      )}
                    </div>

                    {/* Title + meta */}
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-black text-prose group-hover:text-accent-text-soft transition-colors line-clamp-2 leading-snug">
                        {g.title}
                      </h3>
                      {g.excerpt && (
                        <p className="hidden sm:block text-sm text-prose-faint mt-1.5 line-clamp-1">{g.excerpt}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-prose-faint">
                        {g.published_at && (
                          <span>
                            {new Date(g.published_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </span>
                        )}
                        {g.reading_time_minutes && (
                          <span aria-hidden>·</span>
                        )}
                        {g.reading_time_minutes && (
                          <span>{g.reading_time_minutes} min read</span>
                        )}
                      </div>
                    </div>

                    {/* Chevron */}
                    <span aria-hidden className="text-prose-faint group-hover:text-accent-text-soft transition-colors text-2xl shrink-0">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Empty state ───────────────────────────────────────────────── */}
        {!hasReviews && !hasGuides && (
          <div className="text-center py-24 bg-surface/40 rounded-xl">
            <CategoryIcon slug={cat.slug} className="w-10 h-10 text-accent-text mb-4 mx-auto" />
            <p className="text-prose-muted text-lg font-semibold mb-2">No {cat.label} content yet.</p>
            <p className="text-prose-faint text-sm">Check back soon — it&apos;s on the bench.</p>
            <Link
              href="/bench"
              className="inline-block mt-6 text-sm text-accent-text-soft hover:text-accent font-medium transition-colors"
            >
              See what&apos;s coming →
            </Link>
          </div>
        )}

        {/* ── FAQ accordion ────────────────────────────────────────────── */}
        {catFaqs.length > 0 && (
          <section className="mb-16">
            <div className="mb-6">
              <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
              <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-2">Common Questions</p>
              <h2 className="text-2xl font-black text-prose leading-tight">{cat.label} FAQ</h2>
            </div>
            <div className="space-y-2">
              {catFaqs.map((faq, i) => (
                <details key={i} className="group bg-gradient-to-br from-surface to-surface/60 border border-soft hover:border-accent-border/40 transition-colors rounded-xl overflow-hidden">
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
          </section>
        )}

        {/* ── Other categories ──────────────────────────────────────────── */}
        <section className="mt-12 pt-12 border-t border-soft">
          <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
          <p className="text-xs text-prose-faint uppercase tracking-widest font-semibold mb-5">More Categories</p>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1">
            {CATEGORIES.filter((c) => c.slug !== slug).map((c) => (
              <Link
                key={c.slug}
                href={`/category/${c.slug}`}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-surface text-prose-muted hover:bg-surface-raised hover:text-prose shadow-sm shadow-black/30 transition-colors"
              >
                <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
                <span>{c.label}</span>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </>
  )
}

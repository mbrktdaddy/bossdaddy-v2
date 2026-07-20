import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { createAnonClient } from '@/lib/supabase/anon'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCategoryBySlug, CATEGORIES } from '@/lib/categories'
import { ogImageUrl, OG_SITE } from '@/lib/og'
import CategoryIcon from '@/components/CategoryIcon'
import { PillFilterStrip, PILL_BASE, PILL_ACTIVE, PILL_INACTIVE } from '@/components/ui/PillFilterStrip'
import BenchStrip from '@/components/BenchStrip'

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

  const admin = createAdminClient()
  const { count } = await admin
    .from('guides')
    .select('id', { count: 'exact', head: true })
    .eq('category', slug)
    .eq('status', 'approved')
    .eq('is_visible', true)

  return {
    title: `${cat.label} Guides — Dad-Written | Boss Daddy`,
    description: cat.description,
    alternates: { canonical: `${siteUrl}/guides/category/${slug}` },
    openGraph: {
      ...OG_SITE,
      title: `${cat.label} Guides | Boss Daddy`,
      description: cat.description,
      url: `${siteUrl}/guides/category/${slug}`,
      images: [{ url: ogImageUrl({ title: `${cat.label} Guides`, type: 'guide' }), width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image' },
    robots: (count ?? 0) === 0 ? { index: false, follow: true } : undefined,
  }
}

export default async function GuideCategoryPage({ params }: Props) {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const supabase = createAnonClient()
  const { data: guides } = await supabase
    .from('guides')
    .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .eq('category', slug)
    .order('published_at', { ascending: false })
    .limit(24)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Guides', item: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/guides` },
      { '@type': 'ListItem', position: 2, name: cat.label, item: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/guides/category/${slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="w-full max-w-6xl mx-auto px-6 py-12">

        {/* Category filter — horizontal scroll strip, mobile-first */}
        <PillFilterStrip className="mb-10">
          <Link href="/guides" className={`${PILL_BASE} ${PILL_INACTIVE}`}>
            All Guides
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/guides/category/${c.slug}`}
              className={`${PILL_BASE} ${c.slug === slug ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
              <span>{c.label}</span>
            </Link>
          ))}
        </PillFilterStrip>

        {/* Category header */}
        <div className="mb-10">
          <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
          <p className="flex items-center gap-1.5 text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">
            <CategoryIcon slug={cat.slug} className="w-4 h-4 text-accent-text" /> Guides
          </p>
          <h1 className="text-3xl md:text-4xl font-black mb-4">{cat.label}</h1>
          <p className="text-prose-muted max-w-2xl leading-relaxed">{cat.description}</p>
        </div>

        {/* Guide grid */}
        {guides && guides.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map((g) => (
              <Link
                key={g.id}
                href={`/guides/${g.slug}`}
                className="group bg-surface border border-soft rounded-xl overflow-hidden shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-black/10 hover:border-accent-border/40 hover:-translate-y-1 transition-all"
              >
                {g.image_url ? (
                  <div className="relative w-full h-48">
                    <Image
                      src={g.image_url}
                      alt={g.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                ) : (
                  <div className="w-full h-48 bg-surface-raised flex items-center justify-center">
                    <CategoryIcon slug={cat.slug} className="w-8 h-8 text-accent-text" />
                  </div>
                )}
                <div className="p-5 space-y-2">
                  <h2 className="font-black text-base leading-snug group-hover:text-accent-text-soft transition-colors line-clamp-2">
                    {g.title}
                  </h2>
                  {g.excerpt && (
                    <p className="text-sm text-prose-faint line-clamp-2 leading-relaxed">{g.excerpt}</p>
                  )}
                  {g.reading_time_minutes && (
                    <p className="text-xs text-prose-faint">{g.reading_time_minutes} min read</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-24 bg-surface/40 rounded-xl">
            <CategoryIcon slug={cat.slug} className="w-10 h-10 text-accent-text mb-4 mx-auto" />
            <p className="text-prose-muted text-lg font-semibold mb-2">No {cat.label} guides yet.</p>
            <p className="text-prose-faint text-sm">Check back soon — the first one is in progress.</p>
          </div>
        )}

        {/* On the Bench */}
        <div className="mt-16">
          <BenchStrip ctaText="See all on the bench" />
        </div>

      </div>
    </>
  )
}

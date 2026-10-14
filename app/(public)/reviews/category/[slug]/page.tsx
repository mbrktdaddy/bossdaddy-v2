import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildSocialMetadata } from '@/lib/og'
import Link from 'next/link'
import { createAnonClient } from '@/lib/supabase/anon'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCategoryBySlug, CATEGORIES } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import PageHeader from '@/components/PageHeader'
import ReviewCard from '@/components/ReviewCard'
import { PillFilterStrip, PILL_BASE, PILL_ACTIVE, PILL_INACTIVE } from '@/components/ui/PillFilterStrip'
import { EmptyState } from '@/components/ui/EmptyState'
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
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('category', slug)
    .eq('status', 'approved')
    .eq('is_visible', true)

  const meta = buildSocialMetadata({
    title: `${cat.label} Reviews — Dad-Tested | Boss Daddy`,
    description: cat.description,
    path: `/reviews/category/${slug}`,
    siteUrl,
    ogTitle: `${cat.label} Reviews | Boss Daddy`,
    type: 'site',
    ogType: 'website',
  })
  return { ...meta, robots: (count ?? 0) === 0 ? { index: false, follow: true } : undefined }
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const supabase = createAnonClient()
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

      <PageHeader
        eyebrow={`Reviews / ${cat.label}`}
        title={`${cat.label} Reviews`}
        deck={cat.description}
      />

      <div className="w-full max-w-6xl mx-auto px-6 py-12">

        {/* Category filter — horizontal scroll strip */}
        <PillFilterStrip className="mb-10">
          <Link href="/reviews" className={`${PILL_BASE} ${PILL_INACTIVE}`}>
            All Reviews
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/reviews/category/${c.slug}`}
              className={`${PILL_BASE} ${c.slug === slug ? PILL_ACTIVE : PILL_INACTIVE}`}
            >
              <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
              <span>{c.label}</span>
            </Link>
          ))}
        </PillFilterStrip>

        {/* Review grid */}
        {reviews && reviews.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={{ ...r, category: slug }} eyebrow={null} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<CategoryIcon slug={cat.slug} className="w-10 h-10 text-accent-text" />}
            title={<>No {cat.label} reviews yet.</>}
            body="Check back soon — the first one is in progress."
          />
        )}

        {/* On the Bench */}
        <div className="mt-16">
          <BenchStrip ctaText="See all on the bench" />
        </div>

      </div>
    </>
  )
}

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildSocialMetadata } from '@/lib/og'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import ReviewCard from '@/components/ReviewCard'
import { EmptyState } from '@/components/ui/EmptyState'
import BenchStrip from '@/components/BenchStrip'
import PageHeader from '@/components/PageHeader'

interface Props { params: Promise<{ slug: string }> }

export const revalidate = 3600

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

  // Empty tag pages get noindex — Google flags them as thin content otherwise.
  // Join with reviews and filter by approved+visible to match sitemap.ts logic;
  // counting raw review_tags rows would mark tags-of-only-drafts as indexable.
  const { count } = await admin
    .from('review_tags')
    .select('review_id, reviews!inner(status, is_visible)', { count: 'exact', head: true })
    .eq('tag_slug', slug)
    .eq('reviews.status', 'approved')
    .eq('reviews.is_visible', true)

  const meta = buildSocialMetadata({
    title: `${tag.label} Reviews — Dad-Tested | Boss Daddy`,
    description: `Dad-tested reviews tagged "${tag.label}" — hands-on, no-BS gear reviews from a real dad.`,
    path: `/reviews/tag/${slug}`,
    siteUrl,
    type: 'site',
    ogType: 'website',
  })
  return { ...meta, robots: (count ?? 0) === 0 ? { index: false, follow: true } : undefined }
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
        .select('id, slug, title, product_name, rating, excerpt, image_url, category, published_at')
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
      <PageHeader
        eyebrow={`Reviews / ${tag.tag_group}`}
        title={tag.label}
        deck={`Dad-tested reviews tagged "${tag.label}".`}
      />
      <div className="w-full max-w-6xl mx-auto px-6 py-12">

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-prose-faint mb-8">
          <Link href="/reviews" className="hover:text-accent-text-soft transition-colors">Reviews</Link>
          <span>/</span>
          <span className="text-prose-muted">#{tag.label}</span>
        </nav>

        {reviews.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={`No reviews tagged "${tag.label}" yet.`}
            body="Check back soon — more reviews are on the way."
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

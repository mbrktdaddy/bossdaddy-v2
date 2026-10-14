import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { buildSocialMetadata } from '@/lib/og'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import LibraryGuideCard from '@/components/LibraryGuideCard'
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
  // Join with guides and filter by approved+visible to match sitemap.ts logic;
  // counting raw guide_tags rows would mark tags-of-only-drafts as indexable.
  const { count } = await admin
    .from('guide_tags')
    .select('guide_id, guides!inner(status, is_visible)', { count: 'exact', head: true })
    .eq('tag_slug', slug)
    .eq('guides.status', 'approved')
    .eq('guides.is_visible', true)

  const meta = buildSocialMetadata({
    title: `${tag.label} Guides — Dad-Written | Boss Daddy`,
    description: `Dad-written guides tagged "${tag.label}" — practical, first-person advice from a real dad.`,
    path: `/guides/tag/${slug}`,
    siteUrl,
    type: 'site',
    ogType: 'website',
  })
  return { ...meta, robots: (count ?? 0) === 0 ? { index: false, follow: true } : undefined }
}

export default async function GuideTagPage({ params }: Props) {
  const { slug } = await params
  const admin = createAdminClient()

  const { data: tag } = await admin.from('tags').select('slug, label, tag_group').eq('slug', slug).single()
  if (!tag) notFound()

  const { data: tagRows } = await admin
    .from('guide_tags')
    .select('guide_id')
    .eq('tag_slug', slug)

  const guideIds = (tagRows ?? []).map((r) => r.guide_id)
  const guides = guideIds.length > 0
    ? (await admin
        .from('guides')
        .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
        .eq('status', 'approved')
        .eq('is_visible', true)
        .in('id', guideIds)
        .order('published_at', { ascending: false })
        .limit(24)
      ).data ?? []
    : []

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Guides', item: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/guides` },
      { '@type': 'ListItem', position: 2, name: tag.label, item: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/guides/tag/${slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <PageHeader
        eyebrow={`Guides / ${tag.tag_group}`}
        title={tag.label}
        deck={`Dad-written guides tagged "${tag.label}".`}
      />

      <div className="w-full max-w-6xl mx-auto px-6 py-12">

        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-prose-faint mb-8">
          <Link href="/guides" className="hover:text-accent-text-soft transition-colors">Guides</Link>
          <span>/</span>
          <span className="text-prose-muted">#{tag.label}</span>
        </nav>

        {guides.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {guides.map((g) => (
              <LibraryGuideCard key={g.id} guide={g} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={`No guides tagged "${tag.label}" yet.`}
            body="Check back soon — more guides are on the way."
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

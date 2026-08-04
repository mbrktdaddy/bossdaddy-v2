import Link from 'next/link'
import { Fragment } from 'react'
import { createAnonClient } from '@/lib/supabase/anon'
import { CATEGORIES } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import CredibilityBreak from '@/components/CredibilityBreak'
import FeaturedGuideCard from '@/components/FeaturedGuideCard'
import TopicBlock from '@/components/TopicBlock'
import AskTheBoss from '@/components/AskTheBoss'
import PageHeader from '@/components/PageHeader'
import { ogImageUrl, OG_SITE, TWITTER_HANDLE } from '@/lib/og'
import type { GuideRow } from './actions'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Dad Guides — Skills, How-Tos & Advice',
  description: 'Real guides for real dads — stuff how-tos, backyard projects, grilling tips, and practical advice from a dad who actually tested it. No fluff, just what works.',
  openGraph: {
    ...OG_SITE,
    title: 'Dad Guides — Boss Daddy Life',
    description: 'Real guides for real dads. Stuff how-tos, backyard projects, grilling tips, and practical advice. No fluff.',
    images: [{ url: ogImageUrl({ title: 'Dad Guides & Advice', type: 'guide' }), width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: 'Dad Guides — Boss Daddy Life',
  },
  alternates: { canonical: '/guides' },
}

// Static editorial index (audit H3): no searchParams, cookie-free anon reads.
// Category filtering lives on the path-based /guides/category/[slug] routes
// (already statically prerendered) that the pills below link to.
export default async function GuidesPage() {
  const supabase = createAnonClient()

  const { data } = await supabase
    .from('guides')
    .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes, featured')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(200)

  const guides = (data ?? []) as (GuideRow & { featured?: boolean })[]

  // Admin-flagged featured wins; fall back to first guide with an image.
  const featured =
    guides.find((g) => g.featured && g.image_url) ??
    guides.find((g) => g.image_url) ??
    null

  // 4 per section, not 3: TopicBlock spends the first on its lead card, so 4 is
  // what fills lead + 3 rows — the same module the homepage Library renders.
  // `featured` is excluded so the page's showcase card doesn't headline its own
  // category block a screen later.
  const sections = CATEGORIES
    .map(cat => {
      const inCat = guides.filter(a => a.category === cat.slug && a.id !== featured?.id)
      return { cat, items: inCat.slice(0, 4), total: inCat.length }
    })
    .filter(s => s.items.length > 0)

  return (
    <>
      <PageHeader
        eyebrow="The Field Notes"
        title="Guides"
        deck="Real how-tos for the situations that actually come up — tested by a dad, written without the fluff."
      />
      <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Featured guide — the showcase leads the page (Cover Story pattern) */}
      {featured && (
        <div className="mb-12">
          <FeaturedGuideCard guide={featured} />
        </div>
      )}

      {/* Category filter — horizontal scroll strip. Pills link to the static
          path-based category routes (indexable, prerendered). */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 mb-12 pb-1">
        <Link href="/guides"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold bg-prose text-background border border-prose transition-colors">
          All Guides
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c.slug} href={`/guides/category/${c.slug}`}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-transparent text-prose-muted border border-strong hover:border-copper hover:text-prose transition-colors">
            <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
            <span>{c.label}</span>
          </Link>
        ))}
      </div>

      <AskTheBoss context="Browsing dad how-to guides across every category" className="mb-12" />

      {/* Per-category sections — editorial rows (newspaper directory style)
          replaces 8 identical 3-col card grids with a tighter, scannable
          list per category. Featured card above carries the visual weight. */}
      {sections.length === 0 ? (
        <div className="text-center py-24 bg-surface/40 rounded-xl border border-soft">
          <p className="text-prose-faint text-lg font-semibold">No guides here yet.</p>
          <p className="text-prose-faint text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        sections.map(({ cat, items, total }, i) => (
          <Fragment key={cat.slug}>
          {i === Math.ceil(sections.length / 2) && <CredibilityBreak />}
          <TopicBlock
            index={i}
            label={cat.label}
            viewAllHref={`/guides/category/${cat.slug}`}
            viewAllCount={total > items.length ? total : undefined}
            description={cat.description}
            cta="Read the guide"
            on="background"
            items={items.map((a) => ({
              id: a.id,
              href: `/guides/${a.slug}`,
              eyebrow: cat.label,
              headline: a.title,
              excerpt: a.excerpt,
              meta: a.reading_time_minutes ? `${a.reading_time_minutes} min read` : null,
              imageUrl: a.image_url,
            }))}
          />
          </Fragment>
        ))
      )}
      </div>
    </>
  )
}

// GuideRowItem lived here — an image-left row with a chevron. Replaced by the
// shared ContentRow (inside TopicBlock), which the homepage Library and /reviews
// also use, so the per-category directory is one pattern instead of three.

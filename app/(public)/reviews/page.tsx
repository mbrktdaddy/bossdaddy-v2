import Link from 'next/link'
import { Fragment } from 'react'
import { createAnonClient } from '@/lib/supabase/anon'
import { CATEGORIES } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import CredibilityBreak from '@/components/CredibilityBreak'
import FeaturedReviewCard from '@/components/FeaturedReviewCard'
import TopicBlock from '@/components/TopicBlock'
import BenchStrip from '@/components/BenchStrip'
import AskTheBoss from '@/components/AskTheBoss'
import PageHeader from '@/components/PageHeader'
import { ogImageUrl, OG_SITE } from '@/lib/og'
import type { ReviewRow } from './actions'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Dad-Tested Product Reviews',
  description: 'Every product on Boss Daddy Life is bought with our own money, used in real life, and rated honestly. Browse our reviews across tools, grills, outdoor, tech, and more.',
  openGraph: {
    ...OG_SITE,
    title: 'Dad-Tested Product Reviews — Boss Daddy Life',
    description: 'Every product bought with our own money, used in real life, and rated honestly. No sponsored posts. No fluff.',
    images: [{ url: ogImageUrl({ title: 'Dad-Tested Product Reviews', type: 'review' }), width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dad-Tested Product Reviews — Boss Daddy Life',
  },
  alternates: { canonical: '/reviews' },
}

// Static editorial index (audit H3): no searchParams, cookie-free anon reads.
// Category filtering lives on the path-based /reviews/category/[slug] routes
// (already statically prerendered) that the pills below link to — so this hub
// page prerenders as static HTML for crawlers and CDN.
export default async function ReviewsPage() {
  const supabase = createAnonClient()

  const { data } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at, product_slug, featured')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(200)

  // No badge batch-fetch here. It used to hydrate `badges` on every row for
  // "ReviewCard to render chips" — but ReviewCard belongs to ReviewsGrid, which this
  // static hub doesn't render, and neither FeaturedReviewCard nor the category rows
  // read `badges`. It was an awaited query per render whose result nothing displayed.
  const reviews = (data ?? []) as ReviewRow[]

  // Featured card preference order: admin-flagged > highest-rated (the latter
  // preserves prior behavior when nothing has been flagged yet).
  const featured =
    reviews.find((r) => r.featured && r.image_url) ??
    reviews.filter((r) => r.image_url).sort((a, b) => b.rating - a.rating)[0] ??
    null

  // 4 per section, not 3: TopicBlock spends the first on its lead card, so 4 is
  // what fills lead + 3 rows — the same module /guides and the homepage render.
  // `featured` is excluded so the page's showcase card doesn't headline its own
  // category block a screen later.
  const sections = CATEGORIES
    .map(cat => {
      const inCat = reviews.filter(r => r.category === cat.slug && r.id !== featured?.id)
      return { cat, items: inCat.slice(0, 4), total: inCat.length }
    })
    .filter(s => s.items.length > 0)

  return (
    <>
      <PageHeader
        eyebrow="The Stuff"
        title="All Reviews"
        deck="Every product bought with my own money, used in real life, and scored 1–10 — no sponsors, no fluff."
      />
      <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Featured review — the showcase leads the page (Cover Story pattern) */}
      {featured && (
        <div className="mb-12">
          <FeaturedReviewCard review={featured} />
        </div>
      )}

      {/* Category filter — horizontal scroll strip. Pills link to the static
          path-based category routes (indexable, prerendered). */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 mb-12 pb-1">
        <Link
          href="/reviews"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold bg-accent text-white border border-accent transition-colors"
        >
          All Reviews
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/reviews/category/${c.slug}`}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-transparent text-prose-muted border border-strong hover:border-copper hover:text-prose transition-colors"
          >
            <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
            <span>{c.label}</span>
          </Link>
        ))}
      </div>

      <AskTheBoss context="Browsing dad-tested reviews across every category" className="mb-12" />

      {/* Per-category sections — editorial rows (newspaper directory style)
          replaces the prior 8 identical 3-col card grids with a tighter,
          scannable list per category. Featured card above does the visual
          heavy-lifting; these are quick browse-and-tap entries. */}
      {sections.length === 0 ? (
        <div className="text-center py-24 bg-surface/40 rounded-xl border border-soft">
          <p className="text-prose-faint text-lg font-semibold">No reviews here yet.</p>
          <p className="text-prose-faint text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        sections.map(({ cat, items, total }, i) => (
          <Fragment key={cat.slug}>
          {i === Math.ceil(sections.length / 2) && <CredibilityBreak />}
          <TopicBlock
            index={i}
            label={cat.label}
            viewAllHref={`/reviews/category/${cat.slug}`}
            viewAllCount={total > items.length ? total : undefined}
            description={cat.description}
            cta="Read the review"
            on="background"
            items={items.map((r) => ({
              id: r.id,
              href: `/reviews/${r.slug}`,
              eyebrow: cat.label,
              // Headline is the review's own title here, with the product name as the
              // sub — the inverse of the homepage, where the product IS the news.
              headline: r.title,
              sub: r.product_name,
              excerpt: r.excerpt,
              rating: r.rating,
              imageUrl: r.image_url,
            }))}
          />
          </Fragment>
        ))
      )}

      {/* On the Bench — what's coming next */}
      <div className="mt-16">
        <BenchStrip ctaText="See all on the bench" />
      </div>
      </div>
    </>
  )
}

// A local `ReviewRow` component lived here — an image-left row that also shadowed
// the imported `ReviewRow` *type* from ./actions. Replaced by the shared ContentRow
// (inside TopicBlock), which /guides and the homepage Library use too.

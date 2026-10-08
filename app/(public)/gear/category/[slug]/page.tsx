import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAnonClient } from '@/lib/supabase/anon'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import { getBadgesByProductSlug } from '@/lib/collection-listings'
import CategoryIcon from '@/components/CategoryIcon'
import { type GearReview } from '../../_components/GearCards'
import ReviewCard from '@/components/ReviewCard'
import BenchStrip from '@/components/BenchStrip'
import { RadarLane } from '@/components/radar/RadarLane'
import { getLiveRadar } from '@/lib/products/radar'
import AskTheBoss from '@/components/AskTheBoss'
import PageHeader from '@/components/PageHeader'
import { LABELS } from '@/lib/labels'
import { EmptyState } from '@/components/ui/EmptyState'
import { buttonVariants } from '@/components/ui/Button'
import { buildSocialMetadata, SITE_URL } from '@/lib/og'

export const revalidate = 3600

interface Props { params: Promise<{ slug: string }> }

// Static path-based facet of /gear (audit H3 index-filtering). Prerendered per
// category so filtering doesn't force the gear hub dynamic — and each category
// becomes its own indexable URL.
export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) return { title: 'Not Found' }
  // Routed through buildSocialMetadata: the hand-rolled `twitter` object here set
  // only card+title, which REPLACES the layout's rather than merging — so the card
  // shipped with no @bossdaddylife attribution and no twitter:image/alt. Same
  // defect the /gear detail pages had.
  // No "bought" / "field-tested" page claim: the page now carries On the Radar
  // picks too (brand-guide §1.9). Testing claims belong to the reviews.
  return buildSocialMetadata({
    title: `${cat.label} Gear — Boss Daddy`,
    ogTitle: `${cat.label} Gear`,
    description: `Boss Daddy's ${cat.label.toLowerCase()} gear: everything he rated 8 or higher, plus new gear on his radar. Every review is earned. Every pick is independently chosen.`,
    path: `/gear/category/${slug}`,
    siteUrl: SITE_URL,
    type: 'review',
    ogType: 'website',
  })
}

export default async function GearCategoryPage({ params }: Props) {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const supabase = createAnonClient()
  // The gear pages list reviews rated 8+ (the /gear tiers: 10 / 9 / 8). A
  // category can have published reviews and still none at 8+ (Tools & DIY did,
  // 2026-10-06), so also count every published review in it: the empty state and
  // the footer link send readers to the rest instead of implying there are none.
  const [{ data }, { count: reviewCount }, radar] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at, product_slug, is_top_pick')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .gte('rating', 8)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .eq('category', slug as any)
      .order('rating', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(120),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('is_visible', true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .eq('category', slug as any),
    getLiveRadar(supabase, { limit: 6, category: slug }),
  ])
  const allReviews = reviewCount ?? 0
  const categoryReviewsHref = `/reviews/category/${slug}`

  const raw = (data ?? []) as GearReview[]
  const slugsForBadges = raw.map((r) => r.product_slug).filter((s): s is string => Boolean(s))
  const badgeMap = await getBadgesByProductSlug(supabase, slugsForBadges)
  const picks: GearReview[] = raw.map((r) => ({
    ...r,
    badges: r.product_slug ? badgeMap.get(r.product_slug) ?? [] : [],
  }))

  return (
    <>
      <PageHeader
        back={{ href: '/gear', label: LABELS.gear.short }}
        eyebrow={`Gear / ${cat.label}`}
        title={`${cat.label} Gear`}
        deck={`${cat.label} gear I've rated 8 or higher, plus what's caught my eye. Every review is earned. Every pick is independently chosen.`}
      />
      <div className="max-w-6xl mx-auto px-6 py-12">

      {/* ── Category filter pills ──────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 mb-12 pb-1">
        <Link
          href="/gear"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-transparent text-prose-muted border border-strong hover:border-copper hover:text-prose transition-colors"
        >
          All Gear
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.slug}
            href={`/gear/category/${c.slug}`}
            className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-colors ${
              slug === c.slug
                ? 'bg-accent text-white border border-accent'
                : 'bg-transparent text-prose-muted border border-strong hover:border-copper hover:text-prose'
            }`}
          >
            <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
            <span>{c.label}</span>
          </Link>
        ))}
      </div>

      <AskTheBoss context={`${cat.label} gear picks`} className="mb-12" />

      {!picks.length ? (
        allReviews > 0 ? (
          <EmptyState
            title={`Nothing in ${cat.label} has rated 8 or higher yet.`}
            body="This page only lists gear I've rated 8 or higher. Everything else I've reviewed here is one tap away."
            action={
              <Link href={categoryReviewsHref} className={buttonVariants({ variant: 'secondary' })}>
                {`See all ${allReviews} ${cat.label} ${allReviews === 1 ? 'review' : 'reviews'}`}
              </Link>
            }
          />
        ) : (
          <EmptyState
            title={`No ${cat.label} reviews yet.`}
            body="Check back soon, Boss."
          />
        )
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {picks.map((r) => <ReviewCard key={r.id} review={r} headingLevel="h3" />)}
        </div>
      )}

      {/* ── On the Radar, this category only — below the tested gear (plan) ── */}
      <RadarLane
        items={radar}
        sub={`New ${cat.label.toLowerCase()} gear that caught my eye. Want me to put one to the test? Say the word.`}
        emptyText={`Nothing in ${cat.label} on the radar right now.`}
        className="mt-16"
      />

      {/* ── Bench strip ─────────────────────────────────────────────────────── */}
      <div className="mt-16">
        <p className="text-xs text-prose-faint mb-3">What I&apos;m testing now. Follow one and you&apos;ll get the review the day it&apos;s out.</p>
        <BenchStrip ctaText="See everything on the bench" />
      </div>

      {/* Category-scoped when there's anything to show: the 8+ bar hides lower
          scores here, and this is where readers find them. */}
      <div className="mt-12 text-center">
        <Link
          href={allReviews > 0 ? categoryReviewsHref : '/reviews'}
          className="inline-flex items-center gap-2 text-sm text-prose-faint hover:text-accent-text-soft transition-colors font-medium"
        >
          {allReviews > 0 ? `All ${cat.label} reviews, every score →` : 'Browse the full review archive →'}
        </Link>
      </div>
      </div>
    </>
  )
}

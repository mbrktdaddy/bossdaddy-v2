import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAnonClient } from '@/lib/supabase/anon'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import { getBadgesByProductSlug } from '@/lib/collection-listings'
import CategoryIcon from '@/components/CategoryIcon'
import { GearCard, type GearReview } from '../../_components/GearCards'
import BenchStrip from '@/components/BenchStrip'
import AskTheBoss from '@/components/AskTheBoss'
import PageHeader from '@/components/PageHeader'
import { ogImageUrl, OG_SITE } from '@/lib/og'

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
  return {
    title: { absolute: `${cat.label} Gear — Boss Daddy` },
    description: `Boss Daddy's field-tested ${cat.label.toLowerCase()} gear — every pick bought, used hard, and rated 8+. Earned, not sponsored.`,
    alternates: { canonical: `/gear/category/${slug}` },
    openGraph: {
      ...OG_SITE,
      title: `${cat.label} Gear — Boss Daddy Life`,
      description: `Field-tested ${cat.label.toLowerCase()} gear, rated 8+.`,
      images: [{ url: ogImageUrl({ title: `${cat.label} Gear`, type: 'review' }), width: 1200, height: 630 }],
    },
    twitter: { card: 'summary_large_image', title: `${cat.label} Gear — Boss Daddy Life` },
  }
}

export default async function GearCategoryPage({ params }: Props) {
  const { slug } = await params
  const cat = getCategoryBySlug(slug)
  if (!cat) notFound()

  const supabase = createAnonClient()
  const { data } = await supabase
    .from('reviews')
    .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at, product_slug, is_top_pick')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .gte('rating', 8)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('category', slug as any)
    .order('rating', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(120)

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
        eyebrow={`Gear / ${cat.label}`}
        title={`${cat.label} Gear`}
        deck="Every pick here I bought with my own money, used hard, and rated 8 or higher. Earned, not sponsored."
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
        <div className="text-center py-24 bg-surface/40 rounded-xl border border-soft">
          <p className="text-prose-faint text-lg font-semibold">No {cat.label.toLowerCase()} gear here yet.</p>
          <p className="text-prose-faint text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {picks.map((r) => <GearCard key={r.id} review={r} />)}
        </div>
      )}

      {/* ── Bench strip ─────────────────────────────────────────────────────── */}
      <div className="mt-16">
        <p className="text-xs text-prose-faint mb-3">More gear is on the way. Vote on what gets tested next.</p>
        <BenchStrip ctaText="See everything on the bench" />
      </div>

      <div className="mt-12 text-center">
        <Link
          href="/reviews"
          className="inline-flex items-center gap-2 text-sm text-prose-faint hover:text-accent-text-soft transition-colors font-medium"
        >
          Browse the full review archive →
        </Link>
      </div>
      </div>
    </>
  )
}

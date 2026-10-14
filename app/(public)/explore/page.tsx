import Link from 'next/link'
import { Fragment } from 'react'
import type { Metadata } from 'next'
import { createAnonClient } from '@/lib/supabase/anon'
import { CATEGORIES } from '@/lib/categories'
import { LABELS } from '@/lib/labels'
import { buildSocialMetadata } from '@/lib/og'
import { getVaultCollections, vaultHref, vaultTypeLabel } from '@/lib/vault'
import { mergeByRecency, formatPublished } from '@/lib/latest'
import PageHeader from '@/components/PageHeader'
import EditorialHeader from '@/components/EditorialHeader'
import TopicBlock, { type TopicItem } from '@/components/TopicBlock'
import CredibilityBreak from '@/components/CredibilityBreak'
import { ToolCard } from '@/components/dad-tools/ToolCard'
import { PillFilterStrip, PILL_BASE, PILL_ACTIVE, PILL_INACTIVE } from '@/components/ui/PillFilterStrip'
import { fieldClass } from '@/components/ui/Field'
import { buttonVariants } from '@/components/ui/Button'
import { SearchIcon } from '@/components/icons'

// Static editorial index (audit H3): cookie-free anon reads, hourly revalidate,
// no searchParams. Same contract as /reviews and /guides.
export const revalidate = 3600

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

export const metadata: Metadata = buildSocialMetadata({
  title: `${LABELS.explore.full} — Every Guide and Review, by Topic | Boss Daddy`,
  description: LABELS.explore.tagline,
  path: '/explore',
  siteUrl,
  ogTitle: `${LABELS.explore.full} | Boss Daddy`,
  type: 'site',
  ogType: 'website',
})

// Lead + 3 rows — the same fill as the homepage Library and both listings, so
// the module reads as the same object on every surface that runs it.
const TOPIC_BLOCK_SIZE = 4

// Ceilings, not pagination. The directory needs the newest few PER TOPIC, and a
// tight global cap would let the deepest topic starve the rest. Small columns on
// an hourly ISR page — fine at ten times today's catalogue.
const FETCH_CEILING = 400

// Reading formats only (nav-ia-plan Phase I). Stacks and gift guides are
// SHOPPING formats and live under /gear — they are deliberately not here.
const READING_COLLECTION_TYPES = ['comparison', 'best_of', 'general']

/** One directory entry: a TopicItem plus what the directory needs to rank it. */
type Entry = TopicItem & {
  published_at: string | null
  featured: boolean
  /** The lead card's CTA when THIS entry leads the block — names the format. */
  cta: string
}

/**
 * /explore — the directory (nav-ia-plan Phase I, step I-1; rebuilt 2026-10-14).
 *
 * The first build was three tiers of navigation — a topic grid that repeated the
 * topics row 44px above it, two format boxes, and the homepage's Latest rail
 * doubled — with no content on the first two screens. This is the opposite shape:
 * the whole catalogue on one page, led by content.
 *
 *   1. Search first. The index page IS where a reader with a need and no topic
 *      word lands, and on a phone the masthead hides search behind an icon.
 *   2. Format chips, not boxes. Formats are shapes, not destinations (invariant
 *      10); a chip row says that, a row of heavy boxes says the opposite.
 *   3. One topic block per category, taxonomy order, every category — the same
 *      lead + rows module the homepage Library and both listings run. GUIDES
 *      LEAD: the featured guide if one is flagged, else the newest; the rows are
 *      the newest of every format with the format prefix, so a review is never
 *      more than one row away. A topic with no guide leads on its newest of
 *      anything else; a topic with nothing keeps its header and says so
 *      (uniformity over tidy empty states — the categories are being filled in).
 *   4. One closer in the utility lane: Ask the Boss, or watch the bench.
 *
 * Why guides lead here: reviews already open the homepage, fill the Boss
 * Approved board and own the whole Gear lane; guides get one homepage section.
 * Explore is the READING door (the Explore/Gear split), guides are the longest
 * read and the ones that carry the voice, and Table Duty / Watch Duty exist only
 * as guides — this is the first surface that gives those pillars a stage.
 */
export default async function ExplorePage() {
  const supabase = createAnonClient()

  const [
    { data: reviewsRaw },
    { data: guidesRaw },
    collections,
  ] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(FETCH_CEILING),
    supabase
      .from('guides')
      .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes, featured')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(FETCH_CEILING),
    // Already filtered to visible + published; the loader is shared with the
    // collection listings so the two can't disagree on what counts as live.
    getVaultCollections(),
  ])

  const reviews = reviewsRaw ?? []
  const guides = guidesRaw ?? []
  const readingCollections = collections.filter((c) => READING_COLLECTION_TYPES.includes(c.collection_type))
  const hasComparisons = readingCollections.some((c) => c.collection_type === 'comparison')
  const hasPicks = readingCollections.some((c) => c.collection_type !== 'comparison')

  // A chip shows when its archive has something in it — a presence test, never a
  // count (no vanity metrics while small). "All" is this page.
  const formatChips = [
    { href: '/reviews',     label: LABELS.reviews.plural,    present: reviews.length > 0 },
    { href: '/guides',      label: LABELS.guides.plural,     present: guides.length > 0 },
    { href: '/comparisons', label: LABELS.comparisons.short, present: hasComparisons },
    { href: '/picks',       label: LABELS.picks.short,       present: hasPicks },
  ].filter((f) => f.present)

  // Every category, taxonomy order, one shape — no count thresholds, no
  // per-topic variants.
  const blocks = CATEGORIES.map((cat) => {
    const topicGuides: Entry[] = guides
      .filter((g) => g.category === cat.slug)
      .map((g) => ({
        id: g.id,
        href: `/guides/${g.slug}`,
        kind: LABELS.guides.singular,
        eyebrow: cat.label,
        headline: g.title,
        excerpt: g.excerpt,
        meta: g.reading_time_minutes ? `${g.reading_time_minutes} min read` : formatPublished(g.published_at),
        imageUrl: g.image_url,
        published_at: g.published_at,
        featured: Boolean(g.featured),
        cta: 'Read the guide',
      }))

    const topicReviews: Entry[] = reviews
      .filter((r) => r.category === cat.slug)
      .map((r) => ({
        id: r.id,
        href: `/reviews/${r.slug}`,
        kind: LABELS.reviews.singular,
        eyebrow: cat.label,
        // The review's own title headlines, product name as the sub — the
        // /reviews directory's convention (the row hides the sub when the title
        // already names the product).
        headline: r.title,
        sub: r.product_name,
        excerpt: r.excerpt,
        rating: r.rating,
        meta: formatPublished(r.published_at),
        imageUrl: r.image_url,
        published_at: r.published_at,
        featured: false,
        cta: 'Read the review',
      }))

    const topicCollections: Entry[] = readingCollections
      .filter((c) => c.dominant_category === cat.slug)
      .map((c) => ({
        id: c.id,
        href: vaultHref(c),
        kind: vaultTypeLabel(c.collection_type),
        eyebrow: cat.label,
        headline: c.title,
        excerpt: c.description,
        meta: formatPublished(c.published_at),
        imageUrl: c.hero_image_url ?? null,
        published_at: c.published_at,
        featured: false,
        cta: 'See the verdict',
      }))

    // Guides lead. The featured one if flagged, else the newest; a topic with
    // no guide leads on its newest of anything else.
    const lead =
      topicGuides.find((g) => g.featured) ??
      topicGuides[0] ??
      mergeByRecency([...topicReviews, ...topicCollections], 1)[0] ??
      null

    // The rows are the newest of EVERY format, so the mix is honest: a review is
    // never more than one row away from the guide that leads.
    const rows = lead
      ? mergeByRecency(
          [...topicGuides, ...topicReviews, ...topicCollections].filter((e) => e.id !== lead.id),
          TOPIC_BLOCK_SIZE - 1,
        )
      : []

    return { cat, lead, rows }
  })

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: LABELS.explore.full, item: `${siteUrl}/explore` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <PageHeader eyebrow="Every topic" title={LABELS.explore.full} deck={LABELS.explore.tagline} />

      {/* ── Find it: search first, then the format chips ──────────────────────
          No bottom rule here — the first topic block's own top rule is the
          divider, so the page doesn't carry two hairlines 32px apart. */}
      <section>
        <div className="max-w-6xl mx-auto px-6 pt-8 md:pt-10">
          {/* A plain GET form into /search — no client JS, works before hydration.
              Same field + button pair as the newsletter block (lg + lg share a
              baseline); the button wraps under the field on a phone. */}
          <form action="/search" role="search" className="flex flex-wrap gap-2 max-w-2xl">
            <label htmlFor="explore-search" className="sr-only">{LABELS.search.label}</label>
            <div className="relative flex-1 min-w-0 basis-60">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-prose-faint pointer-events-none" strokeWidth={2} />
              <input
                id="explore-search"
                name="q"
                type="search"
                autoComplete="off"
                placeholder={LABELS.search.placeholder}
                className={fieldClass({ size: 'lg', className: 'pl-11' })}
              />
            </div>
            <button type="submit" className={buttonVariants({ size: 'lg', className: 'basis-full sm:basis-auto' })}>
              {LABELS.search.label}
            </button>
          </form>

          {/* Formats as square chips: "All" is this page, the rest are the
              archives. A scroller on a phone, a wrapped row from md. */}
          <PillFilterStrip className="mt-5 md:mx-0 md:px-0 md:overflow-visible md:flex-wrap">
            <span aria-current="page" className={`${PILL_BASE} ${PILL_ACTIVE}`}>All</span>
            {formatChips.map((f) => (
              <Link key={f.href} href={f.href} className={`${PILL_BASE} ${PILL_INACTIVE}`}>
                {f.label}
              </Link>
            ))}
          </PillFilterStrip>
        </div>
      </section>

      {/* ── The directory — one block per topic, guides leading ──────────── */}
      <section className="border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 pb-12 md:pb-16">
          {blocks.map(({ cat, lead, rows }, i) => (
            <Fragment key={cat.slug}>
              {i === Math.ceil(blocks.length / 2) && <CredibilityBreak />}
              <TopicBlock
                index={i}
                label={cat.label}
                viewAllHref={`/category/${cat.slug}`}
                description={cat.description}
                cta={lead?.cta ?? 'Read it'}
                on="background"
                items={lead ? [lead, ...rows] : []}
                emptyBody={
                  <p className="text-sm text-prose-muted leading-relaxed">
                    Nothing published here yet.{' '}
                    <Link href="/bench" className="font-semibold text-accent-text hover:text-accent transition-colors">
                      See what&apos;s on the bench →
                    </Link>
                  </p>
                }
              />
            </Fragment>
          ))}
        </div>
      </section>

      {/* ── Closer — the index's exits, in the utility lane ─────────────────
          Two black tiles (the Tools primitive), not an orange block: the page
          has no brand moment of its own and the tiles are what a tool looks
          like on this site. */}
      <section className="border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
          <EditorialHeader eyebrow="Not here yet" title="Ask the Boss, or check the bench" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 md:gap-5">
            <ToolCard
              href="/tools/the-boss"
              kicker={`${LABELS.tools.theBoss.spokeRole} · ${LABELS.tools.theBoss.short}`}
              title="Didn’t find it? Tell the Boss what you need."
              blurb={LABELS.tools.theBoss.spokeBlurb}
              cta="Ask the Boss"
            />
            <ToolCard
              href="/bench"
              kicker={LABELS.bench.full}
              title="See what’s being tested next."
              blurb={LABELS.bench.tagline}
              cta="See the bench"
            />
          </div>
        </div>
      </section>
    </>
  )
}

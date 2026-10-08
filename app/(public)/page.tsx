import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { createAnonClient } from '@/lib/supabase/anon'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import EditorialHeader from '@/components/EditorialHeader'
import ScoreBlock from '@/components/ScoreBlock'
import TopicBlock, { type TopicItem } from '@/components/TopicBlock'
import LatestRail from '@/components/home/LatestRail'
import { mergeByRecency, type LatestItem } from '@/lib/latest'
import BossToolsSection from '@/components/home/BossToolsSection'
import TopPicksBoard, { type TopPick } from '@/components/home/TopPicksBoard'
import AboutBand from '@/components/home/AboutBand'
import EmailCaptureSection from '@/components/EmailCaptureSection'
import HomeHero from '@/components/home/HomeHero'
import BenchStrip from '@/components/BenchStrip'
import { MerchStrip } from '@/components/MerchStrip'
import OccasionTiles from '@/components/collections/OccasionTiles'
import { getLiveSeasonalGifts, type SeasonalGift } from '@/lib/collections/seasonal-gifts'
import { isGiftSeason } from '@/lib/gift-occasions'
import CodeRedirect from './_components/CodeRedirect'
import { buildSocialMetadata } from '@/lib/og'
import { BRAND } from '@/lib/brand'
import type { Metadata } from 'next'
import { buttonVariants } from '@/components/ui/Button'

interface Review {
  id: string
  slug: string
  title: string
  product_name: string
  category: string
  rating: number | null
  excerpt: string | null
  image_url: string | null
  published_at: string | null
}

interface Guide {
  id: string
  slug: string
  title: string
  category: string | null
  excerpt: string | null
  image_url: string | null
  published_at: string | null
  reading_time_minutes: number | null
}

export const revalidate = 3600

export function generateMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title: 'Boss Daddy Life — Reviews, Guides & Gear for Dads',
    description: `${BRAND.positioning}. Field-tested reviews, real-dad guides, and free tools for men who Dad Like a Boss. Zero paid placements, zero fluff.`,
    path: '/',
    siteUrl,
    ogTitle: BRAND.tagline,
    ogType: 'website',
    type: 'site',
    cta: 'Explore Boss Daddy',
    heroUrl: `${siteUrl}/images/hero-workshop.webp`,
    imageAlt: `Boss Daddy Life — ${BRAND.positioning}.`,
  })
}

// ── Front page, Phase 5 (light-editorial plan §5, 2026-10-08) ─────────────────
// Brand band → Featured review + Latest → Boss Approved board → Guides (chips,
// lead, ONE spotlight module) → Gift season (in window) → Tools → Newsletter →
// On the bench → About band → Shop strip. Plain section labels throughout.
//
// What this replaced, and why: the Library ran one lead+rows module per
// category (seven of them, ~3,500px) and the page carried a second review
// module ("Just dropped") below the tools. With 28 guides the homepage WAS the
// archive, and the repetition read as a template. Major fronts show 12–20
// strong items with hierarchy and let the category pages carry the rest.

// Bench items are ranked testing → queued (mirrors BenchStrip).
const BENCH_RANK: Record<string, number> = { testing: 0, queued: 1 }

// Safety cap on the guide fetch, not a display budget: the spotlight picks the
// DEEPEST category, which needs every published guide to count, not a window.
const GUIDE_FETCH_CAP = 200

// The spotlight module is Template A: 1 lead + 3 rows.
const TOPIC_BLOCK_SIZE = 4

// Boss Approved board — the product object, 2-up / 4-up. Two rows of four.
const TOP_PICKS = 8

// The Latest rail beside the cover story: text-only recency index. Six keeps
// the list and the cover package close to the same height on desktop.
const LATEST_RAIL_SLOTS = 6

interface TopicBlockData {
  slug: string
  label: string
  /** Total live guides in the category — the spotlight is the deepest one. */
  count: number
  items: TopicItem[]
}

/**
 * One block per category with a live guide, in taxonomy order. The homepage
 * now shows only ONE of these (the deepest category); /guides still renders
 * them all. The lead feature is NOT held back from the blocks — a block is an
 * index of its category and has to be complete.
 */
function buildTopicBlocks(guides: Guide[]): TopicBlockData[] {
  const byTopic = new Map<string, Guide[]>()
  for (const g of guides) {
    if (!g.category) continue
    const held = byTopic.get(g.category)
    if (held) held.push(g)
    else byTopic.set(g.category, [g])
  }

  return CATEGORIES.flatMap((cat) => {
    const topicGuides = byTopic.get(cat.slug)
    if (!topicGuides || topicGuides.length === 0) return []
    return [{
      slug: cat.slug,
      label: cat.label,
      count: topicGuides.length,
      items: topicGuides.slice(0, TOPIC_BLOCK_SIZE).map((g) => ({
        id: g.id,
        href: `/guides/${g.slug}`,
        eyebrow: cat.label,
        headline: g.title,
        excerpt: g.excerpt,
        meta: g.reading_time_minutes ? `${g.reading_time_minutes} min read` : null,
        imageUrl: g.image_url,
      })),
    }]
  })
}

export default async function HomePage() {
  const supabase = createAnonClient()
  // Bench items (statuses testing/queued) aren't publicly readable, so the
  // "On the bench" ticker item comes through the admin client — same as
  // BenchStrip. Read-only, no user data.
  const admin = createAdminClient()

  const [
    { data: featuredHero },
    { data: topRatedOne },
    { data: recentRaw },
    { data: guidesRaw },
    { data: topPicksRaw },
    { data: benchRaw },
    liveGifts,
  ] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved').eq('is_visible', true).eq('featured', true)
      .limit(1).maybeSingle(),
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved').eq('is_visible', true)
      .order('rating', { ascending: false }).order('published_at', { ascending: false })
      .limit(1).maybeSingle(),
    // Newest reviews: the ticker's "Just tested" + the Latest rail's review half.
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(LATEST_RAIL_SLOTS + 1),
    // Every published guide: the chips, the lead, and the deepest-category
    // spotlight all need the full set, not a recency window.
    supabase
      .from('guides')
      .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(GUIDE_FETCH_CAP),
    // Boss Approved board: rated 8+ (the /gear rule), operator top picks first.
    supabase
      .from('reviews')
      .select('id, slug, product_name, category, rating, image_url, price_paid_cents, is_top_pick')
      .eq('status', 'approved').eq('is_visible', true)
      .gte('rating', 8)
      .order('is_top_pick', { ascending: false })
      .order('rating', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(TOP_PICKS),
    admin
      .from('products')
      .select('slug, title:name, status, priority')
      .in('status', ['testing', 'queued'])
      .order('priority', { ascending: false })
      .limit(20),
    // Gift-season band (Phase I-6): only queried inside the window.
    isGiftSeason() ? getLiveSeasonalGifts(supabase) : Promise.resolve([] as SeasonalGift[]),
  ])

  const featured: Review | null = (featuredHero as Review | null) ?? (topRatedOne as Review | null)
  const recent: Review[] = (recentRaw ?? []) as Review[]
  const guideFeed: Guide[] = (guidesRaw ?? []) as Guide[]
  const topPicks: TopPick[] = (topPicksRaw ?? []) as TopPick[]

  // The lead guide is the newest site-wide; it also appears in its own topic
  // block when that block is the spotlight — a block is a complete index.
  const leadGuide = guideFeed[0] ?? null
  const topicBlocks = buildTopicBlocks(guideFeed)
  // ONE spotlight: the deepest category (ties → taxonomy order, stable sort).
  const spotlight = topicBlocks.slice().sort((a, b) => b.count - a.count)[0] ?? null

  // The Latest rail — one merged recency index across both content types.
  const latestItems: LatestItem[] = mergeByRecency<LatestItem>([
    ...guideFeed.map((g) => ({ kind: 'Guide', title: g.title, href: `/guides/${g.slug}`, published_at: g.published_at })),
    ...recent.map((r) => ({ kind: 'Review', title: r.product_name, href: `/reviews/${r.slug}`, published_at: r.published_at })),
  ], LATEST_RAIL_SLOTS)

  // Brand-band ticker — real recent activity, not inventory counts.
  const benchItem =
    (benchRaw ?? [])
      .slice()
      .sort((a, b) => (BENCH_RANK[a.status] ?? 99) - (BENCH_RANK[b.status] ?? 99))[0] ?? null
  const motion: { label: string; title: string; href: string }[] = []
  if (recent[0]) motion.push({ label: 'Just tested', title: recent[0].product_name || recent[0].title, href: `/reviews/${recent[0].slug}` })
  if (benchItem) motion.push({ label: 'On the bench', title: benchItem.title, href: `/bench/${benchItem.slug}` })
  if (leadGuide) motion.push({ label: 'New guide', title: leadGuide.title, href: `/guides/${leadGuide.slug}` })

  // Topic chips — every category holding at least one live guide, in taxonomy
  // order so the row matches the nav and doesn't reshuffle between visits.
  const liveTopics = new Set(
    guideFeed.map((g) => g.category).filter((c): c is string => Boolean(c)),
  )
  const guideTopics = CATEGORIES
    .filter((c) => liveTopics.has(c.slug))
    .map((c) => [c.slug, c.label] as const)

  return (
    <>
      <Suspense fallback={null}>
        <CodeRedirect />
      </Suspense>

      {/* ── BRAND BAND + ticker (placeholder composition — a dedicated pass is owed) */}
      <HomeHero motion={motion} />

      {/* ── FEATURED REVIEW — the lead package: cover story + the Latest list ── */}
      {featured && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
            <EditorialHeader
              eyebrow="Featured review"
              title="This week’s verdict"
              right={{ label: 'All reviews', href: '/reviews' }}
            />
            {/* Both columns stretch to the row so neither leaves a void under the
                other; the copy centres in whatever height the row settles on. */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 lg:gap-10">
              {/* Borderless: the photo and the type carry the package. One mark on
                  the image — the Approved badge — and no "Editor's Pick" pill. */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-8">
                <div className="relative min-h-[280px] lg:min-h-[440px] bg-surface-raised rounded-2xl overflow-hidden">
                  {featured.image_url && (
                    <Image
                      src={featured.image_url}
                      alt={featured.product_name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 420px"
                      className="object-cover"
                      // Desktop LCP. Eager, not `priority`: the brand band has no image
                      // now, so nothing competes, but a preload here would still fire
                      // on phones where this sits below the fold.
                      loading="eager"
                    />
                  )}
                  {(featured.rating ?? 0) >= 8 && (
                    <div className="absolute top-4 right-4">
                      <BossApprovedBadge size="sm" variant="card" />
                    </div>
                  )}
                </div>
                <div className="py-6 lg:py-4 lg:pr-6 flex flex-col justify-center">
                  {(() => {
                    const cat = getCategoryBySlug(featured.category)
                    return (
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-prose-faint">
                        {cat?.label ?? featured.category}
                      </p>
                    )
                  })()}
                  <h3 className="font-black text-prose text-3xl md:text-4xl leading-[1.05] tracking-tight mt-3">
                    {featured.product_name}
                  </h3>
                  {featured.excerpt && (
                    <p className="text-base md:text-lg text-prose-muted leading-[1.75] mt-5">
                      {featured.excerpt.length > 240 ? featured.excerpt.slice(0, 240).trimEnd() + '…' : featured.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-7">
                    <ScoreBlock rating={featured.rating} variant="ring" size="lg" />
                    <div className="min-w-0">
                      <div className="text-sm font-black text-prose leading-tight">Boss Daddy score</div>
                      <div className="text-xs text-prose-faint mt-0.5">Field-tested, bought with my own money</div>
                    </div>
                  </div>
                  <Link
                    href={`/reviews/${featured.slug}`}
                    className={buttonVariants({ size: 'lg', className: 'mt-8 self-start' })}
                  >
                    Read the full verdict
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>

              <LatestRail items={latestItems} />
            </div>
          </div>
        </section>
      )}

      {/* ── BOSS APPROVED — the product board. Self-suppresses at zero. ─────── */}
      {topPicks.length > 0 && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
            <EditorialHeader
              eyebrow="Top picks"
              title="Boss Approved gear"
              right={{ label: 'All gear', href: '/gear' }}
            />
            <TopPicksBoard items={topPicks} />
          </div>
        </section>
      )}

      {/* ── GUIDES — chips (wayfinding), the newest guide, ONE spotlight module.
            /guides carries the full per-category directory. ────────────────── */}
      {leadGuide && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
            <EditorialHeader
              eyebrow="By topic"
              title="Guides"
              right={{ label: 'All guides', href: '/guides' }}
            />

            {guideTopics.length > 1 && (
              <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1 md:mx-0 md:px-0 md:overflow-visible md:flex-wrap">
                <Link
                  href="/guides"
                  className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-prose bg-surface border border-strong rounded-full px-4 py-2.5 hover:border-accent hover:text-accent transition-colors"
                >
                  All topics
                </Link>
                {guideTopics.map(([slug, label]) => (
                  <Link
                    key={slug}
                    href={`/guides/category/${slug}`}
                    className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-prose-muted bg-surface border border-soft rounded-full px-4 py-2.5 hover:border-accent hover:text-accent transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}

            {/* Lead guide — the newest, site-wide. Borderless split. */}
            <Link
              href={`/guides/${leadGuide.slug}`}
              className="group grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8"
            >
              <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[300px] bg-surface-raised rounded-2xl overflow-hidden">
                {leadGuide.image_url && (
                  <Image
                    src={leadGuide.image_url}
                    alt={leadGuide.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 560px"
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                )}
              </div>
              <div className="pt-5 md:pt-0 md:pr-6 flex flex-col justify-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-eyebrow">
                  {(leadGuide.category ? getCategoryBySlug(leadGuide.category)?.label : null) ?? leadGuide.category ?? 'Guide'}
                  {leadGuide.reading_time_minutes ? ` · ${leadGuide.reading_time_minutes} min read` : ''}
                </p>
                <h3 className="font-black text-prose text-2xl md:text-3xl leading-[1.1] tracking-tight mt-3">
                  {leadGuide.title}
                </h3>
                {leadGuide.excerpt && (
                  <p className="text-base text-prose-muted leading-[1.7] mt-4 line-clamp-3">
                    {leadGuide.excerpt}
                  </p>
                )}
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent mt-6">
                  Read the guide
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
                </span>
              </div>
            </Link>

            {/* ONE spotlight module — the deepest category. */}
            {spotlight && (
              <TopicBlock
                index={0}
                label={spotlight.label}
                viewAllHref={`/guides/category/${spotlight.slug}`}
                items={spotlight.items}
                cta="Read the guide"
                on="background"
              />
            )}
          </div>
        </section>
      )}

      {/* ── GIFT SEASON — 1 Oct–26 Dec only, and only with a live guide. ──── */}
      {liveGifts.length > 0 && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
            <EditorialHeader
              eyebrow="Gift season"
              title="Gifts that earn their keep"
              right={{ label: 'All gift guides', href: '/gifts' }}
            />
            <OccasionTiles gifts={liveGifts} />
          </div>
        </section>
      )}

      {/* ── TOOLS — three tiles, the image-free breath mid-page ─────────────── */}
      <BossToolsSection />

      {/* ── NEWSLETTER — inline, mid-page, where major fronts put it ────────── */}
      <EmailCaptureSection />

      {/* ── ON THE BENCH — what's being tested now; self-suppresses at zero ── */}
      <section className="border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 py-8 md:py-12">
          <BenchStrip heading="On the bench" ctaText="See the bench" />
        </div>
      </section>

      {/* ── ABOUT — the closing dark band: portrait + the Creed + two links ── */}
      <AboutBand />

      {/* ── SHOP STRIP — slim "Made by Boss Daddy" band → /shop ─────────────── */}
      <section className="border-b border-soft">
        <div className="max-w-6xl mx-auto px-6">
          <MerchStrip />
        </div>
      </section>
    </>
  )
}

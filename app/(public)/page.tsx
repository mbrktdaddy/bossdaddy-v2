import Link from 'next/link'
import Image from 'next/image'
import { Fragment, Suspense } from 'react'
import { createAnonClient } from '@/lib/supabase/anon'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import EditorialHeader from '@/components/EditorialHeader'
import ScoreBlock from '@/components/ScoreBlock'
import ContentRow from '@/components/ContentRow'
import CredibilityBreak from '@/components/CredibilityBreak'
import LeadCard from '@/components/LeadCard'
import TopicBlock, { type TopicItem } from '@/components/TopicBlock'
import LatestRail, { type LatestItem } from '@/components/home/LatestRail'
import BossToolsSection from '@/components/home/BossToolsSection'
import VaultCard from '@/components/VaultCard'
import EmailCaptureSection from '@/components/EmailCaptureSection'
import HomeHero from '@/components/home/HomeHero'
import { MerchStrip } from '@/components/MerchStrip'
import CodeRedirect from './_components/CodeRedirect'
import { buildSocialMetadata } from '@/lib/og'
import { BRAND } from '@/lib/brand'
import { LABELS } from '@/lib/labels'
import type { Metadata } from 'next'

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

// Shape VaultCard consumes — it owns the per-type routing (/stacks, /comparisons,
// /picks, /gifts/[occasion]), so `occasion` has to come along.
interface VaultCollection {
  slug: string
  title: string
  description: string | null
  hero_image_url: string | null
  collection_type: string
  occasion: string | null
  published_at: string | null
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

// Bench items are ranked testing → queued → considering (mirrors BenchStrip).
const BENCH_RANK: Record<string, number> = { testing: 0, queued: 1, considering: 2 }

// Safety cap on the guide fetch, not a display budget — the Library shows one
// block per category, so it needs every published guide, not a recency window.
// See the query comment.
const GUIDE_FETCH_CAP = 200

// ── Topic blocks — one per category, ungated, all the same shape ──────────────
// Every category with at least one live guide gets a block, and every block is
// the same module: lead card + up to 3 compact rows. Thin topics render with a
// short (or empty) row column, which is an accepted, temporary state — the
// categories are being filled in. Uniform shape is the point: this is the format
// Grilling & Cooking has, applied everywhere, so the section reads as one system.
//
// Deliberately NOT depth-gated and deliberately NOT template-switched by count.
// Both were tried; both trade the uniformity for a tidier empty state, and the
// uniformity is what was asked for.
const TOPIC_BLOCK_SIZE = 4 // 1 lead + 3 rows

// The Vault strip hides below this many live collections — a one-card strip reads
// as broken rather than sparse.
const VAULT_MIN_ITEMS = 2

// Just Dropped runs the same "Template A" shape as the Library: 1 lead + 3 rows.
// Four reviews, two weights. It used to be a flat 2/4-up card grid, which put two
// same-weight card grids back to back (Vault, then this) — the page's flattest
// stretch. Alternating shape between adjacent sections is the cadence mechanism.
const DROPPED_SLOTS = 4

// The Latest rail — a text-only recency index beside the Cover Story. No images, so
// it costs one screen-third and works at any library size.
//
// 6, down from 7: at 7 the rail overshot the cover card badly enough to leave an
// obvious void beside it. The columns now stretch to each other (see the section's
// grid), so this no longer has to match the card's height exactly — but 6 keeps the
// gap between their natural heights small, which stops the stretch from inflating
// the cover photo to an odd aspect on wide screens.
const LATEST_RAIL_SLOTS = 6

/**
 * One block per category with a live guide, in taxonomy order, all in the same
 * shape. No count thresholds, no per-topic variants: a category with one guide
 * gets the same module as a category with nine, just with fewer rows in it.
 *
 * Taxonomy order — not recency, not guide count — because with every category on
 * show the Library has become wayfinding, and the same reasoning that pins the
 * topic chips applies: an index that reshuffles between visits is worse than one
 * that's imperfectly ranked. It also keeps the blocks in step with the nav.
 *
 * The lead feature is NOT held back from the blocks. It used to be — the thinking
 * was that repeating it would headline the same guide twice — but the lead is the
 * newest guide site-wide, so excluding it silently docked one item from whichever
 * category happened to own it. Table Duty had 4 live guides and rendered 3, and the
 * hole moved between categories as new guides published, which reads as a bug.
 *
 * A block is an index of its category and has to be complete; the lead card is a
 * promotional slot above it. Editorial homepages (NYT, Guardian, Wirecutter) repeat
 * the hero in its section list for the same reason. Don't "fix" this by re-adding
 * the exclusion.
 */
function buildTopicBlocks(
  guides: Guide[],
): { slug: string; label: string; items: TopicItem[] }[] {
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
  // Bench items (statuses testing/queued/considering) aren't publicly readable,
  // so the "On the bench" motion item comes through the admin client — same as
  // BenchStrip. It's read-only, no user data.
  const admin = createAdminClient()

  const [
    { data: featuredHero },
    { data: topRatedOne },
    { data: recentRaw },
    { data: guidesRaw },
    { data: benchRaw },
    { data: vaultRaw },
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
    // Just Dropped is Template A now (one lead card + 3 rows), so it needs
    // `excerpt` for the lead and one spare row: the Cover Story review is filtered
    // out of this list, and without the spare a featured-and-recent review would
    // leave the module a row short.
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(DROPPED_SLOTS + 1),
    // Every published guide, not a recency window. The Library is a topic
    // directory now — one block per category — so a slice of the newest N can't
    // feed it: a thin topic's only guide is often nowhere near the front of the
    // feed. This one query replaces both the old feed-window query AND the
    // separate category-only query the topic chips used to need.
    //
    // Unbounded in spirit, capped for safety. At a few dozen guides this is a
    // handful of KB behind an hourly revalidate; if the library ever approaches
    // the cap, the Library section wants paging, not a bigger number.
    supabase
      .from('guides')
      .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(GUIDE_FETCH_CAP),
    admin
      .from('products')
      .select('slug, title:name, status, priority')
      .in('status', ['testing', 'queued', 'considering'])
      .order('priority', { ascending: false })
      .limit(20),
    // The Vault (picks / comparisons / gift guides / stacks) had NO homepage
    // presence — a new stack was reachable only by nav or direct link. Safe on the
    // anon client: collections_public_read is `to anon, authenticated` gated on
    // is_visible, so this matches what a logged-out visitor can actually see.
    // published_at is also required — is_visible alone would leak scheduled items.
    supabase
      .from('collections')
      .select('slug, title, description, hero_image_url, collection_type, occasion, published_at')
      .eq('is_visible', true)
      .not('published_at', 'is', null)
      .order('published_at', { ascending: false })
      .limit(6),
  ])

  const featured: Review | null = (featuredHero as Review | null) ?? (topRatedOne as Review | null)
  const recent: Review[] = (recentRaw ?? []) as Review[]
  const guideFeed: Guide[] = (guidesRaw ?? []) as Guide[]

  // `guideFeed` is every published guide, newest first. The lead feature is the
  // newest of them, and it also still appears in its own topic block below — see
  // buildTopicBlocks. The hero's "New guide" motion item reads the same guide.
  const leadGuide = guideFeed[0] ?? null
  const topicBlocks = buildTopicBlocks(guideFeed)

  // Just Dropped leads with the newest review the Cover Story isn't already
  // showing. `featured` is the admin-flagged review and falls back to top-rated —
  // either can also be the most recent, and without this filter both sections
  // would open on the same product.
  const droppedFeed = recent.filter((r) => r.id !== featured?.id).slice(0, DROPPED_SLOTS)
  const droppedLead = droppedFeed[0] ?? null
  const droppedRows = droppedFeed.slice(1)

  // The Latest rail — one merged recency index across both content types, which is
  // the one question no other section on this page answers (every other section is
  // scoped to a single type). Sorted on the raw ISO strings: they're same-format
  // and UTC out of Postgres, so lexical order IS chronological order, and it
  // avoids constructing Dates during render.
  const latestItems: LatestItem[] = [
    ...guideFeed.map((g) => ({ kind: 'Guide', title: g.title, href: `/guides/${g.slug}`, published_at: g.published_at })),
    ...recent.map((r) => ({ kind: 'Review', title: r.product_name, href: `/reviews/${r.slug}`, published_at: r.published_at })),
  ]
    .filter((i): i is LatestItem & { published_at: string } => Boolean(i.published_at))
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, LATEST_RAIL_SLOTS)

  const vaultItems = (vaultRaw ?? []) as VaultCollection[]

  // ── Hero "In Motion" band — real recent activity, not inventory counts.
  // Shows momentum (latest tested · next on the bench · newest guide) so the
  // band reads as alive rather than advertising small totals. Each links out.
  const benchItem =
    (benchRaw ?? [])
      .slice()
      .sort((a, b) => (BENCH_RANK[a.status] ?? 99) - (BENCH_RANK[b.status] ?? 99))[0] ?? null
  const motion: { label: string; title: string; href: string }[] = []
  if (recent[0]) motion.push({ label: 'Just tested', title: recent[0].product_name || recent[0].title, href: `/reviews/${recent[0].slug}` })
  if (benchItem) motion.push({ label: 'On the bench', title: benchItem.title, href: `/bench/${benchItem.slug}` })
  if (leadGuide) motion.push({ label: 'New guide', title: leadGuide.title, href: `/guides/${leadGuide.slug}` })

  // Topic chips — every category holding at least one live guide, in
  // lib/categories.ts taxonomy order so the row matches the nav and doesn't
  // reshuffle between visits. Now derived from the full guide fetch: it's every
  // published guide, so it answers "which categories are live" directly and the
  // separate category-only query it used to need is gone.
  //
  // Labels come from the taxonomy, never the row data, so a category rename can't
  // leave a stale label stranded here.
  //
  // These stay even though every category also has a block below: the chips are the
  // section's jump index, and Wirecutter likewise repeats subcategory links in every
  // module head. Cheap, and they sit above the fold of the section.
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

      {/* ── HERO — full-bleed photo cover + live-number ticker ─────────────── */}
      <HomeHero motion={motion} />

      {/* ── COVER STORY — the featured review as an editorial split ────────── */}
      {featured && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
            <EditorialHeader
              eyebrow="The cover story"
              title="This week’s verdict"
              right={{ label: 'All reviews', href: '/reviews' }}
            />
            {/* Cover story + The Latest rail. Wirecutter's front page runs three
                simultaneous registers above the fold (text recency index, lead
                editorial, deals); this is the two-register version of that idea —
                one heavy image package plus a text-only index, so the first screen
                offers ~8 entry points instead of 1. */}
            {/* NO `items-start` here. The rail's natural height and the cover card's
                natural height never match — the card's depends on the review's
                excerpt length — so a fixed rail length can't square them. Letting
                both columns stretch to the row means the taller one sets the height
                and the shorter one grows into it, instead of leaving a void under
                whichever came up short. */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 lg:gap-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-soft rounded-3xl overflow-hidden bg-surface">
              <div className="relative min-h-[280px] lg:min-h-[440px] bg-surface-raised">
                {featured.image_url && (
                  <Image
                    src={featured.image_url}
                    alt={featured.product_name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 420px"
                    className="object-cover"
                  />
                )}
                <span className="absolute top-4 left-4 bg-accent text-white text-[10px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-full">
                  Editor’s Pick
                </span>
                {(featured.rating ?? 0) >= 8 && (
                  <div className="absolute top-4 right-4">
                    <BossApprovedBadge size="sm" variant="card" />
                  </div>
                )}
              </div>
              {/* `justify-center` so the copy sits centred when the card stretches to
                  match a taller rail, rather than top-aligned over its own gap. */}
              <div className="p-8 lg:p-11 flex flex-col justify-center">
                {(() => {
                  const cat = getCategoryBySlug(featured.category)
                  return (
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-prose-faint">
                      {cat?.label ?? featured.category}
                    </p>
                  )
                })()}
                <h3 className="font-editorial-display font-semibold text-prose text-3xl md:text-4xl leading-[1.1] tracking-tight mt-3">
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
                  className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-extrabold text-sm px-7 py-3.5 rounded-xl min-h-[48px] mt-8 self-start transition-colors"
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

      {/* ── THE LIBRARY — the guides footprint (the growth engine), organised as a
            topic directory: chips, a lead feature, then one module per category.
            Was a recency feed (lead + 3-up grid + compact rows); the per-category
            structure replaced it so every topic has a shelf of its own.
            Eyebrow says "Every topic", not "Latest guides" — the section is no
            longer recency-ordered below the lead, and the old eyebrow would be
            writing a cheque the layout stopped cashing. ────────────────────── */}
      {leadGuide && (
        <section className="bg-surface border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
            <EditorialHeader
              eyebrow="Every topic"
              title="The Library"
              right={{ label: 'All guides', href: '/guides' }}
            />

            {guideTopics.length > 1 && (
              <div className="flex gap-2 mb-8 overflow-x-auto scrollbar-hide -mx-6 px-6 pb-1 md:mx-0 md:px-0 md:overflow-visible md:flex-wrap">
                <Link
                  href="/guides"
                  className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-prose bg-background border border-strong rounded-full px-4 py-2.5 hover:border-accent hover:text-accent transition-colors"
                >
                  All topics
                </Link>
                {guideTopics.map(([slug, label]) => (
                  <Link
                    key={slug}
                    href={`/guides/category/${slug}`}
                    className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-prose-muted bg-background border border-soft rounded-full px-4 py-2.5 hover:border-accent hover:text-accent transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            )}

            {/* Lead feature guide */}
            <Link
              href={`/guides/${leadGuide.slug}`}
              className="group grid grid-cols-1 md:grid-cols-2 rounded-2xl border border-soft bg-background overflow-hidden hover:border-accent transition-colors"
            >
              <div className="relative aspect-[16/10] md:aspect-auto md:min-h-[300px] bg-surface-raised">
                {leadGuide.image_url && (
                  <Image
                    src={leadGuide.image_url}
                    alt={leadGuide.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 560px"
                    className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                  />
                )}
                <span className="absolute top-4 left-4 bg-accent text-white text-[10px] font-black uppercase tracking-[0.1em] px-3 py-1.5 rounded-full">
                  Featured guide
                </span>
              </div>
              <div className="p-7 lg:p-10 flex flex-col justify-center">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-eyebrow">
                  {(leadGuide.category ? getCategoryBySlug(leadGuide.category)?.label : null) ?? leadGuide.category ?? 'Guide'}
                  {leadGuide.reading_time_minutes ? ` · ${leadGuide.reading_time_minutes} min read` : ''}
                </p>
                <h3 className="font-editorial-display font-semibold text-prose text-2xl md:text-3xl leading-[1.15] tracking-tight mt-3">
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

            {/* One module per category, in taxonomy order, every one the same shape.
                No general "everything else" list any more: with every category on
                show, a mixed remainder list would just be the same guides again.
                CredibilityBreak lands at the halfway mark — it self-centres as
                categories are added, and it's the only thing in ~3,500px of repeated
                module that isn't a bordered card. */}
            {topicBlocks.map((b, i) => (
              <Fragment key={b.slug}>
                {i === Math.ceil(topicBlocks.length / 2) && <CredibilityBreak />}
                <TopicBlock
                  index={i}
                  label={b.label}
                  viewAllHref={`/guides/category/${b.slug}`}
                  items={b.items}
                  cta="Read the guide"
                  on="surface"
                />
              </Fragment>
            ))}
          </div>
        </section>
      )}

      {/* ── BOSS TOOLS — moved up from below the Creed. It's the only image-free
            content section, so it's the page's natural mid-scroll breath: the
            Library above and the Vault below are both image grids, and everything
            from the hero to Just Dropped used to run five image sections deep
            before anything interrupted. Wirecutter's Finder sits in this same
            slot for the same reason. ──────────────────────────────────────── */}
      <BossToolsSection />

      {/* ── THE VAULT — picks / comparisons / gift guides / stacks. Sits between
            the Library and Just Dropped so the page runs widest-to-narrowest:
            guides (deep reading) → collections (curated sets) → single reviews.
            Hidden below VAULT_MIN_ITEMS because a one-card strip reads broken. ── */}
      {vaultItems.length >= VAULT_MIN_ITEMS && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
            <EditorialHeader
              eyebrow="From the vault"
              title={LABELS.vault.full}
              right={{ label: `All ${LABELS.vault.short.toLowerCase()} items`, href: '/vault' }}
            />
            {/* The canonical tagline — LABELS.vault exists precisely so the metaphor
                teaches itself wherever "Vault" lands cold, this strip included. */}
            <p className="text-base text-prose-muted leading-[1.7] max-w-2xl -mt-2 mb-8">
              {LABELS.vault.tagline}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vaultItems.slice(0, 3).map((col) => (
                <VaultCard key={`${col.collection_type}:${col.slug}`} col={col} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── JUST DROPPED — Template A: one lead + 3 rows. Deliberately NOT the
            Vault's shape: the Vault above is a flat 3-up card grid, and two
            equal-weight grids in a row is where the page went monotonous. Shape
            alternates between adjacent sections. ─────────────────────────────── */}
      {droppedLead && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
            <EditorialHeader
              eyebrow="Latest reviews"
              title="Just dropped"
              right={{ label: 'All reviews', href: '/reviews' }}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
              <LeadCard
                href={`/reviews/${droppedLead.slug}`}
                title={droppedLead.product_name}
                imageUrl={droppedLead.image_url}
                eyebrow={getCategoryBySlug(droppedLead.category)?.label ?? droppedLead.category}
                badge="Newest"
                excerpt={droppedLead.excerpt}
                meta={droppedLead.published_at
                  ? new Date(droppedLead.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                  : null}
                cta="Read the review"
                on="background"
              />
              {droppedRows.length > 0 && (
                <div className="flex flex-col lg:-mt-5">
                  {droppedRows.map((r, i) => (
                    <ContentRow
                      key={r.id}
                      href={`/reviews/${r.slug}`}
                      eyebrow={getCategoryBySlug(r.category)?.label ?? r.category}
                      headline={r.product_name}
                      excerpt={r.excerpt}
                      meta={r.published_at
                        ? new Date(r.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
                        : null}
                      imageUrl={r.image_url}
                      imageAlt={r.product_name}
                      isLast={i === droppedRows.length - 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── THE CREED — mission statement, the dark editorial moment ───────── */}
      <section className="bg-chrome border-b border-soft">
        <div className="max-w-3xl mx-auto px-6 py-16 md:py-24 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-eyebrow mb-6">The mission</p>
          <blockquote className="font-editorial-display font-semibold text-prose text-2xl md:text-4xl leading-[1.3] tracking-tight">
            {BRAND.creed}
            {/* `block` (not a <br/> or a wrap-dependent trick) so the payoff line
                lands on its own line at EVERY breakpoint — inline, it wrapped into
                the creed and read as an accident. The preceding {' '} is gone on
                purpose: a block element needs no inline separator, and leaving it
                would trail a stray space at the end of the creed. */}
            <span className="block text-accent mt-3 md:mt-4">That&rsquo;s {BRAND.positioning}.</span>
          </blockquote>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-prose-faint">— The Boss</p>
        </div>
      </section>

      {/* ── MERCH STRIP — slim "Made by Boss Daddy" band (reused from /gear) ── */}
      <section className="border-b border-soft">
        <div className="max-w-6xl mx-auto px-6">
          <MerchStrip exploreHref="/gear#merch" />
        </div>
      </section>

      {/* ── EMAIL CAPTURE — newsletter conversion ─────────────────────────── */}
      <EmailCaptureSection />
    </>
  )
}

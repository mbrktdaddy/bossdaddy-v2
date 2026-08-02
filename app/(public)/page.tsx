import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { createAnonClient } from '@/lib/supabase/anon'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import EditorialHeader from '@/components/EditorialHeader'
import ScoreBlock from '@/components/ScoreBlock'
import DroppedCard from '@/components/DroppedCard'
import GuideRow from '@/components/GuideRow'
import LibraryGuideCard from '@/components/LibraryGuideCard'
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

// The Library fills 9 slots in three descending weights: 1 lead split card, a
// 3-up card grid, then 5 compact rows. The tiering is the cadence — nine guides
// in one flat list reads as a wall, the same nine tiered reads as an edited page.
//
// 9 and not 12: with MAX_PER_TOPIC = 2 the eligible pool is the SUM of
// min(guides, 2) per topic, and two topics currently hold a single guide each —
// so the ceiling is 12 exactly. Filling 12 would consume the whole pool, making
// the section a fixed set that reaches months back and undercuts its own
// "Latest guides" eyebrow. 9 keeps 3 spare and stays genuinely recent.
const LIBRARY_SLOTS = 9
const LIBRARY_GRID_CARDS = 3
const MAX_PER_TOPIC = 2

// The Vault strip hides below this many live collections — a one-card strip reads
// as broken rather than sparse.
const VAULT_MIN_ITEMS = 2

/**
 * Newest-first pick that won't let a single topic own the section.
 *
 * Walks the feed in recency order and skips a guide once its topic already holds
 * `maxPerTopic` slots. If the cap leaves the list short — a small or very lopsided
 * library, where variety genuinely isn't available — the skipped guides go back in,
 * still in recency order. A full section beats an honest but half-empty one, and
 * that fallback can only trigger when there was no variety to find in the first place.
 *
 * Note the first pick is never displaced: counts start at zero, so `[0]` is always
 * the newest guide in the feed. The hero's "New guide" motion item depends on that.
 */
function pickVariedByTopic(feed: Guide[], slots: number, maxPerTopic: number): Guide[] {
  const perTopic = new Map<string, number>()
  const picked: Guide[] = []
  const skipped: Guide[] = []

  for (const g of feed) {
    const topic = g.category ?? '__uncategorized'
    const held = perTopic.get(topic) ?? 0
    if (held >= maxPerTopic) {
      skipped.push(g)
      continue
    }
    perTopic.set(topic, held + 1)
    picked.push(g)
    if (picked.length === slots) return picked
  }

  return picked.concat(skipped).slice(0, slots)
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
    { data: guideTopicRows },
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
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, image_url, published_at')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(4),
    // Guides are the growth engine — pull a deeper set for the enlarged Library
    // section (one lead feature + a reading list).
    //
    // Fetches 3x the slots it fills. pickVariedByTopic() drops guides once a topic
    // has hit its cap, so it needs a bench of replacements to promote — at exactly
    // LIBRARY_SLOTS there is nothing to promote and the cap can only shorten the
    // list. health-wellness alone is ~44% of the library, so without the surplus
    // the section reliably came out as three topics across six slots.
    supabase
      .from('guides')
      .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(LIBRARY_SLOTS * 3),
    admin
      .from('products')
      .select('slug, title:name, status, priority')
      .in('status', ['testing', 'queued', 'considering'])
      .order('priority', { ascending: false })
      .limit(20),
    // Topic chips need EVERY category with a live guide, which is a different
    // question from "what are the newest guides" — so it gets its own query
    // rather than being derived from the feed above. Deriving it from the feed is
    // what hid 4 of 7 topics: grilling-cooking had 5 published guides and no chip,
    // because none of them were in the 6 most recent. One column, so it stays cheap.
    supabase
      .from('guides')
      .select('category')
      .eq('status', 'approved').eq('is_visible', true),
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

  // Max 2 guides per topic across the Library's 6 slots. Straight recency filled it
  // with 3 health-wellness pieces out of 6 — that one topic is ~44% of the library —
  // so the section read as a single subject rather than a library.
  const libraryGuides = pickVariedByTopic(guideFeed, LIBRARY_SLOTS, MAX_PER_TOPIC)
  const leadGuide = libraryGuides[0] ?? null
  const gridGuides = libraryGuides.slice(1, 1 + LIBRARY_GRID_CARDS)
  const restGuides = libraryGuides.slice(1 + LIBRARY_GRID_CARDS)

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

  // Topic chips — EVERY category holding at least one live guide, in lib/categories.ts
  // taxonomy order. Taxonomy order (not guide count, not recency) so the row matches
  // the nav and doesn't reshuffle between visits; these chips are wayfinding, and
  // wayfinding that moves is worse than wayfinding that's imperfectly ranked.
  //
  // Labels come from the taxonomy rather than the row data, so a category rename can't
  // leave a stale label stranded here. A slug with no taxonomy entry is dropped rather
  // than rendered raw — mig 128 put categories behind an FK, so that shouldn't happen,
  // and a chip reading "home-lifestyle" would be worse than one chip fewer.
  const liveTopics = new Set(
    ((guideTopicRows ?? []) as { category: string | null }[])
      .map((r) => r.category)
      .filter((c): c is string => Boolean(c)),
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-soft rounded-3xl overflow-hidden bg-surface">
              <div className="relative min-h-[280px] lg:min-h-[440px] bg-surface-raised">
                {featured.image_url && (
                  <Image
                    src={featured.image_url}
                    alt={featured.product_name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 560px"
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
              <div className="p-8 lg:p-11 flex flex-col">
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
          </div>
        </section>
      )}

      {/* ── THE LIBRARY — enlarged guides footprint (the growth engine): topic
            chips + a lead feature + a reading list. Promoted into the slot the
            old wayfinding pillars used (nav already handles wayfinding). ────── */}
      {leadGuide && (
        <section className="bg-surface border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
            <EditorialHeader
              eyebrow="Latest guides"
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

            {/* Middle weight — 3-up card grid. Steps the section down from the
                lead split card before it reaches the compact rows. */}
            {gridGuides.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                {gridGuides.map((g) => (
                  <LibraryGuideCard key={g.id} guide={g} />
                ))}
              </div>
            )}

            {/* Lightest weight — the reading list */}
            {restGuides.length > 0 && (
              <div className="mt-4">
                {restGuides.map((g, i) => (
                  <GuideRow key={g.id} guide={g} isLast={i === restGuides.length - 1} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

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

      {/* ── JUST DROPPED — recent reviews grid ────────────────────────────── */}
      {recent.length > 0 && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
            <EditorialHeader
              eyebrow="Latest reviews"
              title="Just dropped"
              right={{ label: 'All reviews', href: '/reviews' }}
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {recent.map((r) => <DroppedCard key={r.id} review={r} />)}
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

      {/* ── BOSS TOOLS — free utilities ───────────────────────────────────── */}
      <section className="border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
          <EditorialHeader
            eyebrow="Free · No login wall"
            title="Boss Tools"
            right={{ label: 'See all tools', href: '/tools' }}
          />
          <Link
            href="/tools/the-boss"
            className="block bg-surface border border-soft hover:border-accent rounded-2xl p-6 sm:p-8 mb-4 transition-colors group"
          >
            <p className="text-xs text-eyebrow uppercase tracking-widest font-bold">New · Ask the Boss</p>
            <h3 className="text-xl sm:text-2xl font-black mt-2 text-prose group-hover:text-accent transition-colors leading-tight">
              Tell the Boss what you need — get a tested pick, not a guess.
            </h3>
            <p className="text-prose-muted mt-3 text-sm sm:text-base max-w-prose">
              Recommendations grounded in real, hands-on reviews — plus straight answers on how-to,
              planning, and dad life. Picks come with scores and buy links; the takes come in plain English.
            </p>
            <p className="text-sm text-accent font-semibold mt-5 inline-flex items-center gap-1 group-hover:underline">
              Ask the Boss <span aria-hidden>→</span>
            </p>
          </Link>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Link
              href="/tools/weekends-until"
              className="block bg-surface border border-soft hover:border-accent rounded-2xl p-6 sm:p-8 transition-colors group"
            >
              <p className="text-xs text-eyebrow uppercase tracking-widest font-bold">Time · Weekends Until</p>
              <h3 className="text-xl sm:text-2xl font-black mt-2 text-prose group-hover:text-accent transition-colors leading-tight">
                How many weekends do you have left with your kid?
              </h3>
              <p className="text-prose-muted mt-3 text-sm sm:text-base max-w-prose">
                Pick a birthdate. Pick a milestone. Get the number. Then make them count.
              </p>
              <p className="text-sm text-accent font-semibold mt-5 inline-flex items-center gap-1 group-hover:underline">
                Try it <span aria-hidden>→</span>
              </p>
            </Link>
            <Link
              href="/tools/savings"
              className="block bg-surface border border-soft hover:border-accent rounded-2xl p-6 sm:p-8 transition-colors group"
            >
              <p className="text-xs text-eyebrow uppercase tracking-widest font-bold">Money · Savings</p>
              <h3 className="text-xl sm:text-2xl font-black mt-2 text-prose group-hover:text-accent transition-colors leading-tight">
                Small commitments, daily. Tap “yes,” watch the dollars stack.
              </h3>
              <p className="text-prose-muted mt-3 text-sm sm:text-base max-w-prose">
                $2 a day for a camping trip. $50 a month into a 529 or Trump Account. Tiny habits, real
                progress. Invite your spouse so the streak counts as a team.
              </p>
              <p className="text-sm text-accent font-semibold mt-5 inline-flex items-center gap-1 group-hover:underline">
                Try it <span aria-hidden>→</span>
              </p>
            </Link>
          </div>
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

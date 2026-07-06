import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import EditorialHeader from '@/components/EditorialHeader'
import ScoreBlock from '@/components/ScoreBlock'
import DroppedCard from '@/components/DroppedCard'
import GuideRow from '@/components/GuideRow'
import EmailCaptureSection from '@/components/EmailCaptureSection'
import HomeHero from '@/components/home/HomeHero'
import { MerchStrip } from '@/components/MerchStrip'
import CodeRedirect from './_components/CodeRedirect'
import { buildSocialMetadata } from '@/lib/og'
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

export const revalidate = 3600

export function generateMetadata(): Metadata {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  return buildSocialMetadata({
    title: 'Boss Daddy Life — Reviews, Guides & Gear for Dads',
    description: 'Field-tested product reviews, real-dad guides, and free tools for men who show up every day. Zero paid placements, zero fluff.',
    path: '/',
    siteUrl,
    ogTitle: 'Dad like a BOSS.',
    ogType: 'website',
    type: 'site',
    cta: 'Explore Boss Daddy',
    heroUrl: `${siteUrl}/images/hero-workshop.webp`,
    imageAlt: 'Boss Daddy Life — Dad like a BOSS',
  })
}

// Tools aren't DB-backed — update when a tool is added/removed.
const TOOLS_COUNT = 4

export default async function HomePage() {
  const supabase = await createClient()

  const [
    { data: featuredHero },
    { data: topRatedOne },
    { data: recentRaw },
    { data: guidesRaw },
    { count: reviewCountRaw },
    { count: guidesCountRaw },
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
    supabase
      .from('guides')
      .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(6),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved').eq('is_visible', true),
    supabase
      .from('guides')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved').eq('is_visible', true),
  ])

  const featured: Review | null = (featuredHero as Review | null) ?? (topRatedOne as Review | null)
  const recent: Review[] = (recentRaw ?? []) as Review[]
  const guides: Guide[] = (guidesRaw ?? []) as Guide[]
  const reviewCount = reviewCountRaw ?? 0
  const guidesCount = guidesCountRaw ?? 0

  const leadGuide = guides[0] ?? null
  const restGuides = guides.slice(1)

  // Distinct guide topics (for the browse chips) — derived from what's live,
  // deduped, linking to the guide-category listings.
  const guideTopics = Array.from(
    new Map(
      guides
        .map((g) => g.category)
        .filter((c): c is string => Boolean(c))
        .map((slug) => [slug, getCategoryBySlug(slug)?.label ?? slug] as const)
    ).entries()
  ).slice(0, 5)

  return (
    <>
      <Suspense fallback={null}>
        <CodeRedirect />
      </Suspense>

      {/* ── HERO — full-bleed photo cover + live-number ticker ─────────────── */}
      <HomeHero reviewCount={reviewCount} guidesCount={guidesCount} toolsCount={TOOLS_COUNT} />

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
              eyebrow="From the library"
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

            {/* Reading list — the rest */}
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

      {/* ── JUST DROPPED — recent reviews grid ────────────────────────────── */}
      {recent.length > 0 && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
            <EditorialHeader
              eyebrow="Fresh off the bench"
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
            Boss Daddy isn’t just another review site. It’s a standard — and a resource — for men who
            believe being a dad isn’t a compromise of his strength, but{' '}
            <span className="text-accent">the ultimate expression of it.</span>
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

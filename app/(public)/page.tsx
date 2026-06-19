import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import SectionHeader from '@/components/SectionHeader'
import ScoreBlock from '@/components/ScoreBlock'
import DroppedCard from '@/components/DroppedCard'
import VaultCard from '@/components/VaultCard'
import GuideRow from '@/components/GuideRow'
import TrustBand from '@/components/TrustBand'
import EmailCaptureSection from '@/components/EmailCaptureSection'
import PipelineCounter from '@/components/PipelineCounter'
import HomeHero from '@/components/home/HomeHero'
import CodeRedirect from './_components/CodeRedirect'
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

interface BenchItem {
  id: string
  slug: string
  title: string
  status: string
  image_url: string | null
}

interface Collection {
  slug: string
  title: string
  description: string | null
  hero_image_url: string | null
  collection_type: string
  occasion: string | null
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

export const metadata: Metadata = {
  title: 'Boss Daddy Life — Reviews, Guides, and Gear for Boss Dads',
  description: 'Honest product reviews, real-dad guides, and smart-tech advice for men who show up every day. Zero sponsors. Zero fluff. Real dads + smart tech.',
  alternates: { canonical: '/' },
}

const BENCH_STATUSES: Record<string, { label: string; color: string }> = {
  testing:     { label: 'Testing now',  color: 'text-green-400' },
  queued:      { label: 'Up next',      color: 'text-blue-400' },
  considering: { label: 'Considering',  color: 'text-amber-400' },
}

const PILLARS = [
  {
    href: '/reviews',
    title: 'Honest Reviews',
    blurb: 'Field-tested gear, bought with my own money.',
    cta: 'Browse',
    icon: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
  },
  {
    href: '/guides',
    title: 'Practical Guides',
    blurb: 'No-fluff how-tos for real situations.',
    cta: 'Read',
    icon: (
      <>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
      </>
    ),
  },
  {
    href: '/tools',
    title: 'Boss Tools',
    blurb: 'Weekends Until, Savings & more.',
    cta: 'Try',
    icon: (
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    ),
  },
]

// Static tool count — tools aren't DB-backed (Weekends Until, Savings,
// Dad Math, The Boss). Update when a tool is added/removed.
const TOOLS_COUNT = 4

// Centered, transparent pillar door. Icon scales up on desktop where it has
// room to anchor the column; tighter on mobile where the cards stack.
function PillarCard({
  pillar,
  count,
  className = '',
}: {
  pillar: (typeof PILLARS)[number]
  count: string
  className?: string
}) {
  return (
    <Link
      href={pillar.href}
      className={`group flex flex-col items-center text-center p-4 sm:p-8 hover:bg-surface transition-colors ${className}`}
    >
      <div className="w-11 h-11 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-accent group-hover:bg-accent-hover flex items-center justify-center text-white mb-2.5 sm:mb-4 transition-colors">
        <svg
          className="w-5 h-5 sm:w-8 sm:h-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          {pillar.icon}
        </svg>
      </div>
      <h2 className="text-sm sm:text-lg font-black text-prose group-hover:text-accent transition-colors leading-tight">
        {pillar.title}
      </h2>
      {/* Live count — the "alive / growing" signal. Shown on mobile too. */}
      <span className="text-[10px] sm:text-[11px] font-bold text-accent uppercase tracking-wider tabular-nums mt-1">
        {count}
      </span>
      <p className="hidden sm:block text-sm text-prose-faint mt-2 leading-relaxed max-w-[32ch]">
        {pillar.blurb}
      </p>
      <span className="hidden sm:inline-flex text-sm text-accent font-semibold mt-3 items-center gap-1">
        {pillar.cta}
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
      </span>
    </Link>
  )
}

export default async function HomePage() {
  const supabase = await createClient()

  const [
    { data: topRatedRaw },
    { data: featuredHero },
    { data: recentRaw },
    { data: benchRaw },
    { data: collectionsRaw },
    { data: guidesRaw },
    { count: reviewCountRaw },
    { count: guidesCountRaw },
  ] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved').eq('is_visible', true)
      .order('rating', { ascending: false }).order('published_at', { ascending: false })
      .limit(7),
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved').eq('is_visible', true).eq('featured', true)
      .limit(1).maybeSingle(),
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, image_url, published_at')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(4),
    supabase
      .from('products')
      .select('id, slug, title:name, status, image_url')
      .in('status', ['testing', 'queued', 'considering'])
      .order('priority', { ascending: false }).limit(5),
    supabase
      .from('collections')
      .select('slug, title, description, hero_image_url, collection_type, occasion')
      .eq('is_visible', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(12),
    supabase
      .from('guides')
      .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(3),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved').eq('is_visible', true),
    supabase
      .from('guides')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved').eq('is_visible', true),
  ])

  const topRated: Review[] = (topRatedRaw ?? []) as Review[]
  const featured: Review | null = (featuredHero as Review | null) ?? topRated[0] ?? null
  const scoreCards: Review[] = topRated.filter((r) => r.id !== featured?.id).slice(0, 6)
  const recent: Review[] = (recentRaw ?? []) as Review[]
  const bench: BenchItem[] = (benchRaw ?? []) as BenchItem[]
  const guides: Guide[] = (guidesRaw ?? []) as Guide[]
  const reviewCount = reviewCountRaw ?? 0
  const guidesCount = guidesCountRaw ?? 0

  // Live counts for the wayfinding doors — keyed by href.
  const doorCounts: Record<string, string> = {
    '/reviews': `${reviewCount} tested`,
    '/guides': `${guidesCount} published`,
    '/tools': `${TOOLS_COUNT} free`,
  }

  // Pick a diverse Vault trio — comparison → best_of → general → stack → gift_guide
  // until we hit 3. Preserves the same selection logic as the prior homepage.
  const colPool = (collectionsRaw ?? []) as Collection[]
  const vaultTrio: Collection[] = []
  for (const t of ['comparison', 'best_of', 'general', 'stack', 'gift_guide']) {
    const first = colPool.find((c) => c.collection_type === t && !vaultTrio.includes(c))
    if (first) vaultTrio.push(first)
    if (vaultTrio.length >= 3) break
  }

  return (
    <>
      <Suspense fallback={null}>
        <CodeRedirect />
      </Suspense>

      {/* ── HERO — full-bleed Photo hero. Carries the manifesto + positioning;
            the wayfinding strip below carries orientation + live proof. */}
      <HomeHero />

      {/* ── WAYFINDING STRIP — the handoff from emotion (hero) to orientation.
            A live pipeline proof line + the three pillar doors (Reviews /
            Guides / Tools) as a stat-backed editorial band: 2px orange top
            rule, hairline-split columns, live counts. Always 3-up, compact on
            mobile, never hidden in a slider. */}
      <section className="bg-background border-b border-soft">
        <div className="max-w-6xl mx-auto px-6">
          <div className="pt-7 flex justify-center">
            <PipelineCounter align="center" />
          </div>
          <div className="mt-6 border-t-2 border-accent">
            <div className="grid grid-cols-3 divide-x divide-soft">
              {PILLARS.map((p) => (
                <PillarCard key={p.href} pillar={p} count={doorCounts[p.href]} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── HERO ─────────────────────────────────────────────────────────
            Featured review on the left, On-the-Bench panel on the right.
            Two columns on desktop, stacked on mobile. */}
      <section className="border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 py-14 md:py-16 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-12 lg:gap-16 items-start">

          {featured ? (
            <div>
              <div className="inline-flex items-center gap-2 mb-6">
                <span className="w-5 h-0.5 bg-accent" />
                <p className="text-[10px] font-extrabold text-accent uppercase tracking-[0.22em]">
                  Featured Review
                </p>
              </div>

              <div className="flex items-start gap-6 mb-7">
                <ScoreBlock rating={featured.rating} size="lg" />
                <div className="pt-3 border-l-2 border-soft pl-6 flex-1 min-w-0">
                  <h2 className="text-3xl md:text-4xl font-black text-prose leading-[1.1] tracking-tight mb-3">
                    {featured.product_name}
                  </h2>
                  {(() => {
                    const cat = getCategoryBySlug(featured.category)
                    return (
                      <span className="inline-block text-xs font-bold text-prose-muted bg-surface-raised border border-soft rounded-full px-3 py-1 tracking-wide">
                        {cat?.label ?? featured.category}
                      </span>
                    )
                  })()}
                </div>
              </div>

              {featured.image_url && (
                <div className="relative w-full h-72 md:h-80 rounded-2xl overflow-hidden mb-6 shadow-xl shadow-black/10">
                  <Image
                    src={featured.image_url}
                    alt={featured.product_name}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 740px"
                  />
                  {(featured.rating ?? 0) >= 8 && (
                    <div className="absolute top-3 right-3">
                      <BossApprovedBadge size="sm" variant="card" />
                    </div>
                  )}
                </div>
              )}

              {featured.excerpt && (
                <p className="text-base text-prose-muted leading-[1.8] mb-7 max-w-xl">
                  {featured.excerpt.length > 180 ? featured.excerpt.slice(0, 180).trimEnd() + '…' : featured.excerpt}
                </p>
              )}

              <Link
                href={`/reviews/${featured.slug}`}
                className="inline-flex items-center gap-2 bg-drama text-white font-extrabold text-sm px-7 py-3.5 rounded-xl hover:bg-zinc-800 transition-colors"
              >
                Read the Full Verdict
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
            </div>
          ) : (
            <p className="text-prose-muted">No featured review set.</p>
          )}

          {/* Bench panel */}
          <aside className="border-t-2 border-soft pt-8 lg:border-t-0 lg:border-l-2 lg:pt-0 lg:pl-8">
            <SectionHeader label="On the Bench" />

            {bench.length === 0 ? (
              <p className="text-sm text-prose-muted">Nothing in testing right now.</p>
            ) : (
              bench.map((item, i) => {
                const cfg = BENCH_STATUSES[item.status] ?? { label: item.status, color: 'text-prose-muted' }
                return (
                  <Link
                    key={item.id}
                    href={`/bench/${item.slug}`}
                    className={`flex items-center gap-3.5 py-3.5 ${i < bench.length - 1 ? 'border-b border-soft' : ''}`}
                  >
                    <div className="shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-surface-raised border border-soft">
                      {item.image_url ? (
                        <Image
                          src={item.image_url}
                          alt={item.title}
                          width={56}
                          height={56}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className={`w-2.5 h-2.5 rounded-full ${cfg.color.replace('text-', 'bg-')}`} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-prose leading-tight truncate">
                        {item.title}
                      </div>
                      <div className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${cfg.color}`}>
                        {cfg.label}
                      </div>
                    </div>
                    <svg className="w-3 h-3 text-prose-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })
            )}

            <Link
              href="/bench"
              className="inline-flex items-center mt-5 text-xs font-bold text-accent uppercase tracking-[0.08em]"
            >
              See what&apos;s next →
            </Link>
          </aside>
        </div>
      </section>

      {/* ── JUST DROPPED ─────────────────────────────────────────────────── */}
      {recent.length > 0 && (
        <section className="bg-surface-raised border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-12">
            <SectionHeader
              label="Just Dropped"
              right={{ label: 'All reviews', href: '/reviews' }}
            />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              {recent.map((r) => <DroppedCard key={r.id} review={r} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── FREE TOOLS — promoted high to pay off "Smart Tools" in the H1.
            Two-up feature format breaks the review-card-grid rhythm. ──────── */}
      <section className="border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <SectionHeader
            label="Free Tools"
            right={{ label: 'See all tools', href: '/tools' }}
          />
          <Link
            href="/tools/the-boss"
            className="block bg-surface border border-soft hover:border-accent rounded-2xl p-6 sm:p-8 mb-4 shadow-md shadow-black/[0.04] hover:shadow-lg hover:shadow-black/[0.08] transition-all duration-200 group"
          >
            <p className="text-xs text-eyebrow uppercase tracking-widest font-medium">
              New · Ask the Boss
            </p>
            <h3 className="text-xl sm:text-2xl font-black mt-2 text-prose group-hover:text-accent transition-colors leading-tight">
              Tell the Boss what you need — get a tested pick, not a guess.
            </h3>
            <p className="text-prose-faint mt-3 text-sm sm:text-base max-w-prose">
              Gear recommendations grounded in real, hands-on reviews — plus straight answers on how-to,
              planning, and dad life. Picks come with scores and buy links; the takes come in plain English.
            </p>
            <p className="text-sm text-accent font-semibold mt-5 inline-flex items-center gap-1 group-hover:underline">
              Ask the Boss
              <span aria-hidden>→</span>
            </p>
          </Link>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Link
              href="/tools/weekends-until"
              className="block bg-surface border border-soft hover:border-accent rounded-2xl p-6 sm:p-8 shadow-md shadow-black/[0.04] hover:shadow-lg hover:shadow-black/[0.08] transition-all duration-200 group"
            >
              <p className="text-xs text-eyebrow uppercase tracking-widest font-medium">
                Time · Weekends Until
              </p>
              <h3 className="text-xl sm:text-2xl font-black mt-2 text-prose group-hover:text-accent transition-colors leading-tight">
                How many weekends do you have left with your kid?
              </h3>
              <p className="text-prose-faint mt-3 text-sm sm:text-base max-w-prose">
                Pick a birthdate. Pick a milestone. Get the number. Then make them count.
              </p>
              <p className="text-sm text-accent font-semibold mt-5 inline-flex items-center gap-1 group-hover:underline">
                Try it
                <span aria-hidden>→</span>
              </p>
            </Link>

            <Link
              href="/tools/savings"
              className="block bg-surface border border-soft hover:border-accent rounded-2xl p-6 sm:p-8 shadow-md shadow-black/[0.04] hover:shadow-lg hover:shadow-black/[0.08] transition-all duration-200 group"
            >
              <p className="text-xs text-eyebrow uppercase tracking-widest font-medium">
                Money · Savings
              </p>
              <h3 className="text-xl sm:text-2xl font-black mt-2 text-prose group-hover:text-accent transition-colors leading-tight">
                Small commitments, daily. Tap &quot;yes,&quot; watch the dollars stack.
              </h3>
              <p className="text-prose-faint mt-3 text-sm sm:text-base max-w-prose">
                $2 a day for a camping trip. $50 a month into a 529 or Trump Account.
                Tiny habits, real progress. Invite your spouse so the streak counts as a team.
              </p>
              <p className="text-sm text-accent font-semibold mt-5 inline-flex items-center gap-1 group-hover:underline">
                Try it
                <span aria-hidden>→</span>
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FROM THE LIBRARY — guides row list. Lifted here so the Guides
            pillar gets a fair, high placement alongside Reviews and Tools
            instead of being buried near the page foot. ────────────────────── */}
      {guides.length > 0 && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-14">
            <SectionHeader
              label="From the Library"
              right={{ label: 'All guides', href: '/guides' }}
            />
            <div>
              {guides.map((g, i) => (
                <GuideRow key={g.id} guide={g} isLast={i === guides.length - 1} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TOP PICKS — highest-rated, as a ranked editorial list (not a card
            grid) so it reads distinctly from the "Just Dropped" cards above. */}
      {scoreCards.length > 0 && (
        <section className="border-b border-soft">
          <div className="max-w-4xl mx-auto px-6 py-14">
            <SectionHeader
              label="Top Picks"
              right={{ label: `All ${reviewCount} reviews`, href: '/reviews' }}
            />
            <ol className="mt-2 border-t border-strong/30">
              {scoreCards.map((r, i) => {
                const cat = getCategoryBySlug(r.category)
                return (
                  <li key={r.id} className="border-b border-strong/30">
                    <Link
                      href={`/reviews/${r.slug}`}
                      className="group flex items-center gap-4 sm:gap-5 py-4"
                    >
                      <span className="w-7 sm:w-10 shrink-0 text-center text-2xl sm:text-3xl font-black text-prose-faint/50 tabular-nums">
                        {i + 1}
                      </span>
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-surface border border-soft shrink-0">
                        {r.image_url && (
                          <Image
                            src={r.image_url}
                            alt={r.product_name}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-eyebrow uppercase tracking-wider font-bold">
                          {cat?.label ?? r.category}
                        </div>
                        <div className="font-black text-prose group-hover:text-accent transition-colors leading-tight truncate">
                          {r.product_name}
                        </div>
                      </div>
                      <div className="shrink-0 text-right leading-none">
                        <span className="text-xl sm:text-2xl font-black text-accent tabular-nums">
                          {r.rating != null ? r.rating.toFixed(1) : '—'}
                        </span>
                        <span className="block mt-0.5 text-[9px] font-bold uppercase tracking-wider text-prose-muted">
                          / 10
                        </span>
                      </div>
                      <svg className="w-4 h-4 text-prose-faint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>
      )}

      {/* ── TRUST BAND — single dark moment per page ─────────────────────── */}
      <TrustBand />

      {/* ── FROM THE VAULT ───────────────────────────────────────────────── */}
      {vaultTrio.length > 0 && (
        <section className="bg-surface-raised border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-14">
            <SectionHeader
              label="From the Vault"
              right={{ label: 'Browse all', href: '/vault' }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vaultTrio.map((col) => <VaultCard key={`${col.collection_type}:${col.slug}`} col={col} />)}
            </div>
          </div>
        </section>
      )}

      {/* ── GET THE APP — install band, lowered into the bottom conversion
            cluster (with the email capture) so it asks once the visitor has
            seen the goods, not before. Always-visible door to /install. ───── */}
      <section className="border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="bg-surface border border-soft rounded-2xl p-6 sm:p-8 shadow-md shadow-black/[0.04] flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
            <div className="w-14 h-14 rounded-2xl bg-drama flex items-center justify-center shrink-0">
              <Image
                src="/images/bd-logo-icon.png"
                alt=""
                width={36}
                height={36}
                className="w-9 h-9 object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-eyebrow uppercase tracking-widest font-medium">Boss Daddy App</p>
              <h2 className="text-xl sm:text-2xl font-black text-prose leading-tight mt-1">
                Keep Boss Daddy one tap away.
              </h2>
              <p className="text-prose-faint mt-2 text-sm sm:text-base max-w-prose">
                Add us to your home screen — reviews, gear, and tools, right where you keep everything
                else. No app store, no bloat.
              </p>
            </div>
            <Link
              href="/install"
              className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-extrabold text-sm px-7 py-3.5 rounded-xl transition-colors shrink-0 min-h-[44px]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0-4-4m4 4 4-4M4 20h16" />
              </svg>
              {LABELS.app.short}
            </Link>
          </div>
        </div>
      </section>

      {/* ── EMAIL CAPTURE — primary newsletter conversion ────────────────── */}
      <EmailCaptureSection />
    </>
  )
}

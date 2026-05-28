import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug } from '@/lib/categories'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import SectionHeader from '@/components/SectionHeader'
import ScoreBlock from '@/components/ScoreBlock'
import ScoreCard from '@/components/ScoreCard'
import DroppedCard from '@/components/DroppedCard'
import VaultCard from '@/components/VaultCard'
import GuideRow from '@/components/GuideRow'
import TrustBand from '@/components/TrustBand'
import EmailCaptureSection from '@/components/EmailCaptureSection'
import CodeRedirect from './_components/CodeRedirect'
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
  testing:     { label: 'Testing now',  color: 'text-green-600' },
  queued:      { label: 'Up next',      color: 'text-blue-600' },
  considering: { label: 'Considering',  color: 'text-amber-600' },
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
      .from('wishlist_items')
      .select('id, slug, title, status, image_url')
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
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved').eq('is_visible', true),
  ])

  const topRated: Review[] = (topRatedRaw ?? []) as Review[]
  const featured: Review | null = (featuredHero as Review | null) ?? topRated[0] ?? null
  const scoreCards: Review[] = topRated.filter((r) => r.id !== featured?.id).slice(0, 6)
  const recent: Review[] = (recentRaw ?? []) as Review[]
  const bench: BenchItem[] = (benchRaw ?? []) as BenchItem[]
  const guides: Guide[] = (guidesRaw ?? []) as Guide[]
  const reviewCount = reviewCountRaw ?? 0

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

      {/* ── EDITORIAL BANNER — opens the page with credibility ──────────── */}
      <div className="bg-accent">
        <div className="max-w-6xl mx-auto px-6 py-2.5 text-center">
          <p className="text-xs font-bold text-white tracking-wide">
            Field-tested reviews — zero sponsored content
          </p>
        </div>
      </div>

      {/* ── BRAND INTRO — answers "what is this?" before the content scrolls.
            Sits between the editorial banner and the hero so first-time
            visitors get the voice + context before evaluating reviews. The
            trust band (further down) carries the formal stats; this carries
            the first-person voice. */}
      <section className="bg-background border-b border-soft">
        <div className="max-w-3xl mx-auto px-6 py-12 md:py-14 text-center">
          <h2 className="text-2xl md:text-3xl font-black text-prose leading-tight tracking-tight mb-4">
            I buy it. I use it. I tell you if it&apos;s worth your money.
          </h2>
          <p className="text-base text-prose-muted leading-[1.7] mb-6 max-w-2xl mx-auto">
            No PR samples. No affiliate pressure. Every product came out of my own pocket — and got real use on weekends, during family trips, in the garage, and at 3am with a screaming baby.
          </p>
          <Link
            href="/about"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:text-accent-hover transition-colors"
          >
            Who is Boss Daddy?
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
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
                  <h1 className="text-3xl md:text-4xl font-black text-prose leading-[1.1] tracking-tight mb-3">
                    {featured.product_name}
                  </h1>
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

      {/* ── TOP SCORES ───────────────────────────────────────────────────── */}
      {scoreCards.length > 0 && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-14">
            <SectionHeader
              label="Top Scores"
              right={{ label: `All ${reviewCount} reviews`, href: '/reviews' }}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scoreCards.map((r) => <ScoreCard key={r.id} review={r} />)}
            </div>
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

      {/* ── FROM THE LIBRARY — guides row list ───────────────────────────── */}
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

      {/* ── FREE TOOLS — Weekends Until invitation strip ─────────────────── */}
      <section className="bg-surface-raised border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <SectionHeader
            label="Free Tools"
            right={{ label: 'See all tools', href: '/tools' }}
          />
          <Link
            href="/tools/weekends-until"
            className="block bg-surface border border-soft hover:border-accent rounded-2xl p-6 sm:p-10 transition-colors group"
          >
            <p className="text-xs text-eyebrow uppercase tracking-widest font-medium">
              Weekends Until
            </p>
            <h3 className="text-2xl sm:text-3xl font-black mt-2 text-prose group-hover:text-accent transition-colors leading-tight">
              How many weekends do you have left with your kid?
            </h3>
            <p className="text-prose-faint mt-3 text-base max-w-prose">
              Pick a birthdate. Pick a milestone. Get the number. Then make them count.
            </p>
            <p className="text-sm text-accent font-semibold mt-5 inline-flex items-center gap-1 group-hover:underline">
              Try it
              <span aria-hidden>→</span>
            </p>
          </Link>
        </div>
      </section>

      {/* ── EMAIL CAPTURE — primary newsletter conversion ────────────────── */}
      <EmailCaptureSection />
    </>
  )
}

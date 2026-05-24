import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { getCategoryBySlug } from '@/lib/categories'
import { LABELS } from '@/lib/labels'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import CategoryIcon from '@/components/CategoryIcon'
import RatingScore from '@/components/RatingScore'
import CodeRedirect from './_components/CodeRedirect'
import { LatestGuidesSection } from './_components/LatestGuidesSection'
import { OCCASIONS } from '@/lib/gift-occasions'
import type { Metadata } from 'next'

// Shape used by the From-The-Vault strip. Small inline interface instead of
// the full DB row type — we only consume a few fields here.
interface VaultStripCard {
  slug:            string
  title:           string
  description:     string | null
  hero_image_url:  string | null
  collection_type: string
  occasion:        string | null
}

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Boss Daddy Life — Reviews, Guides, and Gear for Boss Dads',
  description: 'Honest product reviews, real-dad guides, and smart-tech advice for men who show up every day. Zero sponsors. Zero fluff. Real dads + smart tech.',
  alternates: { canonical: '/' },
}

/**
 * Homepage v3 — "Click Into Content."
 *
 * Architecture: 7 surfaces on a single dark canvas. Orange is accent only.
 * Content leads. Framing sits in supporting positions. Single dark scope
 * sitewide — every page (homepage, listings, detail, dashboard) reads as
 * one room.
 *
 *   1. Hero — brand statement, one CTA
 *   2. Trust strip — three quick proof numbers
 *   3. Recent Reviews — magazine 1+3 grid
 *   4. Latest Guides — editorial row list
 *   5. From The Vault — derived collections
 *   6. The Standard — trust panel
 *   7. Closing signature — sign-off + "Read my story" ghost CTA
 *
 * In-page newsletter removed 2026-05-24 in favor of letting the Footer
 * band carry email conversion — three sequential signup asks (in-page +
 * closer + footer) was redundant. Trust strip seeds proof up front,
 * closer drives into /about for the "who's behind this" door.
 */
export default async function HomePage() {
  const supabase = await createClient()

  const [
    { data: latestReviewsRaw },
    { data: vaultPicksRaw },
    { count: reviewCountRaw },
  ] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(4),
    supabase
      .from('collections')
      .select('slug, title, description, hero_image_url, collection_type, occasion, published_at')
      .eq('is_visible', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(12),
    supabase
      .from('reviews')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .eq('is_visible', true),
  ])

  const reviewCount = reviewCountRaw ?? 0

  const latestReviews = (latestReviewsRaw ?? []).slice(0, 4)

  // Pick a diverse Vault trio — one of each flavor when possible, falling
  // back to whatever's most recent. Surface ordering: comparison → pick →
  // stack → gift_guide (drops as needed when we hit 3).
  const vaultPool = (vaultPicksRaw ?? []) as VaultStripCard[]
  const vaultTrio: VaultStripCard[] = []
  for (const t of ['comparison', 'best_of', 'general', 'stack', 'gift_guide']) {
    const first = vaultPool.find((v) => v.collection_type === t && !vaultTrio.includes(v))
    if (first) vaultTrio.push(first)
    if (vaultTrio.length >= 3) break
  }

  return (
    <>
      <Suspense fallback={null}>
        <CodeRedirect />
      </Suspense>

      {/* ── 1. HERO ──────────────────────────────────────────────────────
            Brand identity moment. ONE primary CTA — the magazine grid
            below carries the rest. Shield watermark sits at quieter
            opacity (was 65-75% desktop / 18% mobile) so the H1 reads
            cleanly without competing brand signals. */}
      <section className="relative overflow-hidden">
        {/* Mobile shield — centered watermark, faint */}
        <div
          aria-hidden
          className="md:hidden absolute inset-0 pointer-events-none opacity-[0.14]"
          style={{
            backgroundImage: "url('/images/bd-logo-badge.png')",
            backgroundSize: 'auto 60%',
            backgroundPosition: 'center 55%',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Desktop shield — right-anchored stamp, quieter than before */}
        <div
          aria-hidden
          className="hidden md:block absolute inset-0 pointer-events-none opacity-50 lg:opacity-55"
          style={{
            backgroundImage: "url('/images/bd-hero-bg.png')",
            backgroundSize: 'auto 140%',
            backgroundPosition: '98% center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* Mobile scrim — soft top/bottom dim */}
        <div
          aria-hidden
          className="md:hidden absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,10,12,0.6) 0%, rgba(10,10,12,0.2) 35%, rgba(10,10,12,0.5) 100%)',
          }}
        />

        {/* Desktop scrim — left copy coverage + warm right-side radial */}
        <div
          aria-hidden
          className="hidden md:block absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(10,10,12,0.78) 0%, rgba(10,10,12,0.4) 32%, transparent 58%), radial-gradient(ellipse 55% 45% at 88% 50%, rgba(204,85,0,0.14), transparent 65%)',
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="max-w-2xl">
            <p className="text-[11px] md:text-xs uppercase tracking-[0.3em] font-bold text-accent-text mb-5">
              Dad Like A BOSS.
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.02] tracking-tight mb-6 text-zinc-50">
              Reviews, Guides, and Gear<br />
              <span className="text-accent">for Boss Dads.</span>
            </h1>
            <p className="text-zinc-300 text-base md:text-lg leading-relaxed mb-8 max-w-xl">
              Tested firsthand with my own money. No sponsors, no paid placements, no BS.
            </p>
            <Link
              href="/reviews"
              className="inline-flex items-center px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-2xl transition-colors shadow-lg shadow-black/30"
            >
              See the latest reviews →
            </Link>
          </div>
        </div>
      </section>

      {/* ── TRUST STRIP — quiet proof band ───────────────────────────────
            Sits between the hero and the editorial spread. Lives on the
            page's dark canvas with a top hairline anchoring it to the
            hero. Three quick numbers — proof up front for cold traffic
            so the "no sponsors" claim has evidence behind it. */}
      <section
        aria-labelledby="trust-strip-heading"
        className="relative"
      >
        <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-14">
          <h2 id="trust-strip-heading" className="sr-only">
            The Standard, in three numbers
          </h2>
          <ul className="grid grid-cols-3 gap-2 sm:gap-12">
            <li className="text-center">
              <p className="font-black text-3xl sm:text-4xl md:text-5xl text-accent tabular-nums leading-none">
                {reviewCount}
              </p>
              <p className="mt-2 sm:mt-3 text-[10px] sm:text-xs uppercase tracking-[0.2em] font-bold text-zinc-400">
                Reviews · My&nbsp;Money
              </p>
            </li>
            <li className="text-center border-x border-zinc-800/60">
              <p className="font-black text-3xl sm:text-4xl md:text-5xl text-accent tabular-nums leading-none">
                0
              </p>
              <p className="mt-2 sm:mt-3 text-[10px] sm:text-xs uppercase tracking-[0.2em] font-bold text-zinc-400">
                Sponsors · Paid&nbsp;Placements
              </p>
            </li>
            <li className="text-center">
              <p className="font-black text-3xl sm:text-4xl md:text-5xl text-accent tabular-nums leading-none">
                100%
              </p>
              <p className="mt-2 sm:mt-3 text-[10px] sm:text-xs uppercase tracking-[0.2em] font-bold text-zinc-400">
                Bought &amp;&nbsp;Tested
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* ── 2. RECENT REVIEWS — magazine 1+3 grid ─────────────────────────
            Premium treatment. Hero card spans 2×2; three supporting cards
            stack on the right at lg+. Cards use Shadow Skin (no borders,
            shadow elevation only) per brand-guide doctrine. */}
      {latestReviews.length > 0 && (
        <section className="relative">
          <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-24">
            <div className="flex items-end justify-between mb-8 gap-4">
              <div className="flex items-stretch gap-4 min-w-0">
                <div className="w-[3px] bg-accent rounded-full shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-2">— Recent Reviews</p>
                  <h2 className="text-2xl md:text-3xl font-black text-prose leading-tight">
                    Bought, tested, and Boss Daddy Approved.
                  </h2>
                  <p className="mt-2 text-sm text-prose-muted">What I actually used this month.</p>
                </div>
              </div>
              <Link
                href="/reviews"
                className="hidden sm:inline-flex items-center text-xs text-prose-muted hover:text-accent-text transition-colors uppercase tracking-widest font-semibold shrink-0 whitespace-nowrap"
              >
                View all →
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-5">
              {latestReviews.map((r, i) => {
                const isHero = i === 0
                return (
                  <Link
                    key={r.id}
                    href={`/reviews/${r.slug}`}
                    className={`group flex flex-col bg-surface rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 hover:-translate-y-0.5 transition-all duration-200 ${
                      isHero ? 'lg:col-span-2 lg:row-span-2' : ''
                    }`}
                  >
                    {r.image_url && (
                      <div
                        className={`relative w-full bg-surface-raised shrink-0 ${
                          isHero ? 'h-64 sm:h-80 lg:h-[420px]' : 'h-44'
                        }`}
                      >
                        <Image
                          src={r.image_url}
                          alt={r.product_name}
                          fill
                          priority={i === 0}
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes={
                            isHero
                              ? '(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 680px'
                              : '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
                          }
                        />
                        {(r.rating ?? 0) >= 8 && (
                          <div className="absolute top-3 right-3">
                            <BossApprovedBadge size="sm" variant="card" />
                          </div>
                        )}
                      </div>
                    )}
                    <div className={`flex flex-col flex-1 ${isHero ? 'p-6 lg:p-7' : 'p-5'}`}>
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {(() => {
                            const cat = getCategoryBySlug(r.category)
                            return cat ? (
                              <>
                                <CategoryIcon slug={cat.slug} className="w-3.5 h-3.5 text-accent-text shrink-0" />
                                <span className="text-[10px] sm:text-xs text-accent-text uppercase tracking-widest font-semibold truncate">
                                  {cat.label}
                                </span>
                              </>
                            ) : null
                          })()}
                        </div>
                        <RatingScore rating={r.rating ?? 0} />
                      </div>
                      <h3
                        className={`leading-snug group-hover:text-accent-text transition-colors flex-1 text-prose ${
                          isHero ? 'text-xl md:text-2xl font-black' : 'text-base font-semibold'
                        }`}
                      >
                        {r.title}
                      </h3>
                      {r.excerpt && (
                        <p
                          className={`text-prose-muted mt-2 ${
                            isHero ? 'text-sm sm:text-base line-clamp-3' : 'text-sm line-clamp-2'
                          }`}
                        >
                          {r.excerpt}
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-4 pt-4">
                        <span className="text-xs text-prose-faint">
                          {r.published_at
                            ? new Date(r.published_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : ''}
                        </span>
                        <span className="text-xs text-accent-text font-medium">Read review →</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 3. LATEST GUIDES — editorial row list ─────────────────────────
            Breadth signal. */}
      <Suspense fallback={<LatestGuidesSkeleton />}>
        <LatestGuidesSection />
      </Suspense>

      {/* ── 4. FROM THE VAULT — derived collections ───────────────────────
            Comparisons, picks, stacks, gift guides. Dark surface cards
            (no orange footer panel — that was the second "orange moment"
            we eliminated in v3). Mobile: stacked single column. */}
      {vaultTrio.length > 0 && (
        <section className="relative">
          <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-24">
            <div className="flex items-end justify-between mb-8 gap-4">
              <div className="flex items-stretch gap-4 min-w-0">
                <div className="w-[3px] bg-accent rounded-full shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-2">— From The Vault</p>
                  <h2 className="text-2xl md:text-3xl font-black text-prose leading-tight">
                    Comparisons, kits, and curated picks.
                  </h2>
                  <p className="mt-2 text-sm text-prose-muted">{LABELS.vault.tagline}</p>
                </div>
              </div>
              <Link
                href="/vault"
                title={LABELS.vault.tagline}
                className="hidden sm:inline-flex items-center text-xs text-prose-muted hover:text-accent-text transition-colors uppercase tracking-widest font-semibold shrink-0 whitespace-nowrap"
              >
                Open the Vault →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {vaultTrio.map((card) => {
                const meta = vaultTypeMeta(card.collection_type)
                const href = vaultHrefFor(card)
                return (
                  <Link
                    key={`${card.collection_type}:${card.slug}`}
                    href={href}
                    className="group flex flex-col bg-surface rounded-2xl overflow-hidden shadow-lg shadow-black/40 hover:shadow-xl hover:shadow-black/60 hover:-translate-y-0.5 transition-all duration-200"
                  >
                    <div className="relative aspect-video bg-surface-raised">
                      {card.hero_image_url ? (
                        <Image
                          src={card.hero_image_url}
                          alt={card.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-accent/40">
                          {meta.icon}
                        </div>
                      )}
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-zinc-900/85 backdrop-blur border border-zinc-700 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-text">
                        {meta.label}
                      </span>
                    </div>
                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-base font-black text-prose leading-snug mb-2 line-clamp-2 tracking-tight group-hover:text-accent-text transition-colors">
                        {card.title}
                      </h3>
                      {card.description && (
                        <p className="text-sm text-prose-muted leading-relaxed line-clamp-2 flex-1">{card.description}</p>
                      )}
                      <p className="mt-4 text-xs text-accent-text font-bold uppercase tracking-widest inline-flex items-center gap-1">
                        Read <span aria-hidden>→</span>
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── 5. THE STANDARD — quiet trust panel ───────────────────────────
            Replaces the full-bleed orange "Rules" manifesto. Now a single
            contained dark card on the page bg. Sits AFTER the content,
            not before — visitors see the work first, then read why it's
            trustworthy. */}
      <section className="relative">
        <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="bg-surface rounded-2xl shadow-lg shadow-black/40 p-8 md:p-12 lg:p-14">
            <div className="text-center mb-10 md:mb-12 max-w-2xl mx-auto">
              <p className="text-[11px] md:text-xs text-accent-text uppercase tracking-[0.3em] font-bold mb-3">— The Standard</p>
              <h2 className="text-2xl md:text-3xl font-black text-zinc-50 leading-tight">
                Three rules. That&apos;s the whole standard.
              </h2>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
              {[
                {
                  n: '01',
                  title: 'I Bought It.',
                  body: 'My money. No PR samples, no free units, no sponsor influence.',
                },
                {
                  n: '02',
                  title: 'I Used It.',
                  body: 'Weeks, not minutes. My kid, my grill, my garage, my weekends.',
                },
                {
                  n: '03',
                  title: "I'll Tell The Truth.",
                  body: "The score on the page is the score I'd give a friend.",
                },
              ].map((rule) => (
                <li key={rule.n} className="flex flex-col items-center text-center">
                  <span
                    aria-hidden
                    className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent text-white font-black text-base tabular-nums mb-4 shadow-md shadow-black/30"
                  >
                    {rule.n}
                  </span>
                  <p className="text-lg md:text-xl font-black text-zinc-50 tracking-tight mb-2 leading-tight">
                    {rule.title}
                  </p>
                  <p className="text-zinc-400 leading-relaxed text-sm max-w-xs">
                    {rule.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ── 6. CLOSING SIGNATURE — final beat + quiet CTA ─────────────────
            Page sign-off with one ghost CTA into /about. Newsletter
            conversion lives in the Footer band, so this slot stays
            focused on personality + a single "meet the dad" door. */}
      <section className="relative py-24 md:py-32">
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <p className="text-[11px] text-accent-text uppercase tracking-[0.3em] font-black mb-6">— The Bottom Line</p>
          <p className="text-3xl md:text-5xl font-black text-zinc-50 leading-[1.1] mb-8 tracking-tight">
            Now let&apos;s dad like a BOSS —{' '}
            <span className="text-accent italic">together.</span>
          </p>
          <p className="text-sm text-zinc-400 italic font-semibold mb-10">— Boss Daddy</p>
          <Link
            href="/about"
            className="inline-flex items-center px-5 py-2.5 border border-zinc-700 hover:border-accent rounded-2xl text-sm font-semibold text-zinc-200 hover:text-accent-text transition-colors"
          >
            Read my story →
          </Link>
        </div>
      </section>
    </>
  )
}

function vaultHrefFor(card: VaultStripCard): string {
  if (card.collection_type === 'gift_guide') {
    if (!card.occasion) return '/gifts'
    const occ = OCCASIONS.find((o) => o.value === card.occasion)
    return occ ? `/gifts/${occ.slug}` : '/gifts'
  }
  if (card.collection_type === 'comparison') return `/comparisons/${card.slug}`
  if (card.collection_type === 'stack')      return `/stacks/${card.slug}`
  return `/picks/${card.slug}`
}

function vaultTypeMeta(type: string): { label: string; icon: React.ReactNode } {
  const cls = 'w-10 h-10'
  if (type === 'comparison') {
    return {
      label: 'Comparison',
      icon: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" /></svg>,
    }
  }
  if (type === 'stack') {
    return {
      label: 'Stack',
      icon: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
    }
  }
  if (type === 'gift_guide') {
    return {
      label: 'Gift Guide',
      icon: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>,
    }
  }
  return {
    label: type === 'best_of' ? 'Best Of' : 'Pick List',
    icon: <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>,
  }
}

function LatestGuidesSkeleton() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20">
      <div className="mb-8">
        <div className="h-px w-6 bg-surface-raised mb-3" />
        <div className="h-3 w-32 bg-surface-raised rounded mb-3 animate-pulse" />
        <div className="h-7 w-72 bg-surface-raised rounded animate-pulse" />
      </div>
      <div className="divide-y divide-soft">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-5 py-6">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 bg-surface-raised rounded animate-pulse" />
              <div className="h-5 w-full bg-surface-raised rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-surface-raised rounded animate-pulse" />
            </div>
            <div className="w-20 h-20 sm:w-28 sm:h-24 bg-surface-raised/50 rounded-2xl animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </section>
  )
}

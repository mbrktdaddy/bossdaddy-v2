import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import { LABELS } from '@/lib/labels'
import BossApprovedBadge from '@/components/BossApprovedBadge'
import CategoryIcon from '@/components/CategoryIcon'
import RatingScore from '@/components/RatingScore'
import CodeRedirect from './_components/CodeRedirect'
import { LatestGuidesSection } from './_components/LatestGuidesSection'
import BenchStrip from '@/components/BenchStrip'
import InMotionTicker from '@/components/InMotionTicker'
import { HomepageMerchStrip } from '@/components/HomepageMerchStrip'
import { EmailSignup } from '@/components/EmailSignup'
import { OCCASIONS } from '@/lib/gift-occasions'
import type { Metadata } from 'next'

// Used by the From-The-Vault strip; small inline shape rather than reaching
// for the full DB row type since we only consume a few fields here.
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

export default async function HomePage() {
  const supabase = await createClient()

  // Buildora hero pattern: brand-statement + info card + stats. No
  // featured-product card in the hero anymore — featured content appears
  // as the first card in Recent Reviews magazine grid below.
  // (Admin spotlight pins on /reviews and /guides listing pages still
  // respected; they just don't drive a hero-product slot on /.)

  const [
    { data: latestReviewsRaw },
    { data: vaultPicksRaw },
  ] = await Promise.all([
    // Fetch 4 latest reviews for the magazine grid (1 hero card + 3 stacked).
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, excerpt, image_url, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(4),
    // Up to 6 recent Vault collections — we pick a diverse trio downstream
    // (one comparison + one pick/best-of + one stack/gift_guide) so the
    // homepage strip signals the breadth of editorial content beyond reviews.
    supabase
      .from('collections')
      .select('slug, title, description, hero_image_url, collection_type, occasion, published_at')
      .eq('is_visible', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(12),
  ])

  const latestReviews = (latestReviewsRaw ?? []).slice(0, 4)

  // Pick a diverse Vault trio — one of each flavor when possible, falling
  // back to whatever's most recent. Order on the homepage strip: Comparison →
  // Pick → Stack → Gift Guide (drops as needed when we hit 3).
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

      {/* ── In Motion ticker — auto-fed from Bench testing/queued items.
            Renders nothing when nothing's in motion. ────────────────────── */}
      <Suspense fallback={null}>
        <InMotionTicker />
      </Suspense>

      {/* ── Hero — Buildora-inspired dark canvas + ORANGE info card overlay.
            Big bold typography sets brand voice; the orange info card to
            the right carries the trust manifesto (The Standard); the stats
            row beneath establishes credibility. Photo-ready: when the
            asset arrives, set backgroundImage on the section to a 16:9
            hero photo (2880×1620 retina) and the dark scrim + vignette
            will frame it correctly. ───────────────────────────────── */}
      {/* Hero — responsive shield watermark BG.
          Mobile: faint centered watermark (50% height, 18% opacity, soft top-bottom dim).
          Desktop: right-anchored stamp (85% height, 45% opacity, left-right dim + warm glow). */}
      <section className="relative overflow-hidden">
        {/* BG LAYER 1 — Mobile shield: centered, smaller, fainter.
            Sits behind the text as a subtle brand watermark. */}
        <div
          aria-hidden
          className="md:hidden absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage: "url('/images/bd-hero-bg.png')",
            backgroundSize: 'auto 50%',
            backgroundPosition: 'center 65%',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* BG LAYER 1 — Desktop shield: right-anchored, BIG and visible.
            bg-size 120% intentionally overflows top/bottom (clipped by
            section overflow-hidden) — gives a "stamped" feel where the
            mark feels bigger than the canvas. */}
        <div
          aria-hidden
          className="hidden md:block absolute inset-0 pointer-events-none opacity-65 lg:opacity-75"
          style={{
            backgroundImage: "url('/images/bd-hero-bg.png')",
            backgroundSize: 'auto 120%',
            backgroundPosition: '98% center',
            backgroundRepeat: 'no-repeat',
          }}
        />

        {/* BG LAYER 2 — Mobile scrim: soft top-bottom dim so text reads
            over the centered watermark. */}
        <div
          aria-hidden
          className="md:hidden absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,10,12,0.6) 0%, rgba(10,10,12,0.2) 35%, rgba(10,10,12,0.5) 100%)',
          }}
        />

        {/* BG LAYER 2 — Desktop scrim: covers the copy area on the left,
            quickly fades to transparent at 50% width so the shield on
            the right reads at full strength. Warm orange radial behind
            the shield amplifies the brand glow. */}
        <div
          aria-hidden
          className="hidden md:block absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(90deg, rgba(10,10,12,0.75) 0%, rgba(10,10,12,0.35) 30%, transparent 55%), radial-gradient(ellipse 55% 45% at 88% 50%, rgba(204,85,0,0.16), transparent 65%)',
          }}
        />

        {/* BG LAYER 3 — bottom fade to page bg for smooth transition
            into the InMotionTicker below. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-40 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, transparent, #0a0a0c)',
          }}
        />

        {/* Content — single column, text left-aligned. The shield BG
            anchors the right side; the copy sits cleanly on the left. */}
        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-28 md:pt-28 md:pb-36">
          <div className="max-w-2xl">
            <p className="text-[11px] md:text-xs uppercase tracking-[0.3em] font-bold text-accent-text mb-5">
              Dad Like A BOSS.
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[1.02] tracking-tight mb-6 text-stone-50">
              Reviews, Guides, and Gear<br />
              <span className="text-accent">for Boss Dads.</span>
            </h1>
            <p className="text-stone-300 text-base md:text-lg leading-relaxed mb-8 max-w-xl">
              Tested firsthand with my own money. No sponsors, no paid placements, no BS.
            </p>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <Link
                href="/reviews"
                className="px-6 py-3 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-colors shadow-lg shadow-black/30"
              >
                See This Month&apos;s Top Picks →
              </Link>
              <Link
                href="/guides"
                className="px-6 py-3 bg-transparent border border-stone-700 hover:border-accent hover:bg-stone-900/60 text-stone-200 hover:text-white font-semibold rounded-xl transition-colors"
              >
                Browse Guides
              </Link>
            </div>
            <Link
              href="/about"
              className="inline-block text-sm text-accent-text hover:text-accent font-medium transition-colors"
            >
              Read my story →
            </Link>
          </div>
        </div>
      </section>

      {/* Page runs on a single neutral dark canvas. Section rhythm comes
          from typography, padding, and per-section accent ticks (the small
          w-6 h-px bg-accent/60 line above each section h2). No bg washes —
          the modern palette doesn't need them. */}

      {/* ── Trust strip ─────────────────────────────────────────────────── */}
      <section className="relative">
        <div className="relative max-w-6xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-4">
            <TrustBadge
              href="/how-we-test"
              label="How We Test"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              }
            />
            <TrustBadge
              href="/editorial-standards"
              label="Editorial Standards"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
            />
            <TrustBadge
              href="/affiliate-disclosure"
              label="Affiliate Disclosure"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              }
            />
            <TrustBadge
              label="Zero Paid Placements"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              }
            />
          </div>
        </div>
      </section>

      {/* ── The Rules — ORANGE FULL-BLEED MANIFESTO STRIP.
            Buildora "process strip" pattern. Three numbered steps
            connected by a hairline running through the row. White type
            on brand-orange canvas. The Boss Daddy promise stamped
            across the page. */}
      <section className="relative bg-accent overflow-hidden" aria-labelledby="rules-heading">
        {/* Subtle inner top highlight — gives the orange slab depth */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />
        <div className="relative max-w-6xl mx-auto px-6 py-16 md:py-20">
          <div className="text-center mb-12 md:mb-14">
            <p className="text-[11px] md:text-xs text-stone-50/80 uppercase tracking-[0.3em] font-black mb-3">— The Rules</p>
            <h2 id="rules-heading" className="text-3xl md:text-4xl font-black text-white leading-tight">
              Three rules. That&apos;s the whole standard.
            </h2>
          </div>

          {/* Steps row — three numbered cells, hairline connector behind */}
          <div className="relative">
            {/* Connecting hairline (desktop only, runs behind the number circles) */}
            <span
              aria-hidden
              className="hidden md:block absolute left-[16.66%] right-[16.66%] top-7 h-px bg-white/30"
            />
            <ol className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
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
                <li key={rule.n} className="flex flex-col items-center text-center px-2">
                  {/* Numbered circle marker — sits on the connector line */}
                  <span
                    aria-hidden
                    className="relative z-10 inline-flex items-center justify-center w-14 h-14 rounded-full bg-white text-accent font-black text-lg tabular-nums shadow-lg shadow-black/30 mb-5"
                  >
                    {rule.n}
                  </span>
                  <p className="text-xl md:text-2xl font-black text-white tracking-tight mb-2 leading-tight">{rule.title}</p>
                  <p className="text-stone-50/85 leading-relaxed text-sm md:text-base max-w-xs">
                    {rule.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
        {/* Subtle inner bottom shadow — closes the slab */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-black/15" />
      </section>

      {/* ── LIGHT CONTENT BLOCK — Categories + Recent Reviews.
            First WHITE rhythm break, opening immediately after the orange
            Rules manifesto. Two sections share the .bd-light scope so
            their role tokens (text-prose, bg-surface, border-soft) flip
            to light values automatically. The white block reads as the
            "spotlight content moment" between dark mood sections. */}
      <div className="bd-light bg-white">
      {/* ── Categories — orientation moment after Rules establishes trust.
            Quiet utility ribbon (single eyebrow + 8 pills) — content weight
            matches visual weight. */}
      <section className="relative">
        <div className="relative max-w-6xl mx-auto px-6 pt-12 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
            <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold whitespace-nowrap">
              Pick your lane
            </p>

            {/* Mobile: horizontal scroll strip — break out of padded container,
                restore padding inside per CLAUDE.md horizontal-scroll rule */}
            <div className="sm:hidden -mx-6">
              <div className="flex gap-2.5 overflow-x-auto px-6 pb-1 scrollbar-hide">
                {CATEGORIES.map((cat) => (
                  <CategoryPill key={cat.slug} slug={cat.slug} label={cat.shortLabel} />
                ))}
              </div>
            </div>

            {/* Desktop: wrap to fit, all 8 visible at once */}
            <div className="hidden sm:flex flex-wrap gap-2 flex-1 justify-end">
              {CATEGORIES.map((cat) => (
                <CategoryPill key={cat.slug} slug={cat.slug} label={cat.shortLabel} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Recent Reviews — asymmetric magazine grid (1 hero + 2 stacked) ─ */}
      {latestReviews && latestReviews.length > 0 && (
        <section className="relative">
          <div className="relative max-w-6xl mx-auto px-6 py-16">
            <div className="flex items-end justify-between mb-8 gap-4">
              <div className="flex items-stretch gap-4 min-w-0">
                <div className="w-[3px] bg-accent-brand rounded-full shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-2">— Recent Reviews</p>
                  <h2 className="text-2xl md:text-3xl font-black text-prose leading-tight">Bought, tested, and Boss Daddy Approved</h2>
                </div>
              </div>
              <Link href="/reviews" className="hidden sm:inline-flex items-center text-xs text-prose-faint hover:text-accent-text-soft transition-colors uppercase tracking-widest font-semibold shrink-0">
                View all →
              </Link>
            </div>

            {/* Magazine "1 + 2" layout: hero spans 2x2 on lg, smalls stack 1x1 each on the right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-2 gap-5">
              {latestReviews.map((r, i) => {
                const isHero = i === 0
                return (
                  <Link
                    key={r.id}
                    href={`/reviews/${r.slug}`}
                    className={`group flex flex-col bg-gradient-to-br from-surface to-surface/60 rounded-xl overflow-hidden border border-soft shadow-lg shadow-stone-900/[0.06] hover:border-copper hover:shadow-xl hover:shadow-stone-900/[0.12] hover:-translate-y-1 transition-all duration-200 ${
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
                                <span className="text-[10px] sm:text-xs text-eyebrow uppercase tracking-widest font-semibold truncate">
                                  {cat.label}
                                </span>
                              </>
                            ) : null
                          })()}
                        </div>
                        <RatingScore rating={r.rating ?? 0} />
                      </div>
                      <h3
                        className={`leading-snug group-hover:text-accent-text-soft transition-colors flex-1 ${
                          isHero ? 'text-xl md:text-2xl font-black text-prose' : 'text-base font-semibold'
                        }`}
                      >
                        {r.title}
                      </h3>
                      {r.excerpt && (
                        <p
                          className={`text-prose-faint mt-2 ${
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
                        <span className="text-xs text-accent-text font-medium">Read review</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}
      </div>
      {/* End of LIGHT CONTENT BLOCK — Categories + Recent Reviews */}

      {/* ── From The Vault — diverse trio of collections.
            Dark canvas with Buildora project-card treatment: photo on
            top, ORANGE FOOTER ribbon below with title + subtitle. Cards
            hover up with stronger shadow. Sits between two white
            blocks to break the rhythm. Thin orange top-rule = the
            brand-stitching transition marker from the prior white block. */}
      {vaultTrio.length > 0 && (
        <section className="relative border-t-2 border-accent">
          <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-24">
            <div className="flex items-end justify-between mb-10 gap-4">
              <div className="flex items-stretch gap-4 min-w-0">
                <div className="w-[3px] bg-accent rounded-full shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-2">— From The Vault</p>
                  <h2 className="text-2xl md:text-3xl font-black text-stone-50 leading-tight">Comparisons, kits, and curated picks</h2>
                  <p className="mt-2 text-sm text-stone-400">{LABELS.vault.tagline}</p>
                </div>
              </div>
              <Link
                href="/vault"
                title={LABELS.vault.tagline}
                className="hidden sm:inline-flex items-center text-xs text-stone-400 hover:text-accent-text transition-colors uppercase tracking-widest font-semibold shrink-0 whitespace-nowrap"
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
                    className="group flex flex-col rounded-xl overflow-hidden border border-stone-800 shadow-lg shadow-black/30 hover:border-accent hover:shadow-xl hover:shadow-black/50 hover:-translate-y-1 transition-all duration-200"
                  >
                    {/* Photo top */}
                    <div className="relative aspect-video bg-stone-900">
                      {card.hero_image_url ? (
                        <Image src={card.hero_image_url} alt={card.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-accent/40">{meta.icon}</div>
                      )}
                      {/* Type chip overlay — dark glass on photo */}
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-stone-900/85 backdrop-blur border border-stone-700 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-accent-text">
                        {meta.label}
                      </span>
                    </div>
                    {/* ORANGE FOOTER — Buildora project-card pattern */}
                    <div className="bg-accent p-5 flex flex-col flex-1 relative overflow-hidden">
                      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />
                      <p className="text-base font-black text-white leading-snug mb-2 line-clamp-2 tracking-tight">{card.title}</p>
                      {card.description && (
                        <p className="text-sm text-stone-50/80 leading-relaxed line-clamp-2 flex-1">{card.description}</p>
                      )}
                      <p className="mt-4 text-xs text-white font-bold uppercase tracking-widest inline-flex items-center gap-1">
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

      {/* ── LIGHT CONTENT BLOCK — Latest Guides.
            Second WHITE rhythm break after the dark Vault section.
            .bd-light scope flips role tokens; bg-white sets canvas. */}
      <div className="bd-light bg-white">
        <Suspense fallback={<LatestGuidesSkeleton />}>
          <LatestGuidesSection />
        </Suspense>
      </div>

      {/* ── On the Bench — BenchStrip ships its own complete header
            (pulsing dot eyebrow + tagline + CTA), so no outer section
            header here. Thin orange top-rule = the brand-stitching
            transition marker from the prior white Latest Guides block. */}
      <section className="border-t-2 border-accent">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <Suspense fallback={null}>
            <BenchStrip />
          </Suspense>
        </div>
      </section>

      {/* ── Merch strip ────────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <HomepageMerchStrip />
      </Suspense>

      {/* ── Newsletter — DARK DRAMATIC MOMENT.
            Full-bleed dark panel against the light page rhythm. Cream
            headline + brand orange accent strip + action-orange CTA.
            Creates the "clubhouse invitation" feel. ─────────────────── */}
      {/* ── Newsletter CTA — Buildora "twin orange panels" pattern.
            Dark section header (white H2 + trust bullets), then two
            orange panels side-by-side: signup form on the left, value
            props on the right. Strong conversion moment. */}
      <section id="crew" className="relative">
        <div className="relative max-w-6xl mx-auto px-6 py-20 md:py-24">
          {/* Section header — white H2 on dark bg, with feature bullets */}
          <div className="text-center mb-12">
            <p className="text-[11px] text-accent-text uppercase tracking-[0.3em] font-bold mb-3">— Join the Crew</p>
            <h2 className="text-3xl md:text-4xl font-black text-stone-50 leading-tight tracking-tight mb-6 max-w-2xl mx-auto">
              Leading way in dad-tested reviews &amp; real-life gear.
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-stone-300">
              <span className="inline-flex items-center gap-2">
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Real dad
              </span>
              <span className="inline-flex items-center gap-2">
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Real testing
              </span>
              <span className="inline-flex items-center gap-2">
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Zero sponsors
              </span>
              <span className="inline-flex items-center gap-2">
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                No spam
              </span>
            </div>
          </div>

          {/* Twin orange panels — signup form (left) + value props (right) */}
          <div className="grid md:grid-cols-2 gap-5 max-w-5xl mx-auto">
            {/* Left — Newsletter signup */}
            <div className="bg-accent rounded-xl p-6 sm:p-8 shadow-2xl shadow-black/40 relative overflow-hidden">
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-50/85 mb-4">— Sign Up</p>
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2 leading-tight">
                Get the good stuff in your inbox.
              </h3>
              <p className="text-sm text-stone-50/85 mb-6 leading-relaxed">
                One email when there&apos;s actually something worth saying. Drop your email and let&apos;s ride, Boss.
              </p>
              <EmailSignup
                heading={null}
                description={null}
                buttonLabel="Join Free"
                successMessage="You're in, Boss. Welcome to the crew."
                interests={['newsletter']}
              />
              <p className="text-xs text-stone-50/70 mt-4">Unsubscribe anytime. We mean it.</p>
            </div>

            {/* Right — What You'll Get value props */}
            <div className="bg-accent rounded-xl p-6 sm:p-8 shadow-2xl shadow-black/40 relative overflow-hidden">
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/15" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-50/85 mb-4">— What You&apos;ll Get</p>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-white">
                  <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="font-bold text-base leading-tight">Honest reviews, first.</p>
                    <p className="text-sm text-stone-50/80 leading-snug mt-0.5">Boss Approved picks before anyone else sees them.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-white">
                  <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="font-bold text-base leading-tight">Real-dad guides.</p>
                    <p className="text-sm text-stone-50/80 leading-snug mt-0.5">Skills, how-tos, and field notes worth your time.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3 text-white">
                  <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="font-bold text-base leading-tight">No spam, no fluff.</p>
                    <p className="text-sm text-stone-50/80 leading-snug mt-0.5">One email when it&apos;s worth opening, never just to fill a slot.</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing tagline — quiet dark signature.
            Rules strip + Newsletter twin panels already carry the orange
            manifesto weight; closing stays restrained dark + bold type
            with single orange highlight on the key word. */}
      <section className="relative py-24 md:py-32">
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <p className="text-[11px] text-accent-text uppercase tracking-[0.3em] font-black mb-6">— The Bottom Line</p>
          <p className="text-3xl md:text-5xl font-black text-stone-50 leading-[1.1] mb-10 tracking-tight">
            Now let&apos;s dad like a BOSS —{' '}
            <span className="text-accent italic">together.</span>
          </p>
          <p className="text-sm text-stone-400 italic font-semibold">— Boss Daddy</p>
        </div>
      </section>

    </>
  )
}

function CategoryPill({ slug, label }: { slug: string; label: string }) {
  return (
    <Link
      href={`/category/${slug}`}
      className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-white border border-soft px-4 py-2.5 text-sm font-semibold text-prose min-h-[44px] whitespace-nowrap hover:border-prose hover:bg-stone-50 hover:text-accent-text-soft transition-colors"
    >
      <CategoryIcon slug={slug} className="w-4 h-4 text-accent-text shrink-0" />
      <span>{label}</span>
    </Link>
  )
}

function TrustBadge({
  href,
  label,
  icon,
}: {
  href?: string
  label: string
  icon: React.ReactNode
}) {
  const inner = (
    <span className="flex items-center gap-2.5 group">
      <span className="w-7 h-7 rounded-lg bg-accent-tint border border-accent-border/40 flex items-center justify-center text-accent-text-soft shrink-0 group-hover:border-accent-border/60 transition-colors">
        {icon}
      </span>
      <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-prose-muted group-hover:text-prose transition-colors leading-tight">
        {label}
      </span>
    </span>
  )
  return href ? <Link href={href}>{inner}</Link> : <span className="cursor-default">{inner}</span>
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
    <section className="max-w-5xl mx-auto px-6 py-16">
      <div className="mb-8">
        <div className="h-px w-6 bg-surface-raised mb-3" />
        <div className="h-3 w-32 bg-surface rounded mb-3 animate-pulse" />
        <div className="h-7 w-72 bg-surface rounded animate-pulse" />
      </div>
      <div className="divide-y divide-soft">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-5 py-6">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 bg-surface-raised rounded animate-pulse" />
              <div className="h-5 w-full bg-surface-raised rounded animate-pulse" />
              <div className="h-3 w-3/4 bg-surface-raised rounded animate-pulse" />
            </div>
            <div className="w-20 h-20 sm:w-28 sm:h-24 bg-surface-raised/50 rounded-xl animate-pulse shrink-0" />
          </div>
        ))}
      </div>
    </section>
  )
}

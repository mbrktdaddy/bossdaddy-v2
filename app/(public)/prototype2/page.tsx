/**
 * PROTOTYPE 2 — "The Standard" — light editorial concept
 *
 * Target audience: Dads 28–45. Busy. Practical. They've been burned by
 * sponsored gear lists before. They want a straight answer fast, delivered
 * by someone who actually uses the stuff. They trust print-magazine confidence
 * more than blog-post softness. Think GQ meets Consumer Reports.
 *
 * Design direction: Premium men's editorial on a warm cream base.
 * Dark masthead anchors the top (even light sites need a commanding entry).
 * Content breathes. The score is still the most important element per card.
 * No gradients, no gimmicks — strong typography doing the heavy lifting.
 *
 * Color system:
 *   Page bg    #f7f4ef  — warm cream (not cold white — dads aren't clinicians)
 *   Card       #ffffff  — clean white cards lift off the cream
 *   Card2      #f2ede6  — alternating warm sections
 *   Dark       #1a1714  — warm near-black for headlines
 *   Body text  #3d3830  — warm dark brown for body
 *   Muted      #7a7470  — supporting text
 *   Faint      #c4bfb8  — dividers, ghost elements
 *   Orange     #cc5500  — brand orange (reads stronger on light)
 *   Score      #b87400  — amber — warm, authoritative on light bg
 *   Masthead   #111114  — dark nav bar (editorial anchor)
 */

import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCategoryBySlug } from '@/lib/categories'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Prototype 2 — Boss Daddy Life',
  robots: { index: false, follow: false },
}

// ─── palette ─────────────────────────────────────────────────────────────────
const P = {
  pageBg:    '#f7f4ef',
  card:      '#ffffff',
  card2:     '#f0ece5',
  dark:      '#1a1714',
  body:      '#3d3830',
  muted:     '#7a7470',
  faint:     '#c4bfb8',
  orange:    '#cc5500',
  score:     '#b87400',
  masthead:  '#111114',
  border:    '#e2ddd6',
  cardShadow:'0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
} as const

// ─── data types ──────────────────────────────────────────────────────────────
interface Review {
  id: string; slug: string; title: string; product_name: string
  category: string; rating: number | null; excerpt: string | null
  image_url: string | null; published_at: string | null
}
interface BenchItem {
  id: string; slug: string; title: string; status: string
  image_url: string | null
}
interface Collection {
  slug: string; title: string; description: string | null
  hero_image_url: string | null; collection_type: string
}

// ─── page ─────────────────────────────────────────────────────────────────────
export default async function Prototype2Page() {
  const admin = createAdminClient()

  const [
    { data: reviewsRaw },
    { data: heroReview },
    { data: benchRaw },
    { data: collectionsRaw },
    { count: reviewCount },
  ] = await Promise.all([
    admin.from('reviews').select('id,slug,title,product_name,category,rating,excerpt,image_url,published_at')
      .eq('status', 'approved').eq('is_visible', true)
      .order('rating', { ascending: false }).order('published_at', { ascending: false })
      .limit(7),
    admin.from('reviews').select('id,slug,title,product_name,category,rating,excerpt,image_url,published_at')
      .eq('status', 'approved').eq('is_visible', true).eq('featured', true)
      .limit(1).maybeSingle(),
    admin.from('wishlist_items').select('id,slug,title,status,image_url')
      .in('status', ['testing', 'queued', 'considering'])
      .order('priority', { ascending: false }).limit(5),
    admin.from('collections').select('slug,title,description,hero_image_url,collection_type')
      .eq('is_visible', true).order('published_at', { ascending: false, nullsFirst: false }).limit(9),
    admin.from('reviews').select('*', { count: 'exact', head: true })
      .eq('status', 'approved').eq('is_visible', true),
  ])

  const reviews: Review[] = (reviewsRaw ?? []) as Review[]
  const bench: BenchItem[] = (benchRaw ?? []) as BenchItem[]
  const featured: Review | null = (heroReview as Review | null) ?? reviews[0] ?? null
  const scoreCards = reviews.filter(r => r.id !== featured?.id).slice(0, 6)

  const colPool = (collectionsRaw ?? []) as Collection[]
  const vaultItems: Collection[] = []
  for (const type of ['comparison', 'best_of', 'general', 'stack', 'gift_guide']) {
    const match = colPool.find(c => c.collection_type === type && !vaultItems.includes(c))
    if (match) vaultItems.push(match)
    if (vaultItems.length >= 3) break
  }

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  const today = new Date(now).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

  const W = 1160 // max content width

  return (
    <div style={{ backgroundColor: P.pageBg, color: P.body, minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }}>

      {/* ── DARK MASTHEAD ──────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: P.masthead, borderBottom: `1px solid #222226` }}>
        <div style={{ maxWidth: W, margin: '0 auto', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.3px', color: '#ffffff' }}>
              Boss<span style={{ color: P.orange }}>Daddy</span>Life
            </span>
          </Link>
          <nav style={{ display: 'flex', gap: 28 }}>
            {[['Reviews', '/reviews'], ['Guides', '/guides'], ['Gear', '/gear'], ['The Bench', '/bench'], ['The Vault', '/vault']].map(([label, href]) => (
              <Link key={href} href={href} style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textDecoration: 'none', letterSpacing: '0.04em' }}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* ── EDITORIAL BANNER ───────────────────────────────────────────────── */}
      <div style={{ backgroundColor: P.orange }}>
        <div style={{ maxWidth: W, margin: '0 auto', padding: '10px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#ffffff', letterSpacing: '0.04em' }}>
            {reviewCount ?? 0} field-tested reviews — zero sponsored content
          </p>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.06em' }}>{today}</span>
        </div>
      </div>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${P.border}` }}>
        <div style={{ maxWidth: W, margin: '0 auto', padding: '56px 24px 48px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 48, alignItems: 'start' }}>

          {/* Left: featured review */}
          {featured ? (
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: P.orange, textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'inline-block', width: 20, height: 2, backgroundColor: P.orange }} />
                Featured Review
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 28, marginBottom: 28 }}>
                {/* Score block */}
                <div style={{ flexShrink: 0, textAlign: 'center', padding: '16px 20px', backgroundColor: P.dark, borderRadius: 12 }}>
                  <div style={{ fontSize: 56, fontWeight: 900, lineHeight: 1, color: P.score === P.score ? '#f4af00' : P.score, letterSpacing: '-2px' }}>
                    {featured.rating?.toFixed(1) ?? '—'}
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
                    / 10
                  </div>
                </div>
                <div style={{ paddingTop: 4 }}>
                  <h1 style={{ fontSize: 32, fontWeight: 900, color: P.dark, lineHeight: 1.15, letterSpacing: '-0.8px', margin: '0 0 10px 0' }}>
                    {featured.product_name}
                  </h1>
                  <CategoryTag category={featured.category} />
                </div>
              </div>

              {featured.image_url && (
                <div style={{ position: 'relative', width: '100%', height: 300, borderRadius: 14, overflow: 'hidden', marginBottom: 24, boxShadow: '0 2px 20px rgba(0,0,0,0.12)' }}>
                  <Image src={featured.image_url} alt={featured.product_name} fill style={{ objectFit: 'cover' }} />
                </div>
              )}

              {featured.excerpt && (
                <p style={{ fontSize: 16, color: P.muted, lineHeight: 1.7, marginBottom: 28, maxWidth: 520 }}>
                  {featured.excerpt.length > 200 ? featured.excerpt.slice(0, 200).trimEnd() + '…' : featured.excerpt}
                </p>
              )}

              <Link href={`/reviews/${featured.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: P.dark, color: '#ffffff', fontWeight: 800, fontSize: 14, padding: '14px 28px', borderRadius: 10, textDecoration: 'none' }}>
                Read the Full Verdict
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            </div>
          ) : (
            <p style={{ color: P.muted }}>No featured review set.</p>
          )}

          {/* Right: bench panel */}
          <div style={{ borderLeft: `2px solid ${P.border}`, paddingLeft: 32 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: P.orange, textTransform: 'uppercase', letterSpacing: '0.22em', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 20, height: 2, backgroundColor: P.orange }} />
              On the Bench
            </div>

            {bench.length === 0 ? (
              <p style={{ color: P.muted, fontSize: 13 }}>Nothing in testing right now.</p>
            ) : bench.map((item, i) => (
              <Link key={item.id} href={`/bench/${item.slug}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: i < bench.length - 1 ? `1px solid ${P.border}` : 'none' }}>
                {item.image_url ? (
                  <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: P.card2 }}>
                    <Image src={item.image_url} alt={item.title} width={44} height={44} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                  </div>
                ) : (
                  <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 8, backgroundColor: P.card2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <StatusDot status={item.status} />
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.dark, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                  <StatusLabel status={item.status} />
                </div>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={P.faint} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            ))}

            <Link href="/bench" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 20, fontSize: 12, fontWeight: 700, color: P.orange, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              See what&apos;s next →
            </Link>
          </div>
        </div>
      </div>

      {/* ── THE SCORES ─────────────────────────────────────────────────────── */}
      {scoreCards.length > 0 && (
        <div style={{ backgroundColor: P.pageBg, borderBottom: `1px solid ${P.border}` }}>
          <div style={{ maxWidth: W, margin: '0 auto', padding: '52px 24px' }}>
            <SectionHeader label="The Scores" right={
              <Link href="/reviews" style={{ fontSize: 12, fontWeight: 700, color: P.orange, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                All {reviewCount} reviews →
              </Link>
            } />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {scoreCards.map((r) => <LightScoreCard key={r.id} review={r} />)}
            </div>
          </div>
        </div>
      )}

      {/* ── TRUST BAND ─────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: P.dark, borderBottom: `1px solid #2a2520` }}>
        <div style={{ maxWidth: W, margin: '0 auto', padding: '36px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {[
            { num: reviewCount?.toString() ?? '0', label: 'Field-tested reviews', sub: 'Every one bought out of pocket' },
            { num: '0',  label: 'Sponsored posts', sub: 'And it stays that way' },
            { num: '100%', label: 'Honest verdicts', sub: 'Even when it hurts a product' },
          ].map((stat, i) => (
            <div key={i} style={{ padding: '0 32px', borderLeft: i > 0 ? `1px solid #2a2520` : 'none', textAlign: 'center' }}>
              <div style={{ fontSize: 42, fontWeight: 900, color: '#f4af00', letterSpacing: '-2px', lineHeight: 1 }}>
                {stat.num}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', marginTop: 8, letterSpacing: '-0.2px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                {stat.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FROM THE VAULT ─────────────────────────────────────────────────── */}
      {vaultItems.length > 0 && (
        <div style={{ backgroundColor: P.card2, borderBottom: `1px solid ${P.border}` }}>
          <div style={{ maxWidth: W, margin: '0 auto', padding: '52px 24px' }}>
            <SectionHeader label="From the Vault" right={
              <Link href="/vault" style={{ fontSize: 12, fontWeight: 700, color: P.orange, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Browse all →
              </Link>
            } />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {vaultItems.map(col => <LightVaultCard key={col.slug} col={col} />)}
            </div>
          </div>
        </div>
      )}

      {/* ── CLOSING STATEMENT ──────────────────────────────────────────────── */}
      <div style={{ backgroundColor: P.pageBg }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: 32, height: 3, backgroundColor: P.orange, marginBottom: 28 }} />
          <h2 style={{ fontSize: 34, fontWeight: 900, color: P.dark, lineHeight: 1.2, letterSpacing: '-1px', margin: '0 0 20px 0' }}>
            I buy it. I use it. I tell you if it&apos;s worth your money.
          </h2>
          <p style={{ fontSize: 16, color: P.muted, lineHeight: 1.75, marginBottom: 40 }}>
            No PR samples. No affiliate pressure shaping the verdict. Every product on this site came out of my own pocket and got real use — on weekends, during family trips, in the garage, and at 3am with a screaming baby. You&apos;re not reading sponsored content dressed up as a review. You&apos;re reading what actually happened.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/reviews" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: P.orange, color: '#ffffff', fontWeight: 800, fontSize: 14, padding: '14px 28px', borderRadius: 10, textDecoration: 'none' }}>
              Browse All Reviews
            </Link>
            <Link href="/about" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `2px solid ${P.border}`, color: P.dark, fontWeight: 700, fontSize: 14, padding: '13px 28px', borderRadius: 10, textDecoration: 'none' }}>
              Who Is Boss Daddy?
            </Link>
          </div>
        </div>
      </div>

      {/* ── PROTOTYPE BADGE ────────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 16, right: 16, backgroundColor: P.dark, color: '#ffffff', fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 6, pointerEvents: 'none', zIndex: 9999 }}>
        Prototype 2
      </div>

    </div>
  )
}

// ─── sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-block', width: 20, height: 2, backgroundColor: P.orange }} />
        <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', color: P.muted }}>
          {label}
        </span>
      </div>
      {right}
    </div>
  )
}

function LightScoreCard({ review }: { review: Review }) {
  const cat = getCategoryBySlug(review.category)
  const score = review.rating?.toFixed(1) ?? '—'
  const scoreNum = review.rating ?? 0
  const scoreColor = scoreNum >= 9 ? '#b87400' : scoreNum >= 8 ? P.orange : P.muted

  return (
    <Link href={`/reviews/${review.slug}`} style={{ textDecoration: 'none', display: 'block', backgroundColor: P.card, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: P.cardShadow }}>
      {review.image_url && (
        <div style={{ position: 'relative', height: 140, backgroundColor: P.card2 }}>
          <Image src={review.image_url} alt={review.product_name} fill style={{ objectFit: 'cover' }} />
        </div>
      )}
      <div style={{ padding: '18px 18px 16px' }}>
        {/* Score */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: 44, fontWeight: 900, lineHeight: 1, color: scoreColor, letterSpacing: '-2px' }}>
            {score}
          </span>
          <span style={{ fontSize: 12, color: P.faint, fontWeight: 700, paddingBottom: 5, letterSpacing: '0.04em' }}>
            /10
          </span>
        </div>

        {/* Score bar */}
        <div style={{ height: 3, backgroundColor: P.border, borderRadius: 99, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(scoreNum / 10) * 100}%`, backgroundColor: scoreColor, borderRadius: 99 }} />
        </div>

        <div style={{ fontSize: 14, fontWeight: 800, color: P.dark, lineHeight: 1.3, marginBottom: 5 }}>
          {review.product_name}
        </div>
        <div style={{ fontSize: 11, color: P.muted, fontWeight: 600 }}>
          {cat?.label ?? review.category}
        </div>
      </div>
    </Link>
  )
}

function LightVaultCard({ col }: { col: Collection }) {
  const TYPE_META: Record<string, { label: string; href: string }> = {
    comparison: { label: 'Comparison', href: '/comparisons' },
    best_of:    { label: 'Best Of',    href: '/picks' },
    general:    { label: 'Pick List',  href: '/picks' },
    stack:      { label: 'Stack',      href: '/stacks' },
    gift_guide: { label: 'Gift Guide', href: '/gifts' },
  }
  const meta = TYPE_META[col.collection_type] ?? { label: 'Collection', href: '/vault' }
  const href = `${meta.href}/${col.slug}`

  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block', backgroundColor: P.card, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: P.cardShadow }}>
      {col.hero_image_url && (
        <div style={{ position: 'relative', height: 140, backgroundColor: P.card2 }}>
          <Image src={col.hero_image_url} alt={col.title} fill style={{ objectFit: 'cover' }} />
        </div>
      )}
      <div style={{ padding: '16px 18px 20px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: P.orange, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8 }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: P.dark, lineHeight: 1.3, marginBottom: 8 }}>
          {col.title}
        </div>
        {col.description && (
          <p style={{ fontSize: 12, color: P.muted, lineHeight: 1.6, margin: 0 }}>
            {col.description.length > 90 ? col.description.slice(0, 90).trimEnd() + '…' : col.description}
          </p>
        )}
      </div>
    </Link>
  )
}

function CategoryTag({ category }: { category: string }) {
  const cat = getCategoryBySlug(category)
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: P.muted, backgroundColor: P.card2, border: `1px solid ${P.border}`, borderRadius: 99, padding: '4px 12px', letterSpacing: '0.06em' }}>
      {cat?.label ?? category}
    </span>
  )
}

function StatusLabel({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    testing:     { label: 'Testing now',  color: '#16a34a' },
    queued:      { label: 'Up next',      color: '#2563eb' },
    considering: { label: 'Considering',  color: '#d97706' },
  }
  const cfg = config[status] ?? { label: status, color: P.muted }
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
      {cfg.label}
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    testing: '#16a34a', queued: '#2563eb', considering: '#d97706',
  }
  return (
    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors[status] ?? P.faint }} />
  )
}

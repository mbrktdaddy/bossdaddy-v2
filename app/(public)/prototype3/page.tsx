/**
 * PROTOTYPE 3 — "The Field Manual" — synthesis
 *
 * Takes the best from both:
 *
 *   FROM P1 (dark):
 *     — Dark, dramatic character overall
 *     — Gold score as the visual anchor of every card (#f4af00)
 *     — Hotter orange (#ff5400) for CTAs
 *     — Editorial masthead strip with issue + date
 *     — Featured review + bench as co-equal hero (side by side)
 *
 *   FROM P2 (light):
 *     — Dark masthead that anchors the very top
 *     — Orange trust banner (credibility claim above the fold)
 *     — Image-on-top card structure (product image leads, score below)
 *     — Subtle card shadows (depth in the dark = warm amber glow)
 *     — Score progress bars
 *     — Trust stats band (zero sponsored, real data)
 *     — Warm bench status colors (green/blue/amber vs flat)
 *     — Warm off-white text (#ede8df vs cold white)
 *
 *   NEW in P3:
 *     — Warmer dark base (#080806) — less cold/blue-shifted than P1
 *     — Card glow-shadow instead of flat border (amber warmth)
 *     — Orange left-accent rule on section headers
 *     — Latest content strip (2 reviews + 2 guides as a magazine row)
 *     — Tighter visual hierarchy: masthead → banner → hero → scores
 *       → stats → vault → latest → close
 *
 * Color system:
 *   Body      #080806  — near-black, very slight warm tint
 *   Card      #121210  — warm dark surface
 *   Elevated  #1c1c19  — raised / hover
 *   Border    #272724  — warm divider
 *   Text      #ede8df  — warm off-white (from P2)
 *   Muted     #88847e  — warm muted
 *   Faint     #3a3835  — ghost elements
 *   Orange    #ff5400  — hotter orange (from P1)
 *   Gold      #f4af00  — rating anchor (from P1)
 *   Green     #22c55e  — testing status
 *   Blue      #60a5fa  — queued status
 *   Amber     #f59e0b  — considering status
 */

import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCategoryBySlug } from '@/lib/categories'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Prototype 3 — Boss Daddy Life',
  robots: { index: false, follow: false },
}

// ─── palette ──────────────────────────────────────────────────────────────────
const P = {
  body:     '#080806',
  card:     '#121210',
  elevated: '#1c1c19',
  border:   '#272724',
  text:     '#ede8df',
  muted:    '#88847e',
  faint:    '#3a3835',
  orange:   '#ff5400',
  gold:     '#f4af00',
  green:    '#22c55e',
  blue:     '#60a5fa',
  amber:    '#f59e0b',
  glow:     'rgba(244,175,0,0.07)',  // card shadow tint
} as const

const W = 1160

// ─── data types ───────────────────────────────────────────────────────────────
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
export default async function Prototype3Page() {
  const admin = createAdminClient()

  const [
    { data: reviewsRaw },
    { data: heroReview },
    { data: latestRaw },
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
    admin.from('reviews').select('id,slug,title,product_name,category,rating,excerpt,image_url,published_at')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false }).limit(4),
    admin.from('wishlist_items').select('id,slug,title,status,image_url')
      .in('status', ['testing', 'queued', 'considering'])
      .order('priority', { ascending: false }).limit(5),
    admin.from('collections').select('slug,title,description,hero_image_url,collection_type')
      .eq('is_visible', true).order('published_at', { ascending: false, nullsFirst: false }).limit(9),
    admin.from('reviews').select('*', { count: 'exact', head: true })
      .eq('status', 'approved').eq('is_visible', true),
  ])

  const reviews: Review[]   = (reviewsRaw ?? []) as Review[]
  const bench: BenchItem[]  = (benchRaw ?? []) as BenchItem[]
  const latest: Review[]    = (latestRaw ?? []) as Review[]
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
  const issueNum = Math.floor((now - new Date('2024-01-01').getTime()) / (7 * 86_400_000))

  return (
    <div style={{ backgroundColor: P.body, color: P.text, minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }}>

      {/* ── DARK MASTHEAD ─────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#0d0d0b', borderBottom: `1px solid ${P.border}` }}>
        <div style={{ maxWidth: W, margin: '0 auto', padding: '0 24px', height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Brand + issue */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: '-0.3px', color: P.text }}>
              Boss<span style={{ color: P.orange }}>Daddy</span>Life
            </span>
            <span style={{ color: P.faint, fontSize: 14 }}>·</span>
            <span style={{ fontSize: 10, color: P.muted, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Issue {issueNum}
            </span>
            <span style={{ color: P.faint, fontSize: 14 }}>·</span>
            <span style={{ fontSize: 10, color: P.muted }}>{today}</span>
          </div>
          {/* Nav */}
          <nav style={{ display: 'flex', gap: 28 }}>
            {[['Reviews', '/reviews'], ['Guides', '/guides'], ['Gear', '/gear'], ['The Bench', '/bench'], ['The Vault', '/vault']].map(([label, href]) => (
              <Link key={href} href={href} style={{ fontSize: 12, fontWeight: 600, color: P.muted, textDecoration: 'none', letterSpacing: '0.04em' }}>
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {/* ── TRUST BANNER ──────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: P.orange }}>
        <div style={{ maxWidth: W, margin: '0 auto', padding: '9px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#ffffff', letterSpacing: '0.03em' }}>
            {reviewCount ?? 0} field-tested reviews — bought with my own money, no PR samples, no sponsored verdict
          </p>
          <Link href="/about" style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textDecoration: 'none', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Who is Boss Daddy? →
          </Link>
        </div>
      </div>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${P.border}` }}>
        <div style={{ maxWidth: W, margin: '0 auto', padding: '52px 24px 48px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 0, alignItems: 'stretch' }}>

          {/* Left: featured review */}
          {featured ? (
            <div style={{ paddingRight: 48, borderRight: `1px solid ${P.border}` }}>
              <Eyebrow label="Featured Review" />

              {/* Score + name */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 28 }}>
                <div style={{ flexShrink: 0, textAlign: 'center', backgroundColor: P.elevated, borderRadius: 12, padding: '14px 20px', border: `1px solid ${P.border}` }}>
                  <div style={{ fontSize: 64, fontWeight: 900, lineHeight: 1, color: P.gold, letterSpacing: '-3px' }}>
                    {featured.rating?.toFixed(1) ?? '—'}
                  </div>
                  <div style={{ fontSize: 10, color: P.muted, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
                    out of 10
                  </div>
                </div>
                <div style={{ paddingTop: 6, flex: 1 }}>
                  <h1 style={{ fontSize: 30, fontWeight: 900, color: P.text, lineHeight: 1.15, letterSpacing: '-0.6px', margin: '0 0 10px 0' }}>
                    {featured.product_name}
                  </h1>
                  <CatChip category={featured.category} />
                </div>
              </div>

              {featured.image_url && (
                <div style={{ position: 'relative', width: '100%', height: 260, borderRadius: 14, overflow: 'hidden', marginBottom: 24, boxShadow: `0 8px 40px ${P.glow}, 0 2px 12px rgba(0,0,0,0.4)` }}>
                  <Image src={featured.image_url} alt={featured.product_name} fill style={{ objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${P.body}bb, transparent 55%)` }} />
                </div>
              )}

              {featured.excerpt && (
                <p style={{ fontSize: 15, color: P.muted, lineHeight: 1.7, marginBottom: 28, maxWidth: 520 }}>
                  {featured.excerpt.length > 180 ? featured.excerpt.slice(0, 180).trimEnd() + '…' : featured.excerpt}
                </p>
              )}

              <Link href={`/reviews/${featured.slug}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: P.orange, color: '#ffffff', fontWeight: 800, fontSize: 14, padding: '13px 26px', borderRadius: 10, textDecoration: 'none', letterSpacing: '0.01em' }}>
                Read the Full Verdict
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
            </div>
          ) : (
            <div style={{ paddingRight: 48 }}><p style={{ color: P.muted }}>No featured review set.</p></div>
          )}

          {/* Right: bench */}
          <div style={{ paddingLeft: 36, display: 'flex', flexDirection: 'column' }}>
            <Eyebrow label="On the Bench" />

            {bench.length === 0 ? (
              <p style={{ color: P.muted, fontSize: 13 }}>Nothing in testing right now.</p>
            ) : bench.map((item, i) => (
              <Link key={item.id} href={`/bench/${item.slug}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: i < bench.length - 1 ? `1px solid ${P.border}` : 'none' }}>
                {item.image_url ? (
                  <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 8, overflow: 'hidden', backgroundColor: P.elevated }}>
                    <Image src={item.image_url} alt={item.title} width={44} height={44} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                  </div>
                ) : (
                  <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 8, backgroundColor: P.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BenchDot status={item.status} />
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: P.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                  <BenchPill status={item.status} />
                </div>
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={P.faint} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </Link>
            ))}

            <Link href="/bench" style={{ marginTop: 'auto', paddingTop: 20, fontSize: 11, fontWeight: 700, color: P.orange, textDecoration: 'none', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              Full Bench →
            </Link>
          </div>
        </div>
      </div>

      {/* ── THE SCORES ────────────────────────────────────────────────────── */}
      {scoreCards.length > 0 && (
        <div style={{ borderBottom: `1px solid ${P.border}` }}>
          <div style={{ maxWidth: W, margin: '0 auto', padding: '52px 24px' }}>
            <SecHeader label="The Scores" right={
              <Link href="/reviews" style={{ fontSize: 11, fontWeight: 700, color: P.orange, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                All {reviewCount} reviews →
              </Link>
            } />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {scoreCards.map(r => <ScoreCard key={r.id} review={r} />)}
            </div>
          </div>
        </div>
      )}

      {/* ── TRUST STATS BAND ──────────────────────────────────────────────── */}
      <div style={{ backgroundColor: '#0c0c0a', borderBottom: `1px solid ${P.border}`, borderTop: `1px solid ${P.border}` }}>
        <div style={{ maxWidth: W, margin: '0 auto', padding: '40px 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {[
            { num: (reviewCount ?? 0).toString(), label: 'Field-tested reviews', sub: 'Every one bought out of pocket' },
            { num: '0',     label: 'Sponsored verdicts',  sub: 'Ever. Non-negotiable.' },
            { num: '100%',  label: 'Real-world testing',  sub: 'Weekends. Road trips. 3am feeds.' },
          ].map((stat, i) => (
            <div key={i} style={{ padding: '0 36px', borderLeft: i > 0 ? `1px solid ${P.border}` : 'none', textAlign: 'center' }}>
              <div style={{ fontSize: 44, fontWeight: 900, color: P.gold, letterSpacing: '-2px', lineHeight: 1 }}>
                {stat.num}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: P.text, marginTop: 10, letterSpacing: '-0.2px' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: 11, color: P.muted, marginTop: 5, lineHeight: 1.5 }}>
                {stat.sub}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FROM THE VAULT ────────────────────────────────────────────────── */}
      {vaultItems.length > 0 && (
        <div style={{ borderBottom: `1px solid ${P.border}` }}>
          <div style={{ maxWidth: W, margin: '0 auto', padding: '52px 24px' }}>
            <SecHeader label="From the Vault" right={
              <Link href="/vault" style={{ fontSize: 11, fontWeight: 700, color: P.orange, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Browse all →
              </Link>
            } />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {vaultItems.map(col => <VaultCard key={col.slug} col={col} />)}
            </div>
          </div>
        </div>
      )}

      {/* ── LATEST ────────────────────────────────────────────────────────── */}
      {latest.length > 0 && (
        <div style={{ borderBottom: `1px solid ${P.border}` }}>
          <div style={{ maxWidth: W, margin: '0 auto', padding: '52px 24px' }}>
            <SecHeader label="Just Dropped" right={
              <Link href="/reviews" style={{ fontSize: 11, fontWeight: 700, color: P.orange, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                More reviews →
              </Link>
            } />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {latest.map(r => <LatestCard key={r.id} review={r} />)}
            </div>
          </div>
        </div>
      )}

      {/* ── CLOSING ───────────────────────────────────────────────────────── */}
      <div style={{ backgroundColor: P.body }}>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', width: 32, height: 3, backgroundColor: P.orange, marginBottom: 28 }} />
          <h2 style={{ fontSize: 36, fontWeight: 900, color: P.text, lineHeight: 1.2, letterSpacing: '-1px', margin: '0 0 20px 0' }}>
            I buy it. I test it. I tell you the truth.
          </h2>
          <p style={{ fontSize: 16, color: P.muted, lineHeight: 1.75, marginBottom: 40 }}>
            No PR samples. No affiliate pressure on the verdict. Every product here came out of my own pocket and got real use — weekends, road trips, garage projects, 3am with a screaming baby. You&apos;re not reading sponsored content dressed as a review. You&apos;re reading what actually happened.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/reviews" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: P.orange, color: '#ffffff', fontWeight: 800, fontSize: 14, padding: '14px 28px', borderRadius: 10, textDecoration: 'none' }}>
              Browse All Reviews
            </Link>
            <Link href="/about" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${P.border}`, color: P.muted, fontWeight: 700, fontSize: 14, padding: '13px 28px', borderRadius: 10, textDecoration: 'none' }}>
              Who Is Boss Daddy?
            </Link>
          </div>
        </div>
      </div>

      {/* ── PROTOTYPE BADGE ───────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 16, right: 16, background: 'linear-gradient(135deg, #ff5400, #d44000)', color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 6, pointerEvents: 'none', zIndex: 9999, boxShadow: '0 2px 12px rgba(255,84,0,0.4)' }}>
        Prototype 3
      </div>

    </div>
  )
}

// ─── shared helpers ────────────────────────────────────────────────────────────

function Eyebrow({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
      <span style={{ display: 'inline-block', width: 20, height: 2, backgroundColor: P.orange, flexShrink: 0 }} />
      <span style={{ fontSize: 10, fontWeight: 800, color: P.orange, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
        {label}
      </span>
    </div>
  )
}

function SecHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 16, borderBottom: `1px solid ${P.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ display: 'inline-block', width: 3, height: 18, backgroundColor: P.orange, borderRadius: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.18em', color: P.muted }}>
          {label}
        </span>
      </div>
      {right}
    </div>
  )
}

function CatChip({ category }: { category: string }) {
  const cat = getCategoryBySlug(category)
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: P.muted, backgroundColor: P.elevated, border: `1px solid ${P.border}`, borderRadius: 99, padding: '4px 12px', letterSpacing: '0.06em' }}>
      {cat?.label ?? category}
    </span>
  )
}

function BenchPill({ status }: { status: string }) {
  const cfg: Record<string, { label: string; color: string }> = {
    testing:     { label: 'Testing now', color: P.green },
    queued:      { label: 'Up next',     color: P.blue },
    considering: { label: 'Considering', color: P.amber },
  }
  const c = cfg[status] ?? { label: status, color: P.muted }
  return <span style={{ fontSize: 10, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 3, display: 'block' }}>{c.label}</span>
}

function BenchDot({ status }: { status: string }) {
  const colors: Record<string, string> = { testing: P.green, queued: P.blue, considering: P.amber }
  return <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors[status] ?? P.muted }} />
}

function ScoreCard({ review }: { review: Review }) {
  const cat = getCategoryBySlug(review.category)
  const score = review.rating?.toFixed(1) ?? '—'
  const scoreNum = review.rating ?? 0
  const scoreColor = scoreNum >= 9 ? P.gold : scoreNum >= 8 ? P.orange : P.muted

  return (
    <Link href={`/reviews/${review.slug}`} style={{ textDecoration: 'none', display: 'block', backgroundColor: P.card, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: `0 4px 24px ${P.glow}` }}>
      {review.image_url && (
        <div style={{ position: 'relative', height: 130, backgroundColor: P.elevated }}>
          <Image src={review.image_url} alt={review.product_name} fill style={{ objectFit: 'cover', opacity: 0.8 }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${P.card}dd, transparent 40%)` }} />
        </div>
      )}
      <div style={{ padding: '18px 18px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 10 }}>
          <span style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, color: scoreColor, letterSpacing: '-2px' }}>
            {score}
          </span>
          <span style={{ fontSize: 12, color: P.faint, fontWeight: 700, paddingBottom: 6, letterSpacing: '0.04em' }}>
            /10
          </span>
        </div>
        {/* Score bar */}
        <div style={{ height: 3, backgroundColor: P.faint, borderRadius: 99, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(scoreNum / 10) * 100}%`, backgroundColor: scoreColor, borderRadius: 99 }} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, color: P.text, lineHeight: 1.3, marginBottom: 5 }}>
          {review.product_name}
        </div>
        <div style={{ fontSize: 11, color: P.muted, fontWeight: 600 }}>
          {cat?.label ?? review.category}
        </div>
      </div>
    </Link>
  )
}

function VaultCard({ col }: { col: Collection }) {
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
    <Link href={href} style={{ textDecoration: 'none', display: 'block', backgroundColor: P.card, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: `0 4px 24px ${P.glow}` }}>
      {col.hero_image_url && (
        <div style={{ position: 'relative', height: 130, backgroundColor: P.elevated }}>
          <Image src={col.hero_image_url} alt={col.title} fill style={{ objectFit: 'cover', opacity: 0.7 }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${P.card}cc, transparent 50%)` }} />
        </div>
      )}
      <div style={{ padding: '16px 18px 20px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: P.orange, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8 }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: P.text, lineHeight: 1.3, marginBottom: 8 }}>
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

function LatestCard({ review }: { review: Review }) {
  const cat = getCategoryBySlug(review.category)
  const scoreNum = review.rating ?? 0
  const scoreColor = scoreNum >= 9 ? P.gold : scoreNum >= 8 ? P.orange : P.muted
  const published = review.published_at
    ? new Date(review.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : null

  return (
    <Link href={`/reviews/${review.slug}`} style={{ textDecoration: 'none', display: 'block', backgroundColor: P.card, border: `1px solid ${P.border}`, borderRadius: 14, overflow: 'hidden', boxShadow: `0 4px 24px ${P.glow}` }}>
      {review.image_url && (
        <div style={{ position: 'relative', height: 110, backgroundColor: P.elevated }}>
          <Image src={review.image_url} alt={review.product_name} fill style={{ objectFit: 'cover', opacity: 0.75 }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${P.card}dd, transparent 50%)` }} />
          {review.rating && (
            <div style={{ position: 'absolute', top: 10, right: 10, backgroundColor: `${P.body}cc`, backdropFilter: 'blur(4px)', border: `1px solid ${P.border}`, borderRadius: 8, padding: '4px 8px', fontSize: 14, fontWeight: 900, color: scoreColor, letterSpacing: '-0.5px' }}>
              {review.rating.toFixed(1)}
            </div>
          )}
        </div>
      )}
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: P.muted, fontWeight: 600 }}>{cat?.label ?? review.category}</span>
          {published && <><span style={{ color: P.faint, fontSize: 10 }}>·</span><span style={{ fontSize: 10, color: P.faint }}>{published}</span></>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: P.text, lineHeight: 1.3 }}>
          {review.product_name}
        </div>
      </div>
    </Link>
  )
}

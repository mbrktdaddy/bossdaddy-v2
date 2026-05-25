/**
 * PROTOTYPE — "The Briefing" concept
 *
 * Creative direction: Boss Daddy as a high-confidence field report from a
 * trusted advisor. The score is the point. Everything else earns its place.
 *
 * Color system (independent of the main design system):
 *   Body      #070709  — near-black, slight blue shift
 *   Card      #0d0e1a  — navy-dark surface
 *   Elevated  #13152a  — hover / raised
 *   Text      #ede8df  — warm off-white (aged paper, not cold)
 *   Muted     #8a8680  — secondary text
 *   Faint     #3d3c40  — dividers, ghost elements
 *   Orange    #ff5400  — pushed hotter for energy
 *   Gold      #f4af00  — rating/score — its own signal, not orange
 *   Navy hi   #2a3060  — subtle tint for "active" states
 */

import Link from 'next/link'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCategoryBySlug } from '@/lib/categories'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Prototype — Boss Daddy Life',
  robots: { index: false, follow: false },
}

// ─── palette ────────────────────────────────────────────────────────────────
const P = {
  body:     '#070709',
  card:     '#0d0e1a',
  elevated: '#13152a',
  border:   '#1c1e30',
  text:     '#ede8df',
  muted:    '#8a8680',
  faint:    '#3d3c40',
  orange:   '#ff5400',
  gold:     '#f4af00',
  green:    '#22c55e',
} as const

// ─── tiny styled helpers (inline only — no Tailwind — keeps prototype isolated)
const s = {
  page: {
    backgroundColor: P.body,
    color: P.text,
    minHeight: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  } as React.CSSProperties,

  section: (paddingY = 64) => ({
    maxWidth: 1160,
    margin: '0 auto',
    padding: `${paddingY}px 24px`,
  } as React.CSSProperties),

  eyebrow: {
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.22em',
    color: P.orange,
  } as React.CSSProperties,

  rule: {
    display: 'inline-block',
    width: 24,
    height: 2,
    backgroundColor: P.orange,
    verticalAlign: 'middle',
    marginRight: 10,
  } as React.CSSProperties,

  sectionTitle: {
    fontSize: 13,
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.18em',
    color: P.muted,
    marginBottom: 32,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  } as React.CSSProperties,

  card: {
    backgroundColor: P.card,
    border: `1px solid ${P.border}`,
    borderRadius: 14,
    overflow: 'hidden',
    transition: 'border-color 0.15s',
  } as React.CSSProperties,
} as const

// ─── data types ─────────────────────────────────────────────────────────────
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

// ─── page ────────────────────────────────────────────────────────────────────
export default async function PrototypePage() {
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

  // Featured = spotlighted review, or if none, the highest-rated
  const featured: Review | null = (heroReview as Review | null) ?? reviews[0] ?? null
  // Score cards = top 6 excluding the featured one
  const scoreCards = reviews.filter(r => r.id !== featured?.id).slice(0, 6)

  // Collections: one of each flavor
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
    <div style={s.page}>

      {/* ── MASTHEAD ──────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${P.border}`, backgroundColor: P.body }}>
        <div style={{ maxWidth: 1160, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.22em', textTransform: 'uppercase', color: P.text }}>
              Boss<span style={{ color: P.orange }}> Daddy</span> Life
            </span>
            <span style={{ color: P.faint, fontSize: 11 }}>·</span>
            <span style={{ fontSize: 10, color: P.muted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Issue {issueNum}
            </span>
            <span style={{ color: P.faint, fontSize: 11 }}>·</span>
            <span style={{ fontSize: 10, color: P.muted }}>{today}</span>
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {[['Reviews', '/reviews'], ['Guides', '/guides'], ['Gear', '/gear'], ['The Bench', '/bench']].map(([label, href]) => (
              <Link key={href} href={href} style={{ fontSize: 11, fontWeight: 600, color: P.muted, textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <div style={{ borderBottom: `1px solid ${P.border}` }}>
        <div style={{ ...s.section(48), display: 'grid', gridTemplateColumns: '1fr 360px', gap: 2, alignItems: 'stretch' }}>

          {/* Left: featured review */}
          {featured ? (
            <Link href={`/reviews/${featured.slug}`} style={{ textDecoration: 'none', display: 'block', paddingRight: 48 }}>
              <div style={{ ...s.eyebrow, marginBottom: 20 }}>
                <span style={s.rule} />
                Featured Review
              </div>

              {/* Score + product */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 24 }}>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 80, fontWeight: 900, lineHeight: 1, color: P.gold, letterSpacing: '-4px' }}>
                    {featured.rating?.toFixed(1) ?? '—'}
                  </div>
                  <div style={{ fontSize: 11, color: P.muted, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 4 }}>
                    out of 10
                  </div>
                </div>
                <div style={{ paddingTop: 8 }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: P.text, lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 10 }}>
                    {featured.product_name}
                  </div>
                  <CategoryChip category={featured.category} />
                </div>
              </div>

              {featured.image_url && (
                <div style={{ position: 'relative', width: '100%', height: 280, borderRadius: 12, overflow: 'hidden', marginBottom: 24, backgroundColor: P.card }}>
                  <Image src={featured.image_url} alt={featured.product_name} fill style={{ objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${P.body}99, transparent 60%)` }} />
                </div>
              )}

              {featured.excerpt && (
                <p style={{ fontSize: 16, color: P.muted, lineHeight: 1.65, marginBottom: 24, maxWidth: 540 }}>
                  {featured.excerpt.length > 180 ? featured.excerpt.slice(0, 180).trimEnd() + '…' : featured.excerpt}
                </p>
              )}

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: P.orange, color: '#fff', fontWeight: 800, fontSize: 13, padding: '12px 24px', borderRadius: 8, letterSpacing: '0.04em' }}>
                Read the Full Verdict
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </div>
            </Link>
          ) : (
            <div style={{ paddingRight: 48 }}>
              <p style={{ color: P.muted }}>No featured review set.</p>
            </div>
          )}

          {/* Right: bench status panel */}
          <div style={{ borderLeft: `1px solid ${P.border}`, paddingLeft: 32, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ ...s.eyebrow, marginBottom: 20 }}>
              <span style={s.rule} />
              On the Bench
            </div>

            {bench.length === 0 ? (
              <p style={{ color: P.muted, fontSize: 13 }}>Nothing in testing right now.</p>
            ) : (
              bench.map((item, i) => (
                <Link key={item.id} href={`/bench/${item.slug}`} style={{ textDecoration: 'none', display: 'block', padding: '14px 0', borderBottom: i < bench.length - 1 ? `1px solid ${P.border}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {item.image_url ? (
                      <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: P.elevated }}>
                        <Image src={item.image_url} alt={item.title} width={40} height={40} style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
                      </div>
                    ) : (
                      <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 8, backgroundColor: P.elevated, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <BenchStatusDot status={item.status} />
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: P.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.title}
                      </div>
                      <div style={{ marginTop: 3 }}>
                        <BenchStatusPill status={item.status} />
                      </div>
                    </div>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke={P.faint} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </Link>
              ))
            )}

            <Link href="/bench" style={{ marginTop: 20, fontSize: 11, fontWeight: 700, color: P.orange, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              Full Bench →
            </Link>
          </div>
        </div>
      </div>

      {/* ── THE SCORES ────────────────────────────────────────────────────── */}
      {scoreCards.length > 0 && (
        <div style={{ borderBottom: `1px solid ${P.border}` }}>
          <div style={s.section(56)}>
            <div style={s.sectionTitle}>
              <span style={{ display: 'inline-block', width: 20, height: 2, backgroundColor: P.orange }} />
              The Scores
              <span style={{ marginLeft: 'auto', fontSize: 11, color: P.muted, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'none' }}>
                {reviewCount} reviews total
              </span>
              <Link href="/reviews" style={{ fontSize: 11, fontWeight: 700, color: P.orange, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                All reviews →
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {scoreCards.map((r) => (
                <ScoreCard key={r.id} review={r} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── FROM THE VAULT ────────────────────────────────────────────────── */}
      {vaultItems.length > 0 && (
        <div style={{ borderBottom: `1px solid ${P.border}` }}>
          <div style={s.section(56)}>
            <div style={s.sectionTitle}>
              <span style={{ display: 'inline-block', width: 20, height: 2, backgroundColor: P.orange }} />
              From the Vault
              <Link href="/vault" style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: P.orange, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Browse all →
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {vaultItems.map((col) => (
                <VaultCard key={col.slug} col={col} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── CLOSING STATEMENT ─────────────────────────────────────────────── */}
      <div style={s.section(80)}>
        <div style={{ maxWidth: 680, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ ...s.eyebrow, display: 'block', marginBottom: 24 }}>The Standard</div>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: P.text, lineHeight: 1.2, letterSpacing: '-1px', marginBottom: 20 }}>
            I buy it. I test it. I tell you the truth.
          </h2>
          <p style={{ fontSize: 16, color: P.muted, lineHeight: 1.7, marginBottom: 40 }}>
            No PR samples. No affiliate pressure shaping verdicts. Every product on this site came out of my own pocket and got used on weekends, during family trips, in the garage, and at 3am with a screaming baby. If it made the cut, it earned it.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/reviews" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, backgroundColor: P.orange, color: '#fff', fontWeight: 800, fontSize: 14, padding: '14px 28px', borderRadius: 10, textDecoration: 'none', letterSpacing: '0.02em' }}>
              Browse All Reviews
            </Link>
            <Link href="/about" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: `1px solid ${P.border}`, color: P.muted, fontWeight: 700, fontSize: 14, padding: '14px 28px', borderRadius: 10, textDecoration: 'none', letterSpacing: '0.02em' }}>
              Who is Boss Daddy?
            </Link>
          </div>
        </div>
      </div>

      {/* ── PROTOTYPE BADGE ───────────────────────────────────────────────── */}
      <div style={{ position: 'fixed', bottom: 16, right: 16, backgroundColor: P.orange, color: '#fff', fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '6px 12px', borderRadius: 6, pointerEvents: 'none', zIndex: 9999 }}>
        Prototype
      </div>

    </div>
  )
}

// ─── sub-components ──────────────────────────────────────────────────────────

function ScoreCard({ review }: { review: Review }) {
  const cat = getCategoryBySlug(review.category)
  const score = review.rating?.toFixed(1) ?? '—'
  const scoreNum = review.rating ?? 0

  // Color grade: 9+ gold, 8+ orange, rest muted
  const scoreColor = scoreNum >= 9 ? P.gold : scoreNum >= 8 ? P.orange : P.muted

  return (
    <Link href={`/reviews/${review.slug}`} style={{ textDecoration: 'none', display: 'block', ...s.card }}>
      <div style={{ padding: '20px 20px 16px 20px' }}>
        {/* Score line */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 14 }}>
          <span style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, color: scoreColor, letterSpacing: '-2px' }}>
            {score}
          </span>
          <span style={{ fontSize: 12, color: P.muted, fontWeight: 700, paddingBottom: 6, letterSpacing: '0.06em' }}>
            /10
          </span>
        </div>

        {/* Score bar */}
        <div style={{ height: 3, backgroundColor: P.faint, borderRadius: 99, marginBottom: 14, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(scoreNum / 10) * 100}%`, backgroundColor: scoreColor, borderRadius: 99, transition: 'width 0.3s' }} />
        </div>

        <div style={{ fontSize: 14, fontWeight: 800, color: P.text, lineHeight: 1.3, marginBottom: 6 }}>
          {review.product_name}
        </div>
        <div style={{ fontSize: 11, color: P.muted }}>
          {cat?.label ?? review.category}
        </div>
      </div>

      {review.image_url && (
        <div style={{ position: 'relative', height: 120, backgroundColor: P.elevated }}>
          <Image src={review.image_url} alt={review.product_name} fill style={{ objectFit: 'cover', opacity: 0.75 }} />
        </div>
      )}
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
    <Link href={href} style={{ textDecoration: 'none', display: 'block', ...s.card }}>
      {col.hero_image_url && (
        <div style={{ position: 'relative', height: 140, backgroundColor: P.elevated }}>
          <Image src={col.hero_image_url} alt={col.title} fill style={{ objectFit: 'cover', opacity: 0.7 }} />
          <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to top, ${P.card}e0, transparent 50%)` }} />
        </div>
      )}
      <div style={{ padding: '16px 18px 18px' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: P.orange, textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 8 }}>
          {meta.label}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, color: P.text, lineHeight: 1.3, marginBottom: 8 }}>
          {col.title}
        </div>
        {col.description && (
          <p style={{ fontSize: 12, color: P.muted, lineHeight: 1.55, margin: 0 }}>
            {col.description.length > 90 ? col.description.slice(0, 90).trimEnd() + '…' : col.description}
          </p>
        )}
      </div>
    </Link>
  )
}

function CategoryChip({ category }: { category: string }) {
  const cat = getCategoryBySlug(category)
  return (
    <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: P.muted, backgroundColor: P.elevated, border: `1px solid ${P.border}`, borderRadius: 99, padding: '4px 10px', letterSpacing: '0.06em' }}>
      {cat?.label ?? category}
    </span>
  )
}

function BenchStatusPill({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string }> = {
    testing:     { label: 'Testing now',  color: '#22c55e' },
    queued:      { label: 'Up next',      color: '#60a5fa' },
    considering: { label: 'Considering',  color: '#f4af00' },
  }
  const cfg = config[status] ?? { label: status, color: P.muted }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
      {cfg.label}
    </span>
  )
}

function BenchStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    testing: '#22c55e', queued: '#60a5fa', considering: '#f4af00',
  }
  return (
    <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors[status] ?? P.muted }} />
  )
}

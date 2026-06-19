import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { LABELS } from '@/lib/labels'

// Brand doctrine: no emoji on web surfaces — inline SVGs match the rest of
// the site (CategoryIcon set, ticker dot in BenchStrip, etc.). Outlined
// stroke 1.5 currentColor at w-3.5 h-3.5 sizing.
type IconKind = 'testing' | 'queued' | 'considering' | 'reviewed'

function StatusIcon({ kind, className }: { kind: IconKind; className?: string }) {
  const cls = className ?? 'w-3.5 h-3.5 shrink-0'
  if (kind === 'testing') {
    // Beaker — active testing, the most committed signal
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    )
  }
  if (kind === 'queued') {
    // Clock — coming up, time-shifted into the future
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  }
  if (kind === 'considering') {
    // Question — decision pending
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
      </svg>
    )
  }
  // reviewed — check-in-circle, the lifecycle close signal
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

const STATUS_META: Record<string, { label: string; kind: IconKind }> = {
  testing:     { label: 'Testing',       kind: 'testing' },
  queued:      { label: 'Up next',       kind: 'queued' },
  considering: { label: 'Considering',   kind: 'considering' },
  reviewed:    { label: 'Just reviewed', kind: 'reviewed' },
}

// Internal status rank so the ticker leads with "testing now" (most active
// signal) over "considering" (least committed).
const STATUS_RANK: Record<string, number> = { testing: 0, queued: 1, considering: 2 }

/**
 * Slim editorial band at the top of the homepage signaling "this site is
 * alive — these are the products in motion." Auto-fed from the wishlist /
 * Bench data so there's nothing to maintain. Renders nothing when no items
 * are in motion — no empty stripe.
 */
// Ticker items are a discriminated union — bench items link to /bench/[slug]
// and review items link to /reviews/[slug]. The 'reviewed' kind closes the
// lifecycle loop visually: "what's being tested · what just landed."
type TickerItem =
  | { kind: 'wishlist'; id: string; slug: string; title: string; status: string }
  | { kind: 'review';   id: string; slug: string; title: string; status: 'reviewed' }

export default async function InMotionTicker() {
  const admin = createAdminClient()
  // Fetch the in-progress (wishlist) + just-landed (reviews) buckets in
  // parallel. "Just reviewed" is the lifecycle close — last 14 days, top 2.
  // Date.now is intentional here: this is an async Server Component that
  // re-runs per request, so a fresh "14 days ago" window is what we want.
  // The react-hooks/purity rule fires on Date.now in any component body,
  // but the rule is meant for client renders where re-renders should be
  // stable — not relevant in a per-request server render.
  // eslint-disable-next-line react-hooks/purity
  const sinceIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const [{ data: benchData }, { data: reviewData }] = await Promise.all([
    admin
      .from('products')
      .select('id, slug, title:name, status')
      .in('status', ['testing', 'queued', 'considering'])
      .order('priority', { ascending: false })
      .limit(6),
    admin
      .from('reviews')
      .select('id, slug, title')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .gte('published_at', sinceIso)
      .order('published_at', { ascending: false })
      .limit(2),
  ])

  const benchItems: TickerItem[] = (benchData ?? [])
    .slice()
    .sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99))
    .map((b) => ({ kind: 'wishlist', id: b.id, slug: b.slug, title: b.title, status: b.status }))
  const reviewItems: TickerItem[] = (reviewData ?? []).map((r) => ({
    kind: 'review', id: r.id, slug: r.slug, title: r.title, status: 'reviewed',
  }))
  // Recent reviews land at the end of the band — intent (testing/queued) reads
  // first, output (just reviewed) reads last, mirroring time-flow.
  const items = [...benchItems, ...reviewItems]

  if (items.length === 0) return null

  return (
    <section
      aria-label="Currently in motion on Boss Daddy"
      className="relative bg-chrome border-b border-copper/40"
    >
      <div className="max-w-6xl mx-auto px-6 py-2">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide text-xs whitespace-nowrap">
          <span className="shrink-0 text-copper font-black uppercase tracking-[0.18em]">In Motion</span>
          <span aria-hidden className="shrink-0 text-prose-faint">·</span>
          {items.map((item, i) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.testing
            const href = item.kind === 'review' ? `/reviews/${item.slug}` : `/bench/${item.slug}`
            return (
              <span key={`${item.kind}:${item.id}`} className="shrink-0 inline-flex items-center gap-2">
                <Link
                  href={href}
                  className="inline-flex items-center gap-1.5 text-prose-muted hover:text-prose transition-colors"
                >
                  <StatusIcon kind={meta.kind} className="w-3.5 h-3.5 shrink-0 text-copper" />
                  <span className="text-copper/90 font-semibold tracking-wide">{meta.label}:</span>
                  <span className="font-medium">{item.title}</span>
                </Link>
                {i < items.length - 1 && (
                  <span aria-hidden className="text-prose-faint">·</span>
                )}
              </span>
            )
          })}
          <span aria-hidden className="shrink-0 text-prose-faint">·</span>
          <Link
            href="/bench"
            title={LABELS.bench.tagline}
            className="shrink-0 inline-flex items-center gap-1 text-copper hover:text-zinc-50 transition-colors font-semibold uppercase tracking-widest"
          >
            See the Bench — what&apos;s next →
          </Link>
        </div>
      </div>
    </section>
  )
}

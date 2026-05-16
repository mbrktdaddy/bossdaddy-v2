import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

const STATUS_META: Record<string, { label: string; icon: string }> = {
  testing:     { label: 'Testing',     icon: '🧪' },
  queued:      { label: 'Up next',     icon: '🔜' },
  considering: { label: 'Considering', icon: '🤔' },
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
export default async function InMotionTicker() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('wishlist_items')
    .select('id, slug, title, status')
    .in('status', ['testing', 'queued'])
    .order('priority', { ascending: false })
    .limit(8)

  const items = (data ?? [])
    .slice()
    .sort((a, b) => (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99))

  if (items.length === 0) return null

  return (
    <section
      aria-label="Currently in motion on Boss Daddy"
      className="relative bg-gradient-to-b from-orange-950/[0.18] to-orange-950/[0.08] border-b border-orange-900/30"
    >
      <div className="max-w-6xl mx-auto px-6 py-2">
        <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide text-xs whitespace-nowrap">
          <span className="shrink-0 text-orange-400 font-black uppercase tracking-[0.18em]">In Motion</span>
          <span aria-hidden className="shrink-0 text-orange-900/60">·</span>
          {items.map((item, i) => {
            const meta = STATUS_META[item.status] ?? STATUS_META.testing
            return (
              <span key={item.id} className="shrink-0 inline-flex items-center gap-2">
                <Link
                  href={`/bench/${item.slug}`}
                  className="inline-flex items-center gap-1.5 text-gray-300 hover:text-orange-300 transition-colors"
                >
                  <span aria-hidden className="text-[13px] leading-none">{meta.icon}</span>
                  <span className="text-orange-400/80 font-semibold tracking-wide">{meta.label}:</span>
                  <span className="font-medium">{item.title}</span>
                </Link>
                {i < items.length - 1 && (
                  <span aria-hidden className="text-orange-900/60">·</span>
                )}
              </span>
            )
          })}
          <span aria-hidden className="shrink-0 text-orange-900/60">·</span>
          <Link
            href="/bench"
            className="shrink-0 inline-flex items-center gap-1 text-orange-400 hover:text-orange-300 transition-colors font-semibold uppercase tracking-widest"
          >
            See the bench →
          </Link>
        </div>
      </div>
    </section>
  )
}

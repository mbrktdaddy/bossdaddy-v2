import { createAdminClient } from '@/lib/supabase/admin'
import type { WishlistItem } from '@/lib/wishlist'
import { groupByStatus } from '@/lib/wishlist'
import { WishlistCard } from '@/components/wishlist/WishlistCard'
import type { Metadata } from 'next'

export const revalidate = 300

export const metadata: Metadata = {
  title: "Boss Daddy's Wishlist — Vote on What I Test Next",
  description: "See what Boss Daddy is currently testing, what's coming next, and vote on what you want reviewed. Members get notified when it goes live.",
  alternates: { canonical: '/wishlist' },
}

export default async function WishlistPage() {
  const admin = createAdminClient()
  const { data } = await admin
    .from('wishlist_items')
    .select('*, vote_count:wishlist_votes(count)')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: false })

  const items = ((data ?? []) as (WishlistItem & { vote_count: { count: number }[] })[]).map((i) => ({
    ...i,
    vote_count: i.vote_count?.[0]?.count ?? 0,
  }))

  const groups = groupByStatus(items)

  const sections: { key: keyof typeof groups; heading: string; sub: string }[] = [
    { key: 'testing',     heading: '🧪 Testing Now',    sub: "Currently putting it through the paces." },
    { key: 'queued',      heading: '🔜 Coming Soon',     sub: "Confirmed in the pipeline." },
    { key: 'considering', heading: '🤔 Under Consideration', sub: "Vote to move your pick up the queue." },
    { key: 'reviewed',    heading: '✅ Already Reviewed', sub: "Verdict is in — read the full review." },
    { key: 'skipped',     heading: 'Not Testing',        sub: "Decided against these — here's why." },
  ]

  const hasContent = items.length > 0

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      {/* Header */}
      <div className="mb-10">
        <div className="inline-flex items-center gap-2 bg-orange-950/50 border border-orange-800/50 rounded-full px-4 py-1.5 text-xs text-orange-400 font-medium mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
          Live Testing Pipeline
        </div>
        <h1 className="text-3xl sm:text-4xl font-black mb-3">
          The Boss Daddy Wishlist
        </h1>
        <p className="text-[var(--bd-text-muted)] max-w-xl">
          Everything I&apos;m currently testing, planning to review, or decided to skip — with the reasons.
          Members can vote on what gets reviewed next.
        </p>
      </div>

      {!hasContent ? (
        <div className="bg-[var(--bd-surface)] border border-[var(--bd-border)] rounded-2xl p-12 text-center">
          <p className="text-[var(--bd-text-muted)]">The wishlist is being built out. Check back soon.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {sections.map(({ key, heading, sub }) => {
            const sectionItems = groups[key]
            if (sectionItems.length === 0) return null

            // Skipped section is a collapsible accordion
            if (key === 'skipped') {
              return (
                <details key={key} className="group">
                  <summary className="flex items-center gap-2 cursor-pointer list-none mb-4">
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-500">{heading}</span>
                    <span className="text-xs text-zinc-600">({sectionItems.length})</span>
                    <svg className="w-3 h-3 text-zinc-600 group-open:rotate-180 transition-transform ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="space-y-3">
                    {sectionItems.map((item) => (
                      <div key={item.id} className="p-4 bg-[var(--bd-surface)] border border-[var(--bd-border)] rounded-2xl">
                        <p className="text-sm font-semibold text-zinc-400">{item.title}</p>
                        {item.skip_reason && (
                          <p className="text-xs text-zinc-600 mt-1">{item.skip_reason}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )
            }

            return (
              <section key={key}>
                <div className="mb-5">
                  <h2 className="text-lg font-black">{heading}</h2>
                  <p className="text-xs text-[var(--bd-text-muted)] mt-0.5">{sub}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sectionItems.map((item) => (
                    <WishlistCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

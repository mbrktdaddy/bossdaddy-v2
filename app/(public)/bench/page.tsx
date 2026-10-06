import { createAdminClient } from '@/lib/supabase/admin'
import type { WishlistItem } from '@/lib/wishlist'
import { groupByStatus, getStatusLabel, BENCH_SELECT } from '@/lib/wishlist'
import { LABELS } from '@/lib/labels'
import OffTheBench from '@/components/OffTheBench'
import { WishlistCard } from '@/components/wishlist/WishlistCard'
import { VotePayoffBanner } from '@/components/VotePayoffBanner'
import PageHeader from '@/components/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { ogImageUrl, OG_SITE, TWITTER_HANDLE } from '@/lib/og'
import type { Metadata } from 'next'
import { Card } from '@/components/ui/Card'
import { ChevronDownIcon } from '@/components/icons'

export const revalidate = 300

export const metadata: Metadata = {
  // Absolute — brand already in the title; avoids the template double-branding.
  // The Bench's one job is follow; voting moved to On the Radar (2026-10-06).
  title: { absolute: "On the Bench — What Boss Daddy Is Testing Now" },
  description: "What Boss Daddy is testing now, what's up next, and what he passed on, with the reasons. Follow anything on the bench to get the review the day it's out.",
  alternates: { canonical: '/bench' },
  openGraph: {
    ...OG_SITE,
    title: 'On the Bench | Boss Daddy',
    description: "What Boss Daddy is testing now, what's up next, and what he passed on.",
    images: [{ url: ogImageUrl({ title: 'On the Bench', type: 'guide' }), width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', site: TWITTER_HANDLE, creator: TWITTER_HANDLE },
}

export default async function BenchPage() {
  const admin = createAdminClient()
  // Active pipeline + the passed list the deck promises. Reviewed items are NOT
  // listed here: they're the whole reviewed catalog, and "Fresh off the Bench"
  // (OffTheBench) below shows the recent graduates linked straight to the review.
  const [{ data }, { data: passedRaw }] = await Promise.all([
    admin
      .from('products')
      .select(`${BENCH_SELECT}, vote_count:wishlist_votes(count)`)
      .in('status', ['queued', 'testing'])
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(150),
    admin
      .from('products')
      .select(BENCH_SELECT)
      .eq('status', 'passed')
      .order('updated_at', { ascending: false })
      .limit(50),
  ])

  const items = ((data ?? []) as unknown as (WishlistItem & { vote_count: { count: number }[] })[]).map((i) => ({
    ...i,
    vote_count: i.vote_count?.[0]?.count ?? 0,
  }))

  const groups = groupByStatus([...items, ...((passedRaw ?? []) as unknown as WishlistItem[])])

  // Status icons — inline SVGs per the brand no-emoji-on-web rule. Beaker
  // for testing, clock for queued. Passed intentionally has no icon.
  const iconCls = 'w-4 h-4 inline-block shrink-0 mr-2 align-[-2px]'
  const sections: { key: keyof typeof groups; heading: string; icon: React.ReactNode; sub: string }[] = [
    {
      key: 'testing',
      heading: getStatusLabel('testing'),
      sub: 'Currently putting it through the paces.',
      icon: (
        <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      ),
    },
    {
      key: 'queued',
      heading: getStatusLabel('queued'),
      sub: 'Confirmed in the pipeline.',
      icon: (
        <svg className={iconCls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      key: 'passed',
      heading: getStatusLabel('passed'),
      sub: "Decided against these — here's why.",
      icon: null,
    },
  ]

  const hasContent = items.length > 0 || groups.passed.length > 0

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            {/* Live pulse — the one status glyph the eyebrow carries. Kept in the
                eyebrow rather than restated as a chip below it (eyebrow doctrine),
                so it survives on mobile where PageHeader's `actions` slot hides. */}
            <span
              aria-hidden
              className="inline-block w-1.5 h-1.5 rounded-full bg-accent animate-pulse mr-2 align-[1.5px]"
            />
            Live Testing Pipeline
          </>
        }
        title={LABELS.bench.full}
        deck="Everything I'm testing now, what's up next, and what I decided to skip — with the reasons. Follow anything here and I'll email you when the review's out."
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {/* Personalized loop closure: if you voted for something that's now a
            published review, this tells you (client-fetched, dismissible). */}
        <VotePayoffBanner />

        {!hasContent ? (
          <EmptyState title="Nothing on the bench yet. Check back soon." />
        ) : (
          <div className="space-y-12">
            {sections.map(({ key, heading, sub, icon }) => {
              const sectionItems = groups[key]
              if (sectionItems.length === 0) return null

              if (key === 'passed') {
                return (
                  <details key={key} className="group">
                    <summary className="flex items-center gap-2 cursor-pointer list-none mb-4">
                      <span className="text-xs font-black uppercase tracking-widest text-prose-muted">{heading}</span>
                      <span className="text-xs text-prose-faint">({sectionItems.length})</span>
                      <ChevronDownIcon className="w-3 h-3 text-prose-faint group-open:rotate-180 transition-transform ml-1" strokeWidth={2} />
                    </summary>
                    <div className="space-y-3">
                      {sectionItems.map((item) => (
                        <Card key={item.id} className="p-4">
                          <p className="text-sm font-semibold text-prose-muted">{item.title}</p>
                          {item.skip_reason && (
                            <p className="text-xs text-prose-faint mt-1">{item.skip_reason}</p>
                          )}
                        </Card>
                      ))}
                    </div>
                  </details>
                )
              }

              return (
                <section key={key}>
                  <div className="mb-5">
                    <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                    <h2 className="text-lg font-black inline-flex items-center">
                      {icon && <span className="text-accent-text-soft">{icon}</span>}
                      {heading}
                    </h2>
                    <p className="text-xs text-prose-muted mt-0.5">{sub}</p>
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

        {/* Graduated — the loop closes on the review itself, not a bench page. */}
        <OffTheBench className="mt-16" />
      </div>
    </>
  )
}

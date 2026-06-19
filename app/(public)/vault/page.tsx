import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { OCCASIONS } from '@/lib/gift-occasions'
import { LABELS } from '@/lib/labels'
import PipelineCounter from '@/components/PipelineCounter'
import OffTheBench from '@/components/OffTheBench'
import BenchStrip from '@/components/BenchStrip'

export const revalidate = 300

export const metadata: Metadata = {
  title: `${LABELS.vault.full} — Comparisons, Best-Of Lists, Gift Guides & Stacks | Boss Daddy`,
  description: 'The Vault — every Boss Daddy comparison, best-of list, gift guide, and stack in one place. Real-tested picks, head-to-head scorecards, and curated kits for boss dads.',
  alternates: { canonical: '/vault' },
}

interface VaultCard {
  slug:            string
  title:           string
  description:     string | null
  hero_image_url:  string | null
  collection_type: string
  occasion:        string | null
  published_at:    string | null
}

type Tab = { id: string; label: string; filter: (c: VaultCard) => boolean; eyebrow: string }

const TABS: Tab[] = [
  { id: 'all',         label: 'All',          eyebrow: 'Everything in the Vault',     filter: () => true },
  { id: 'comparisons', label: 'Comparisons',  eyebrow: 'Head-to-head scorecards',     filter: (c) => c.collection_type === 'comparison' },
  { id: 'best-of',     label: 'Best Of',      eyebrow: 'Curated picks + best-of lists', filter: (c) => c.collection_type === 'best_of' || c.collection_type === 'general' },
  { id: 'gifts',       label: 'Gift Guides',  eyebrow: 'Real-tested gift ideas',      filter: (c) => c.collection_type === 'gift_guide' },
  { id: 'stacks',      label: 'Stacks',       eyebrow: 'Kits built for purpose',      filter: (c) => c.collection_type === 'stack' },
]

interface Props {
  searchParams: Promise<{ tab?: string }>
}

export default async function VaultLandingPage({ searchParams }: Props) {
  const { tab: tabParam } = await searchParams
  const activeTab = TABS.find((t) => t.id === tabParam) ?? TABS[0]

  const supabase = await createClient()
  const { data } = await supabase
    .from('collections')
    .select('slug, title, description, hero_image_url, collection_type, occasion, published_at')
    .eq('is_visible', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(120)

  const cards = (data ?? []) as VaultCard[]
  const filtered = cards.filter(activeTab.filter)

  // Counts for the tab badges
  const counts = Object.fromEntries(
    TABS.map((t) => [t.id, cards.filter(t.filter).length]),
  )

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Hero */}
      <div className="mb-12">
        <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
        <p className="text-xs text-eyebrow uppercase tracking-widest font-semibold mb-3">{activeTab.eyebrow}</p>
        <h1 className="text-4xl md:text-5xl font-black mb-4 text-prose tracking-tight">{LABELS.vault.full}</h1>
        <p className="text-prose-muted max-w-2xl leading-relaxed text-base md:text-lg">
          Every comparison, best-of list, gift guide, and stack — in one place. Real-tested picks from a real dad, organized so you can find what you need in one click.
        </p>
        <PipelineCounter align="left" className="mt-5" />
      </div>

      {/* Tab filter strip */}
      <div className="mb-10 -mx-6 px-6">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
            const isActive = t.id === activeTab.id
            const count = counts[t.id] ?? 0
            const href = t.id === 'all' ? '/vault' : `/vault?tab=${t.id}`
            return (
              <Link
                key={t.id}
                href={href}
                scroll={false}
                className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-semibold transition-colors min-h-[44px] ${
                  isActive
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface text-prose-muted border-soft hover:border-strong hover:text-prose'
                }`}
              >
                {t.label}
                <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-accent text-white' : 'bg-surface-raised text-prose-faint'
                }`}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="bg-surface/40 border border-dashed border-soft rounded-xl p-12 text-center">
          <p className="text-prose-faint font-semibold mb-1">Nothing here yet.</p>
          <p className="text-sm text-prose-faint">Check back soon — content lands here every week.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((card) => (
            <VaultCardLink key={`${card.collection_type}:${card.slug}`} card={card} />
          ))}
        </div>
      )}

      {/* Loop closure — the back of the funnel shows what just graduated... */}
      <OffTheBench className="mt-16" />

      {/* ...and the front of the funnel: what's coming, vote on it. The one
          page that aggregates all finished content is the most natural place
          to convert a reader into a voter. */}
      <div className="mt-16">
        <BenchStrip ctaText="See what's coming next" />
      </div>
    </div>
  )
}

function VaultCardLink({ card }: { card: VaultCard }) {
  const meta = typeMeta(card.collection_type)
  const href = hrefFor(card)
  return (
    <Link
      href={href}
      className="group flex flex-col bg-surface border border-soft rounded-xl overflow-hidden shadow-md shadow-black/5 hover:border-accent-border/40 hover:shadow-lg hover:shadow-black/10 hover:-translate-y-1 transition-all"
    >
      <div className="relative aspect-[4/3] bg-surface-sunken">
        {card.hero_image_url ? (
          <Image src={card.hero_image_url} alt={card.title} fill className="object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-accent-text/30">
            {meta.icon}
          </div>
        )}
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 bg-surface-sunken/85 backdrop-blur border border-soft rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent-text-soft">
          {meta.label}
        </span>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="text-sm font-bold text-prose group-hover:text-accent-text-soft transition-colors leading-snug mb-1 line-clamp-2">{card.title}</p>
        {card.description && (
          <p className="text-xs text-prose-faint leading-relaxed line-clamp-2 flex-1">{card.description}</p>
        )}
        <p className="mt-3 text-[10px] text-prose-faint uppercase tracking-widest font-semibold group-hover:text-accent-text-soft transition-colors">
          Read →
        </p>
      </div>
    </Link>
  )
}

function hrefFor(card: VaultCard): string {
  if (card.collection_type === 'gift_guide') {
    // Gift guides route by occasion slug, not collection slug, so reader URLs
    // stay stable across yearly content refreshes.
    if (!card.occasion) return '/gifts'
    const occ = OCCASIONS.find((o) => o.value === card.occasion)
    return occ ? `/gifts/${occ.slug}` : '/gifts'
  }
  if (card.collection_type === 'comparison') return `/comparisons/${card.slug}`
  if (card.collection_type === 'stack')      return `/stacks/${card.slug}`
  return `/picks/${card.slug}` // general, best_of
}

function typeMeta(type: string): { label: string; icon: React.ReactNode } {
  const cls = 'w-10 h-10'
  if (type === 'comparison') {
    return {
      label: 'Comparison',
      icon: (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
        </svg>
      ),
    }
  }
  if (type === 'stack') {
    return {
      label: 'Stack',
      icon: (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    }
  }
  if (type === 'gift_guide') {
    return {
      label: 'Gift Guide',
      icon: (
        <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
        </svg>
      ),
    }
  }
  // best_of or general
  return {
    label: type === 'best_of' ? 'Best Of' : 'Pick List',
    icon: (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  }
}

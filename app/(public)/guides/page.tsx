import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CATEGORIES, getCategoryBySlug, type CategorySlug } from '@/lib/categories'
import GuideCard from './_components/GuideCard'
import GuidesGrid from './_components/GuidesGrid'
import FeaturedGuideCard from '@/components/FeaturedGuideCard'
const PER_PAGE = 12
import type { GuideRow } from './actions'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Dad Guides — Skills, How-Tos & Advice',
  description: 'Real guides for real dads — gear how-tos, backyard projects, grilling tips, and practical advice from a dad who actually tested it. No fluff, just what works.',
  openGraph: {
    title: 'Dad Guides — Boss Daddy Life',
    description: 'Real guides for real dads. Gear how-tos, backyard projects, grilling tips, and practical advice. No fluff.',
    images: [{ url: '/api/og?title=Dad+Guides+%26+Advice&type=guide', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dad Guides — Boss Daddy Life',
  },
  alternates: { canonical: '/guides' },
}

interface Props {
  searchParams: Promise<{ category?: string }>
}

export default async function GuidesPage({ searchParams }: Props) {
  const { category } = await searchParams
  const supabase = await createClient()

  // ── All view — category sections ──────────────────────────────────────
  if (!category) {
    const { data } = await supabase
      .from('guides')
      .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })

    const guides = (data ?? []) as GuideRow[]

    const sections = CATEGORIES
      .map(cat => ({
        cat,
        items: guides.filter(a => a.category === cat.slug).slice(0, 3),
        total: guides.filter(a => a.category === cat.slug).length,
      }))
      .filter(s => s.items.length > 0)

    // Featured: most recent guide with an image
    const featured = guides.find(g => g.image_url) ?? null

    // Stats
    const categoryCount = new Set(guides.map(g => g.category)).size
    const avgReadTime = guides.filter(g => g.reading_time_minutes).length > 0
      ? Math.round(guides.reduce((sum, g) => sum + (g.reading_time_minutes ?? 0), 0) / guides.filter(g => g.reading_time_minutes).length)
      : null
    const lastAdded = guides[0]?.published_at
      ? new Date(guides[0].published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : null

    return (
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="mb-8">
          <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-3">— The Field Notes</p>
          <h1 className="text-4xl md:text-5xl font-black mb-3 text-white tracking-tight">Guides</h1>
        </div>

        {/* Stats bar */}
        {guides.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-12 pb-6 border-b border-gray-800/60 text-sm text-gray-500">
            <span><span className="text-white font-bold tabular-nums">{guides.length}</span> {guides.length === 1 ? 'guide' : 'guides'}</span>
            <span className="text-gray-700 hidden sm:block">·</span>
            <span><span className="text-white font-bold tabular-nums">{categoryCount}</span> {categoryCount === 1 ? 'category' : 'categories'}</span>
            {avgReadTime && <>
              <span className="text-gray-700 hidden sm:block">·</span>
              <span>Avg <span className="text-white font-bold tabular-nums">{avgReadTime} min</span> read</span>
            </>}
            {lastAdded && <>
              <span className="text-gray-700 hidden sm:block">·</span>
              <span>Last added <span className="text-white font-medium">{lastAdded}</span></span>
            </>}
          </div>
        )}

        {/* Featured guide */}
        {featured && <FeaturedGuideCard guide={featured} />}

        <div className="-mx-6 overflow-x-auto scrollbar-hide mb-14">
          <div className="flex items-center gap-2 px-6 pb-1">
            <span className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-semibold bg-orange-600 text-white shadow-md shadow-black/30">
              All
            </span>
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/guides?category=${c.slug}`}
                className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40 transition-all"
              >
                {c.icon} {c.label}
              </Link>
            ))}
          </div>
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
            <p className="text-gray-500 text-lg font-semibold">No guides here yet.</p>
            <p className="text-gray-600 text-sm mt-2">Check back soon, Boss.</p>
          </div>
        ) : (
          sections.map(({ cat, items, total }, i) => (
            <section key={cat.slug} className={i > 0 ? 'mt-16' : ''}>
              <div className="flex items-stretch justify-between mb-6 gap-4">
                <div className="flex items-stretch gap-4">
                  <div className="w-[3px] bg-orange-600 rounded-full" />
                  <div>
                    <p className="text-[11px] text-orange-500 uppercase tracking-[0.18em] font-bold mb-1">{cat.icon} {cat.label}</p>
                    <h2 className="text-xl md:text-2xl font-black text-white">{cat.label}</h2>
                    {cat.description && <p className="text-sm text-gray-500 mt-1">{cat.description}</p>}
                  </div>
                </div>
                {total > items.length && (
                  <Link
                    href={`/guides?category=${cat.slug}`}
                    className="self-end shrink-0 text-xs text-gray-500 hover:text-orange-400 transition-colors uppercase tracking-widest font-semibold"
                  >
                    View all {total}
                  </Link>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {items.map((a, j) => <GuideCard key={a.id} guide={a} priority={i === 0 && j < 3} />)}
              </div>
            </section>
          ))
        )}
      </div>
    )
  }

  // ── Filtered view — flat grid + load more ─────────────────────────────
  const cat = getCategoryBySlug(category)
  const { data, count } = await supabase
    .from('guides')
    .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes', { count: 'exact' })
    .eq('status', 'approved')
    .eq('is_visible', true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .eq('category', category as any)
    .order('published_at', { ascending: false })
    .range(0, PER_PAGE - 1)

  const guides = (data ?? []) as GuideRow[]

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="mb-12">
        <p className="text-[11px] text-orange-500 uppercase tracking-[0.2em] font-bold mb-3">— Guides{cat ? ` / ${cat.label.toUpperCase()}` : ''}</p>
        <h1 className="text-4xl md:text-5xl font-black mb-3 text-white tracking-tight">
          {cat ? `${cat.icon} ${cat.label}` : 'Guides'}
        </h1>
        {cat?.description && (
          <p className="text-gray-400 mb-2 max-w-2xl">{cat.description}</p>
        )}
        <p className="text-gray-500 text-sm tabular-nums">
          {count ?? 0} {(count ?? 0) === 1 ? 'guide' : 'guides'}{cat ? ` in ${cat.label}` : ''}
        </p>
      </div>

      <div className="-mx-6 overflow-x-auto scrollbar-hide mb-14">
        <div className="flex items-center gap-2 px-6 pb-1">
          <Link
            href="/guides"
            className="shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40 transition-all"
          >
            All
          </Link>
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/guides?category=${c.slug}`}
              className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                category === c.slug
                  ? 'bg-orange-600 text-white shadow-md shadow-black/30'
                  : 'bg-gray-900 text-gray-400 hover:bg-gray-800 hover:text-white shadow-sm shadow-black/20 hover:shadow-md hover:shadow-black/40'
              }`}
            >
              {c.icon} {c.label}
            </Link>
          ))}
        </div>
      </div>

      {!guides.length ? (
        <div className="text-center py-24 bg-gray-900/40 rounded-2xl">
          <p className="text-gray-500 text-lg font-semibold">No guides here yet.</p>
          <p className="text-gray-600 text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        <GuidesGrid initialItems={guides} total={count ?? 0} category={category} />
      )}
    </div>
  )
}

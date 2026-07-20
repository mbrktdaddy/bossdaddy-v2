import Link from 'next/link'
import Image from 'next/image'
import { createAnonClient } from '@/lib/supabase/anon'
import { CATEGORIES } from '@/lib/categories'
import CategoryIcon from '@/components/CategoryIcon'
import FeaturedGuideCard from '@/components/FeaturedGuideCard'
import AskTheBoss from '@/components/AskTheBoss'
import PageHeader from '@/components/PageHeader'
import { ogImageUrl, OG_SITE } from '@/lib/og'
import type { GuideRow } from './actions'
import type { Metadata } from 'next'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Dad Guides — Skills, How-Tos & Advice',
  description: 'Real guides for real dads — stuff how-tos, backyard projects, grilling tips, and practical advice from a dad who actually tested it. No fluff, just what works.',
  openGraph: {
    ...OG_SITE,
    title: 'Dad Guides — Boss Daddy Life',
    description: 'Real guides for real dads. Stuff how-tos, backyard projects, grilling tips, and practical advice. No fluff.',
    images: [{ url: ogImageUrl({ title: 'Dad Guides & Advice', type: 'guide' }), width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Dad Guides — Boss Daddy Life',
  },
  alternates: { canonical: '/guides' },
}

// Static editorial index (audit H3): no searchParams, cookie-free anon reads.
// Category filtering lives on the path-based /guides/category/[slug] routes
// (already statically prerendered) that the pills below link to.
export default async function GuidesPage() {
  const supabase = createAnonClient()

  const { data } = await supabase
    .from('guides')
    .select('id, slug, title, category, excerpt, image_url, published_at, reading_time_minutes, featured')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(200)

  const guides = (data ?? []) as (GuideRow & { featured?: boolean })[]

  const sections = CATEGORIES
    .map(cat => ({
      cat,
      items: guides.filter(a => a.category === cat.slug).slice(0, 3),
      total: guides.filter(a => a.category === cat.slug).length,
    }))
    .filter(s => s.items.length > 0)

  // Admin-flagged featured wins; fall back to first guide with an image.
  const featured =
    guides.find((g) => g.featured && g.image_url) ??
    guides.find((g) => g.image_url) ??
    null

  return (
    <>
      <PageHeader
        eyebrow="The Field Notes"
        title="Guides"
        deck="Real how-tos for the situations that actually come up — tested by a dad, written without the fluff."
      />
      <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Featured guide — the showcase leads the page (Cover Story pattern) */}
      {featured && (
        <div className="mb-12">
          <FeaturedGuideCard guide={featured} />
        </div>
      )}

      {/* Category filter — horizontal scroll strip. Pills link to the static
          path-based category routes (indexable, prerendered). */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-6 px-6 mb-12 pb-1">
        <Link href="/guides"
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold bg-prose text-background border border-prose shadow-sm shadow-black/10 transition-colors">
          All Guides
        </Link>
        {CATEGORIES.map((c) => (
          <Link key={c.slug} href={`/guides/category/${c.slug}`}
            className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium bg-transparent text-prose-muted border border-strong hover:border-copper hover:text-prose transition-colors">
            <CategoryIcon slug={c.slug} className="w-4 h-4 text-accent-text" />
            <span>{c.label}</span>
          </Link>
        ))}
      </div>

      <AskTheBoss context="Browsing dad how-to guides across every category" className="mb-12" />

      {/* Per-category sections — editorial rows (newspaper directory style)
          replaces 8 identical 3-col card grids with a tighter, scannable
          list per category. Featured card above carries the visual weight. */}
      {sections.length === 0 ? (
        <div className="text-center py-24 bg-surface/40 rounded-xl border border-soft">
          <p className="text-prose-faint text-lg font-semibold">No guides here yet.</p>
          <p className="text-prose-faint text-sm mt-2">Check back soon, Boss.</p>
        </div>
      ) : (
        sections.map(({ cat, items, total }, i) => (
          <section key={cat.slug} className={i > 0 ? 'mt-12' : ''}>
            <div className="flex items-end justify-between mb-5 gap-4">
              <div className="min-w-0">
                <span aria-hidden className="block h-px w-6 bg-accent-brand/60 mb-3" />
                <h2 className="text-xl md:text-2xl font-black text-prose flex items-center gap-2.5 leading-tight">
                  <CategoryIcon slug={cat.slug} className="w-5 h-5 sm:w-6 sm:h-6 text-accent-text shrink-0" />
                  <span className="truncate">{cat.label}</span>
                </h2>
                {cat.description && (
                  <p className="text-sm text-prose-faint mt-1.5 line-clamp-1">{cat.description}</p>
                )}
              </div>
              {total > items.length && (
                <Link
                  href={`/guides/category/${cat.slug}`}
                  className="self-end shrink-0 text-xs text-prose-faint hover:text-accent-text-soft transition-colors uppercase tracking-widest font-semibold"
                >
                  View all {total}
                </Link>
              )}
            </div>
            <div className="divide-y divide-soft">
              {items.map((a) => <GuideRowItem key={a.id} guide={a} />)}
            </div>
          </section>
        ))
      )}
      </div>
    </>
  )
}

// Editorial row — image left, title + reading-time/date right, chevron far
// right. Same geometry as the /reviews and /gear Solid Gear rows; chevron
// substitutes for the rating chip since guides don't carry ratings.
function GuideRowItem({ guide: a }: { guide: GuideRow }) {
  return (
    <Link
      href={`/guides/${a.slug}`}
      className="group flex items-center gap-5 py-5 -mx-4 px-4 rounded-xl hover:bg-surface/40 transition-colors"
    >
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-surface-raised shrink-0">
        {a.image_url ? (
          <Image
            src={a.image_url}
            alt={a.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 80px, 96px"
          />
        ) : (
          <div className="w-full h-full bg-surface-raised flex items-center justify-center">
            <CategoryIcon slug={a.category} className="w-6 h-6 text-accent-text/40" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-base md:text-lg font-bold text-prose group-hover:text-accent-text-soft transition-colors leading-snug">
          {a.title}
        </h3>
        <div className="flex items-center gap-2 text-xs text-prose-faint mt-1.5">
          {a.reading_time_minutes && <span>{a.reading_time_minutes} min read</span>}
          {a.reading_time_minutes && a.published_at && <span className="text-prose-faint">·</span>}
          {a.published_at && (
            <span>
              {new Date(a.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-prose-faint group-hover:text-accent-text-soft transition-colors">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </Link>
  )
}

import Link from 'next/link'
import type { Metadata } from 'next'
import { createAnonClient } from '@/lib/supabase/anon'
import { CATEGORIES, getCategoryBySlug } from '@/lib/categories'
import { LABELS } from '@/lib/labels'
import { buildSocialMetadata } from '@/lib/og'
import { getVaultCollections, vaultHref, vaultTypeLabel } from '@/lib/vault'
import { mergeByRecency, formatPublished, type LatestItem } from '@/lib/latest'
import PageHeader from '@/components/PageHeader'
import EditorialHeader from '@/components/EditorialHeader'
import ContentRow from '@/components/ContentRow'
import CategoryIcon from '@/components/CategoryIcon'
import { Card } from '@/components/ui/Card'
import { CheckCircleIcon, ScaleIcon, StarIcon, ChevronRightIcon } from '@/components/icons'

// Static editorial index (audit H3): cookie-free anon reads, hourly revalidate,
// no searchParams. Same contract as /reviews and /guides.
export const revalidate = 3600

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

export const metadata: Metadata = buildSocialMetadata({
  title: `${LABELS.explore.full} — Every Topic, Every Format | Boss Daddy`,
  description: LABELS.explore.tagline,
  path: '/explore',
  siteUrl,
  ogTitle: `${LABELS.explore.full} | Boss Daddy`,
  type: 'site',
  ogType: 'website',
})

// The merged index below the topics and formats. Twice the homepage rail (6):
// this page IS the "all of it" destination the rail would otherwise link to, so
// it can afford a longer list — but it is still an index, not an archive. The
// per-format listings are the archives.
const LATEST_SLOTS = 12

// Reading formats only (nav-ia-plan Phase I). Stacks and gift guides are
// SHOPPING formats and live under /gear — they are deliberately not here.
const READING_COLLECTION_TYPES = ['comparison', 'best_of', 'general']

/**
 * /explore — the ONE content index (nav-ia-plan Phase I, step I-1).
 *
 * Three tiers, in the order a reader actually narrows: WHAT topic (the grid), in
 * WHICH shape (the format rows, each linking its listing), and failing both,
 * WHAT'S NEW (the merged rail). Topics lead because readers navigate by subject;
 * formats are article shapes inside a topic, not destinations — invariant 10.
 *
 * A format row self-suppresses while its listing is empty. This is a page, not
 * chrome, so an absent row is the honest state; a row that leads to "first one
 * drops soon" is the zero-count tab strip the Vault is being dissolved for.
 */
export default async function ExplorePage() {
  const supabase = createAnonClient()

  const [
    { data: reviewsRaw },
    { data: guidesRaw },
    { count: reviewCount },
    { count: guideCount },
    collections,
  ] = await Promise.all([
    supabase
      .from('reviews')
      .select('id, slug, title, product_name, category, excerpt, image_url, published_at')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(LATEST_SLOTS),
    supabase
      .from('guides')
      .select('id, slug, title, category, excerpt, image_url, published_at')
      .eq('status', 'approved').eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(LATEST_SLOTS),
    supabase
      .from('reviews')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved').eq('is_visible', true),
    supabase
      .from('guides')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'approved').eq('is_visible', true),
    // Already filtered to visible + published; the loader is shared with the
    // collection listings so the two can't disagree on what counts as live.
    getVaultCollections(),
  ])

  const readingCollections = collections.filter((c) => READING_COLLECTION_TYPES.includes(c.collection_type))
  const comparisonCount = readingCollections.filter((c) => c.collection_type === 'comparison').length
  const picksCount = readingCollections.length - comparisonCount

  // Which rows show is a presence test, not a count display (no vanity metrics
  // while small — the number never renders).
  const formats = [
    {
      href: '/reviews',
      label: LABELS.reviews.plural,
      blurb: 'One product, bought and used for real, scored honestly.',
      present: (reviewCount ?? 0) > 0,
      icon: <CheckCircleIcon className="w-5 h-5" strokeWidth={1.5} />,
    },
    {
      href: '/guides',
      label: LABELS.guides.plural,
      blurb: 'The longer read — how to do the thing, from a dad who has.',
      present: (guideCount ?? 0) > 0,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
      ),
    },
    {
      href: '/comparisons',
      label: LABELS.comparisons.short,
      blurb: 'Two or three that solve the same problem, head to head, one winner.',
      present: comparisonCount > 0,
      icon: <ScaleIcon className="w-5 h-5" strokeWidth={1.5} />,
    },
    {
      href: '/picks',
      label: LABELS.picks.short,
      blurb: 'Ranked roundups of a category, from someone who paid for all of them.',
      present: picksCount > 0,
      icon: <StarIcon className="w-5 h-5" strokeWidth={1.5} />,
    },
  ].filter((f) => f.present)

  const latest = mergeByRecency<LatestItem>([
    ...(reviewsRaw ?? []).map((r) => ({
      kind: LABELS.reviews.singular,
      title: r.product_name,
      href: `/reviews/${r.slug}`,
      published_at: r.published_at,
      category: r.category,
      excerpt: r.excerpt,
      imageUrl: r.image_url,
    })),
    ...(guidesRaw ?? []).map((g) => ({
      kind: LABELS.guides.singular,
      title: g.title,
      href: `/guides/${g.slug}`,
      published_at: g.published_at,
      category: g.category,
      excerpt: g.excerpt,
      imageUrl: g.image_url,
    })),
    ...readingCollections.map((c) => ({
      kind: vaultTypeLabel(c.collection_type),
      title: c.title,
      href: vaultHref(c),
      published_at: c.published_at,
      category: c.dominant_category,
      excerpt: c.description,
      imageUrl: c.hero_image_url,
    })),
  ], LATEST_SLOTS)

  // Two columns from `lg`, filled top-to-bottom so reading order survives the
  // split: left column is the newest half, right column the older half.
  const half = Math.ceil(latest.length / 2)
  const latestColumns = [latest.slice(0, half), latest.slice(half)].filter((col) => col.length > 0)

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: LABELS.explore.full, item: `${siteUrl}/explore` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <PageHeader eyebrow="The index" title={LABELS.explore.full} deck={LABELS.explore.tagline} />

      {/* ── Topics ────────────────────────────────────────────────────────── */}
      <section className="border-b border-soft">
        <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
          <EditorialHeader eyebrow="By topic" title="Pick a subject" />
          {/* Every category, taxonomy order, one shape — no count thresholds, no
              per-topic variants (uniformity over tidy empty states). */}
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {CATEGORIES.map((cat) => (
              <Card as="li" key={cat.slug} className="hover:border-strong transition-colors">
                <Link href={`/category/${cat.slug}`} className="group flex flex-col gap-3 p-4 sm:p-5 h-full min-h-[44px]">
                  <CategoryIcon slug={cat.slug} className="w-6 h-6 text-copper shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm sm:text-base font-extrabold text-prose leading-snug group-hover:text-accent transition-colors">
                      {cat.label}
                    </p>
                    <p className="mt-1 text-xs text-prose-muted leading-relaxed line-clamp-2 hidden sm:block">
                      {cat.description}
                    </p>
                  </div>
                </Link>
              </Card>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Formats ───────────────────────────────────────────────────────── */}
      {formats.length > 0 && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
            <EditorialHeader eyebrow="By format" title="Pick a shape" />
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {formats.map((f) => (
                <Card as="li" key={f.href} className="hover:border-strong transition-colors">
                  <Link href={f.href} className="group flex items-center gap-4 p-4 sm:p-5">
                    <span className="shrink-0 w-10 h-10 rounded-full bg-surface-raised border border-soft flex items-center justify-center text-copper">
                      {f.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-base font-extrabold text-prose leading-snug group-hover:text-accent transition-colors">
                        {f.label}
                      </span>
                      <span className="block mt-0.5 text-sm text-prose-muted leading-relaxed">
                        {f.blurb}
                      </span>
                    </span>
                    <ChevronRightIcon className="w-4 h-4 text-prose-faint shrink-0" strokeWidth={2} />
                  </Link>
                </Card>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── The latest — merged across every reading format ───────────────── */}
      {latest.length > 0 && (
        <section className="border-b border-soft">
          <div className="max-w-6xl mx-auto px-6 py-12 md:py-16">
            <EditorialHeader eyebrow="Newest first" title="The latest" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-10">
              {latestColumns.map((col, c) => (
                <div key={c} className="flex flex-col">
                  {col.map((it, i) => (
                    <ContentRow
                      key={it.href}
                      href={it.href}
                      kind={it.kind}
                      eyebrow={it.category ? getCategoryBySlug(it.category)?.label ?? it.category : 'Boss Daddy'}
                      headline={it.title}
                      excerpt={it.excerpt}
                      meta={formatPublished(it.published_at)}
                      imageUrl={it.imageUrl ?? null}
                      isLast={i === col.length - 1}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}

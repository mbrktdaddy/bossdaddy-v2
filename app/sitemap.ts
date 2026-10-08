import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORY_SLUGS } from '@/lib/categories'
import { OCCASIONS } from '@/lib/gift-occasions'
import { RADAR_PUBLIC_STATUSES } from '@/lib/products/radar'

/*
 * `lastModified` must be derived from the content a URL actually renders.
 *
 * Every category, tag, gift and index entry here used to be `new Date()`, which
 * told Google that ~100 of our 152 URLs changed on every single crawl. Google
 * honours <lastmod> only while it is "consistently and verifiably accurate" and
 * ignores the field site-wide once it isn't — so those entries were actively
 * devaluing the honest timestamps on the 53 detail pages. (Detail pages had
 * their own version of this problem until migration 131 stopped page views from
 * rewriting `updated_at`; this is the other half of that fix.)
 *
 * Where there is no timestamp we can stand behind — a gift occasion with no
 * guide written yet, or a static page whose content changes on deploy rather
 * than in the database — we OMIT lastModified. Omitting is legitimate; guessing
 * is what got us here.
 */

/** Newest parseable timestamp, or undefined if there isn't one. */
function newestOf(dates: (string | null | undefined)[]): Date | undefined {
  let best = -Infinity
  for (const d of dates) {
    const t = d ? Date.parse(d) : NaN
    if (!Number.isNaN(t) && t > best) best = t
  }
  return best === -Infinity ? undefined : new Date(best)
}

/** Group rows by a key, keeping the newest timestamp seen for each. */
function newestByKey<T>(
  rows: T[],
  key: (row: T) => string | null | undefined,
  date: (row: T) => string | null | undefined,
): Map<string, Date> {
  const out = new Map<string, number>()
  for (const row of rows) {
    const k = key(row)
    if (!k) continue
    const t = Date.parse(date(row) ?? '')
    if (Number.isNaN(t)) continue
    if (t > (out.get(k) ?? -Infinity)) out.set(k, t)
  }
  return new Map(Array.from(out, ([k, t]) => [k, new Date(t)]))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://www.bossdaddylife.com'
  const supabase = await createClient()
  const admin = createAdminClient()

  const [
    { data: reviews },
    { data: articles },
    { data: reviewTagRows },
    { data: guideTagRows },
    { data: picks },
    { data: benchItems },
    { data: merchItems },
    { data: radarItems },
  ] = await Promise.all([
    supabase
      .from('reviews')
      // `rating` is here only to date the /gear/category pages, which list
      // reviews scoring 8+ — see gearCategoryUrls.
      .select('slug, category, rating, published_at, updated_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false }),
    supabase
      .from('guides')
      .select('slug, category, published_at, updated_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false }),
    // Only tags actually attached to a published, visible review/guide.
    // The embedded `updated_at` is what dates the tag page.
    admin.from('review_tags').select('tag_slug, reviews!inner(status, is_visible, updated_at, published_at)')
      .eq('reviews.status', 'approved')
      .eq('reviews.is_visible', true),
    admin.from('guide_tags').select('tag_slug, guides!inner(status, is_visible, updated_at, published_at)')
      .eq('guides.status', 'approved')
      .eq('guides.is_visible', true),
    admin.from('collections').select('slug, updated_at, collection_type, occasion').eq('is_visible', true),
    // Mirrors the /bench query — the pipeline statuses that page renders.
    admin.from('products').select('updated_at').in('status', ['queued', 'testing']),
    // Merch. Mirrors the filter in gear/[slug]'s generateStaticParams so the
    // sitemap lists exactly the pages that actually prerender.
    admin.from('merch').select('slug, updated_at')
      .in('status', ['available', 'coming_soon'])
      .is('archived_at', null),
    // Everything /gear/radar renders — the same filter as getRadarArchive().
    // Live rows (status 'radar') also feed the Radar lane on /gear and on the
    // gear category pages.
    admin.from('products').select('status, category, updated_at')
      .in('status', [...RADAR_PUBLIC_STATUSES])
      .lte('spotted_at', new Date().toISOString()),
  ])

  const reviewRows = reviews ?? []
  const guideRows  = articles ?? []
  const pickRows   = picks ?? []

  const contentDate = (r: { updated_at: string | null; published_at: string | null }) =>
    r.updated_at ?? r.published_at

  // ── Derived lastmod lookups ────────────────────────────────────────────────
  const reviewCategoryDates = newestByKey(reviewRows, (r) => r.category, contentDate)
  const guideCategoryDates  = newestByKey(guideRows,  (a) => a.category, contentDate)
  const reviewTagDates = newestByKey(
    reviewTagRows ?? [],
    (r) => r.tag_slug,
    (r) => r.reviews?.updated_at ?? r.reviews?.published_at,
  )
  const guideTagDates = newestByKey(
    guideTagRows ?? [],
    (g) => g.tag_slug,
    (g) => g.guides?.updated_at ?? g.guides?.published_at,
  )
  // Gift guides are matched to an occasion by `collections.occasion`, which
  // holds the underscored `occ.value` (not the hyphenated URL slug).
  const giftDates = newestByKey(
    pickRows.filter((p) => p.collection_type === 'gift_guide'),
    (p) => p.occasion,
    (p) => p.updated_at,
  )

  const newestCollectionOf = (...types: string[]) =>
    newestOf(pickRows.filter((p) => types.includes(p.collection_type ?? '')).map((p) => p.updated_at))

  const newestReview = newestOf(reviewRows.map(contentDate))
  const newestGuide  = newestOf(guideRows.map(contentDate))
  const newestBench  = newestOf((benchItems ?? []).map((b) => b.updated_at))
  const merchRows    = merchItems ?? []
  const newestMerch  = newestOf(merchRows.map((m) => m.updated_at))

  // /gear/category/[slug] lists REVIEWS rated 8+ (merch lives under /shop since
  // the 2026-09-29 split, so /gear no longer mixes the two). Date those pages by
  // the newest review that actually clears the bar, so the lastmod matches what
  // the page renders — the whole doctrine at the top of this file.
  const gearGradeRows = reviewRows.filter((r) => (r.rating ?? 0) >= 8)
  const gearCategoryDates = newestByKey(gearGradeRows, (r) => r.category, contentDate)
  const newestGearReview  = newestOf(gearGradeRows.map(contentDate))

  // On the Radar. The archive renders every public Radar row; the lanes on
  // /gear and the category pages render only the live ones.
  const radarRows      = radarItems ?? []
  const liveRadarRows  = radarRows.filter((r) => r.status === 'radar')
  const newestRadar    = newestOf(radarRows.map((r) => r.updated_at))
  const radarCategoryDates = newestByKey(liveRadarRows, (r) => r.category, (r) => r.updated_at)
  // A category page is LISTED only when it has rated gear (a Radar-only page
  // is thin), but once listed its lastmod counts its Radar lane too.
  for (const [cat, date] of gearCategoryDates) {
    const radarDate = radarCategoryDates.get(cat)
    if (radarDate && radarDate > date) gearCategoryDates.set(cat, radarDate)
  }

  // Everything the /gear hub actually renders. Its merch strip is a teaser for
  // /shop, not page content, so merch dates /shop instead.
  const newestGear = newestOf([
    newestGearReview?.toISOString(),
    // 'stack' since Phase I-3 — the Kits section renders the newest stacks.
    newestCollectionOf('gift_guide', 'general', 'best_of', 'stack')?.toISOString(),
    ...liveRadarRows.map((r) => r.updated_at),
  ])
  const newestAnything = newestOf([
    newestReview?.toISOString(),
    newestGuide?.toISOString(),
    ...pickRows.map((p) => p.updated_at),
  ])

  // ── Detail pages ───────────────────────────────────────────────────────────
  const reviewUrls: MetadataRoute.Sitemap = reviewRows.map((r) => ({
    url: `${base}/reviews/${r.slug}`,
    lastModified: contentDate(r) ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const articleUrls: MetadataRoute.Sitemap = guideRows.map((a) => ({
    url: `${base}/guides/${a.slug}`,
    lastModified: contentDate(a) ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  // ── Category + tag pages — dated by their newest member ────────────────────
  // Only include category pages that have published, visible content
  const reviewCategoriesWithContent = new Set(reviewRows.map((r) => r.category).filter(Boolean) as string[])
  const guideCategoriesWithContent  = new Set(guideRows.map((a) => a.category).filter(Boolean) as string[])

  const categoryUrls: MetadataRoute.Sitemap = CATEGORY_SLUGS
    .filter((slug) => reviewCategoriesWithContent.has(slug))
    .map((slug) => ({
      url: `${base}/reviews/category/${slug}`,
      lastModified: reviewCategoryDates.get(slug),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

  const guideCategoryUrls: MetadataRoute.Sitemap = CATEGORY_SLUGS
    .filter((slug) => guideCategoriesWithContent.has(slug))
    .map((slug) => ({
      url: `${base}/guides/category/${slug}`,
      lastModified: guideCategoryDates.get(slug),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

  const tagUrls: MetadataRoute.Sitemap = Array.from(reviewTagDates.keys()).map((slug) => ({
    url: `${base}/reviews/tag/${slug}`,
    lastModified: reviewTagDates.get(slug),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const guideTagUrls: MetadataRoute.Sitemap = Array.from(guideTagDates.keys()).map((slug) => ({
    url: `${base}/guides/tag/${slug}`,
    lastModified: guideTagDates.get(slug),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  // Route each collection to its type-specific URL. Gift guides live at
  // /gifts/[occasion-slug] (already covered by giftUrls below) so skip those.
  const collectionUrls: MetadataRoute.Sitemap = pickRows
    .filter((p) => p.collection_type !== 'gift_guide')
    .map((p) => {
      const path = p.collection_type === 'comparison'
        ? `/comparisons/${p.slug}`
        : p.collection_type === 'stack'
        ? `/stacks/${p.slug}`
        : `/picks/${p.slug}`
      return {
        url: `${base}${path}`,
        lastModified: p.updated_at ?? undefined,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      }
    })

  // Merch detail pages. These were absent entirely — Google was never told the
  // store existed, and it's why they escaped the OG sweep that reads sitemap.xml.
  const merchUrls: MetadataRoute.Sitemap = merchRows.map((m) => ({
    url: `${base}/shop/${m.slug}`,
    lastModified: m.updated_at ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  // Only categories that actually have a review scoring 8+, matching how the
  // review/guide category lists above skip empty categories.
  const gearCategoryUrls: MetadataRoute.Sitemap = CATEGORY_SLUGS
    .filter((slug) => gearCategoryDates.has(slug))
    .map((slug) => ({
      url: `${base}/gear/category/${slug}`,
      lastModified: gearCategoryDates.get(slug),
      changeFrequency: 'weekly',
      priority: 0.7,
    }))

  // Every defined occasion — stable URLs that compound SEO whether content
  // exists or not. Occasions with no guide written yet carry NO lastmod: the
  // URL is real and worth crawling, but nothing has been modified.
  const giftUrls: MetadataRoute.Sitemap = OCCASIONS.map((occ) => ({
    url: `${base}/gifts/${occ.slug}`,
    lastModified: giftDates.get(occ.value),
    changeFrequency: 'monthly',
    priority: 0.85,
  }))

  return [
    // Index pages are dated by the newest thing they list. /about and
    // /how-we-test change on deploy rather than in the database, so they get no
    // lastmod at all rather than a fabricated one.
    { url: base,                   lastModified: newestAnything,                        changeFrequency: 'daily',   priority: 1.0 },
    // /explore is the merged index over reviews + guides + collections, so it is
    // dated by whichever of them moved last.
    { url: `${base}/explore`,      lastModified: newestAnything,                        changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/reviews`,      lastModified: newestReview,                          changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/guides`,       lastModified: newestGuide,                           changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/gifts`,        lastModified: newestCollectionOf('gift_guide'),      changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/picks`,        lastModified: newestCollectionOf('best_of', 'general'), changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/comparisons`,  lastModified: newestCollectionOf('comparison'),      changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/stacks`,       lastModified: newestCollectionOf('stack'),           changeFrequency: 'weekly',  priority: 0.8 },
    // /gear is a HUB over reviews scoring 8+ (top picks) and the seasonal gift
    // guides + featured collection. It was dated `newestReview`, which counts
    // reviews below the 8 cutoff that the page never shows. Date it by the newest
    // of what it renders.
    { url: `${base}/gear`,         lastModified: newestGear,                            changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/gear/radar`,   lastModified: newestRadar,                           changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${base}/shop`,         lastModified: newestMerch,                           changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/bench`,        lastModified: newestBench,                           changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/about`,                                                             changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/how-we-test`,                                                       changeFrequency: 'yearly',  priority: 0.5 },
    ...categoryUrls,
    ...guideCategoryUrls,
    ...gearCategoryUrls,
    ...merchUrls,
    ...tagUrls,
    ...guideTagUrls,
    ...reviewUrls,
    ...articleUrls,
    ...collectionUrls,
    ...giftUrls,
  ]
}

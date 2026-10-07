import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProductAcquisition, ProductStatus } from '@/lib/products'

// On the Radar, the public side (mig 157; plan: docs/gear-radar-plan.md).
//
// A product enters Radar with a take and a spotted_at, and keeps both after it
// moves on, so /gear/radar can show what happened to it. spotted_at doubles as
// the release time (a future value = scheduled), so EVERY public read here
// filters spotted_at <= now.

/**
 * The stages a Radar item can be in and still be public. Catalog (pulled back
 * to private) and archived are not, so they drop out of the archive too.
 */
export const RADAR_PUBLIC_STATUSES = ['radar', 'queued', 'testing', 'reviewed', 'passed'] as const

// The review embed names its FK on purpose: products and reviews are linked
// both ways (products.review_id → reviews, and reviews.product_slug → products),
// so a bare `reviews(...)` embed is ambiguous and PostgREST rejects the query.
const RADAR_SELECT =
  'id, slug, name, brand, image_url, gallery_images, category, radar_take, spotted_at, status, skip_reason, affiliate_url, store, custom_store_name, acquisition, provided_by, vote_count:wishlist_votes(count), review:reviews!products_review_id_fkey(slug, rating, status, is_visible)'

/** A Radar card's data: one product, live on Radar or moved on. */
export interface RadarItem {
  id: string
  slug: string
  name: string
  brand: string | null
  image_url: string | null
  /** Cover first, then gallery photos; blanks and duplicates removed. */
  images: string[]
  category: string | null
  /** The take written when it was spotted. Kept after the product moves on. */
  take: string | null
  spotted_at: string
  status: ProductStatus
  skip_reason: string | null
  affiliate_url: string | null
  store: string | null
  custom_store_name: string | null
  acquisition: ProductAcquisition | null
  provided_by: string | null
  /** "Want me to test it?" votes. They carry over when the item moves on. */
  vote_count: number
  /** The product's review, ONLY when it is approved and visible. */
  review: { slug: string; rating: number | null } | null
}

type EmbeddedReview = { slug: string; rating: number | null; status: string; is_visible: boolean }

type RadarRow = Omit<RadarItem, 'take' | 'vote_count' | 'review' | 'images'> & {
  gallery_images: string[] | null
  radar_take: string | null
  vote_count: { count: number }[] | null
  review: EmbeddedReview | EmbeddedReview[] | null
}

/** Cover first, then the gallery, with falsy and duplicate URLs dropped. */
export function radarImages(cover: string | null | undefined, gallery: (string | null | undefined)[] | null | undefined): string[] {
  return [...new Set([cover, ...(gallery ?? [])].filter((u): u is string => !!u))]
}

/** Normalise a row from RADAR_SELECT: flatten the vote count, keep only a public review. */
export function toRadarItem(row: RadarRow): RadarItem {
  const { radar_take, vote_count, review: embedded, gallery_images, ...rest } = row
  // A many-to-one embed comes back as an object; tolerate an array too.
  const review = Array.isArray(embedded) ? embedded[0] ?? null : embedded
  return {
    ...rest,
    images: radarImages(rest.image_url, gallery_images),
    take: radar_take?.trim() || null,
    vote_count: vote_count?.[0]?.count ?? 0,
    review: review && review.status === 'approved' && review.is_visible
      ? { slug: review.slug, rating: review.rating }
      : null,
  }
}

/** Where a Radar item ended up. `status` is the Bench stage its chip shows. */
export type RadarOutcome =
  | { kind: 'live' }
  | { kind: 'bench'; status: 'queued' | 'testing'; href: string }
  | { kind: 'reviewed'; status: 'reviewed'; href: string; rating: number | null }
  | { kind: 'passed'; status: 'passed'; reason: string | null }

/**
 * What happened to a Radar item, in the plan's precedence order: an approved,
 * visible review wins, then passed, then a Bench stage, then still live.
 *
 * Returns null when there's no honest public outcome to show: catalog (pulled
 * back), archived, or `reviewed` with no visible approved review. The archive
 * leaves those out rather than show a reviewed product as untested.
 */
export function radarOutcome(
  item: Pick<RadarItem, 'slug' | 'status' | 'skip_reason' | 'review'>,
): RadarOutcome | null {
  if (!(RADAR_PUBLIC_STATUSES as readonly string[]).includes(item.status)) return null
  if (item.review) {
    return { kind: 'reviewed', status: 'reviewed', href: `/reviews/${item.review.slug}`, rating: item.review.rating }
  }
  switch (item.status) {
    case 'passed':
      return { kind: 'passed', status: 'passed', reason: item.skip_reason?.trim() || null }
    case 'queued':
    case 'testing':
      return { kind: 'bench', status: item.status, href: `/bench/${item.slug}` }
    case 'radar':
      return { kind: 'live' }
    default:
      return null
  }
}

/**
 * Live Radar, newest first: on Radar now and released. Feeds the lane on /gear
 * and on each /gear/category page.
 */
export async function getLiveRadar(
  supabase: SupabaseClient,
  { limit, category }: { limit: number; category?: string },
): Promise<RadarItem[]> {
  let query = supabase
    .from('products')
    .select(RADAR_SELECT)
    .eq('status', 'radar')
    .lte('spotted_at', new Date().toISOString())
    .order('spotted_at', { ascending: false })
    .limit(limit)
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) {
    console.error('getLiveRadar failed:', error)
    return []
  }
  return ((data ?? []) as unknown as RadarRow[]).map(toRadarItem)
}

/**
 * Everything that has been on Radar and is still public, newest first, for
 * /gear/radar. Items with no honest outcome are dropped (see radarOutcome).
 * ~3 a week means the 200 cap is about a year's worth; paginate before then.
 */
export async function getRadarArchive(supabase: SupabaseClient, limit = 200): Promise<RadarItem[]> {
  const { data, error } = await supabase
    .from('products')
    .select(RADAR_SELECT)
    .in('status', [...RADAR_PUBLIC_STATUSES])
    .lte('spotted_at', new Date().toISOString())
    .order('spotted_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getRadarArchive failed:', error)
    return []
  }
  return ((data ?? []) as unknown as RadarRow[]).map(toRadarItem).filter((item) => radarOutcome(item) !== null)
}

/**
 * The archive card's anchor. Radar items have no page of their own, so links to
 * one (the account page's follow list) jump to its card: /gear/radar#<this>.
 * Prefixed so a product slug can't collide with another id on the page.
 */
export function radarAnchorId(slug: string): string {
  return `radar-${slug}`
}

/**
 * "Oct 6, 2026", the day it was spotted. Formatted in the operator's zone (the
 * same one the Boss dates by), so an evening entry doesn't read as tomorrow
 * on a server running in UTC.
 */
export function formatSpotted(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago',
  })
}

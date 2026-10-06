import { STORE_OPTIONS, getStoreLabel } from '@/lib/products'
import type { ProductStore } from '@/lib/products'

export { STORE_OPTIONS, getStoreLabel }
export type { ProductStore }

// The bench is a view over the products spine: what's being tested (queued,
// testing), plus the outcomes its detail pages show (reviewed, passed).
// 'passed' replaces the former bench-only 'skipped' (migration 100/101);
// 'considering' was retired into On the Radar (migration 158).
export type WishlistStatus =
  | 'queued'
  | 'testing'
  | 'reviewed'
  | 'passed'

// THE bench status vocabulary — /bench headings, badges, BenchStrip and the
// homepage ticker all read these. Queued was "Coming Soon", which merch also
// uses for unreleased products; "Up Next" is unambiguous.
export const WISHLIST_STATUS_OPTIONS: { value: WishlistStatus; label: string; color: string }[] = [
  { value: 'queued',      label: 'Up Next',      color: 'text-blue-700' },
  { value: 'testing',     label: 'Testing Now',  color: 'text-green-700' },
  { value: 'reviewed',    label: 'Reviewed',     color: 'text-accent' },
  { value: 'passed',      label: 'Not Testing',  color: 'text-prose-faint' },
]

// The bench is the products spine in its early lifecycle states. This column set
// projects a products row into the WishlistItem shape — `name` aliased to `title`
// so existing bench consumers keep working. Use everywhere the bench is read.
export const BENCH_SELECT =
  'id, slug, title:name, description, image_url, gallery_images, affiliate_url, store, custom_store_name, asin, status, skip_reason, estimated_review_date, review_id, priority, created_at, updated_at'

export interface WishlistItem {
  id: string
  slug: string
  title: string
  description: string | null
  image_url: string | null
  gallery_images: string[]
  affiliate_url: string | null
  store: string | null
  custom_store_name: string | null
  asin: string | null
  status: WishlistStatus
  skip_reason: string | null
  estimated_review_date: string | null
  review_id: string | null
  priority: number
  created_at: string
  updated_at: string
  // joined
  vote_count?: number
}

export interface WishlistItemWithUserState extends WishlistItem {
  user_has_voted: boolean
  user_subscribed: boolean
}

export function getStatusLabel(status: WishlistStatus): string {
  return WISHLIST_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
}

export function getStatusColor(status: WishlistStatus): string {
  return WISHLIST_STATUS_OPTIONS.find((s) => s.value === status)?.color ?? 'text-zinc-400'
}

/**
 * The vote count, said one way everywhere. Readers vote on Radar ("Want me to
 * test it?"), and the votes carry over when the item moves to the Bench.
 */
export function requestedByLabel(count: number): string {
  return `Requested by ${count} ${count === 1 ? 'dad' : 'dads'}`
}

/**
 * What toggling a vote does to the voter's follow (operator, 2026-10-06).
 *
 * A vote asks for the test, so it also follows the item: the voter gets the
 * follower emails (up next → testing → review's out), and the card says so the
 * moment they vote. Taking the vote back while the item is still on the Radar
 * drops that follow too, so a withdrawn request never emails. Once the item has
 * moved on, the follow is left alone: it may be a deliberate Bench follow, and
 * every email carries an unsubscribe link. Existing votes were NOT backfilled.
 */
export function followChangeForVote(adding: boolean, itemStatus: string | null): 'follow' | 'unfollow' | 'none' {
  if (adding) return 'follow'
  return itemStatus === 'radar' ? 'unfollow' : 'none'
}

// GET /api/wishlist/votes?ids=… — the cap is shared with the client batcher
// (components/wishlist/vote-state.ts), which splits bigger batches into chunks.
export const VOTE_IDS_MAX = 50

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Parse the comma-separated `ids` param: UUIDs only, deduped, capped at VOTE_IDS_MAX. */
export function parseVoteIds(param: string | null): string[] {
  const ids = new Set<string>()
  for (const raw of (param ?? '').split(',')) {
    const id = raw.trim()
    if (UUID_RE.test(id)) ids.add(id)
    if (ids.size === VOTE_IDS_MAX) break
  }
  return [...ids]
}

export function getBuyLabel(store: string | null, customName: string | null): string {
  if (!store) return 'Check Price'
  return `Check Price at ${getStoreLabel(store, customName)}`
}

// Groups items for the public /wishlist page display order
export function groupByStatus(items: WishlistItem[]): Record<WishlistStatus, WishlistItem[]> {
  const groups: Record<WishlistStatus, WishlistItem[]> = {
    testing:     [],
    queued:      [],
    reviewed:    [],
    passed:      [],
  }
  for (const item of items) {
    groups[item.status].push(item)
  }
  // Sort "queued" by estimated_review_date asc
  groups.queued.sort((a, b) => {
    if (!a.estimated_review_date) return 1
    if (!b.estimated_review_date) return -1
    return a.estimated_review_date.localeCompare(b.estimated_review_date)
  })
  return groups
}

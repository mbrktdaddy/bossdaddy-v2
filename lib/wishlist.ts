import { STORE_OPTIONS, getStoreLabel } from '@/lib/products'
import type { ProductStore } from '@/lib/products'

export { STORE_OPTIONS, getStoreLabel }
export type { ProductStore }

// The bench is a view over the products spine in its early lifecycle states.
// 'passed' replaces the former bench-only 'skipped' (unified in migration 100/101).
export type WishlistStatus =
  | 'considering'
  | 'queued'
  | 'testing'
  | 'reviewed'
  | 'passed'

export const WISHLIST_STATUS_OPTIONS: { value: WishlistStatus; label: string; color: string }[] = [
  { value: 'considering', label: 'Considering',  color: 'text-accent' },
  { value: 'queued',      label: 'Coming Soon',  color: 'text-blue-700' },
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

export function getBuyLabel(store: string | null, customName: string | null): string {
  if (!store) return 'Check Price'
  return `Check Price at ${getStoreLabel(store, customName)}`
}

// Groups items for the public /wishlist page display order
export function groupByStatus(items: WishlistItem[]): Record<WishlistStatus, WishlistItem[]> {
  const groups: Record<WishlistStatus, WishlistItem[]> = {
    testing:     [],
    queued:      [],
    considering: [],
    reviewed:    [],
    passed:      [],
  }
  for (const item of items) {
    groups[item.status].push(item)
  }
  // Sort "considering" by vote_count desc
  groups.considering.sort((a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0))
  // Sort "queued" by estimated_review_date asc
  groups.queued.sort((a, b) => {
    if (!a.estimated_review_date) return 1
    if (!b.estimated_review_date) return -1
    return a.estimated_review_date.localeCompare(b.estimated_review_date)
  })
  return groups
}

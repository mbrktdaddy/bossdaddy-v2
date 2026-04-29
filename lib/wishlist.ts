import { STORE_OPTIONS, getStoreLabel } from '@/lib/products'
import type { ProductStore } from '@/lib/products'

export { STORE_OPTIONS, getStoreLabel }
export type { ProductStore }

export type WishlistStatus =
  | 'considering'
  | 'queued'
  | 'testing'
  | 'reviewed'
  | 'skipped'

export const WISHLIST_STATUS_OPTIONS: { value: WishlistStatus; label: string; color: string }[] = [
  { value: 'considering', label: 'Considering',  color: 'text-orange-400' },
  { value: 'queued',      label: 'Coming Soon',  color: 'text-blue-400' },
  { value: 'testing',     label: 'Testing Now',  color: 'text-green-400' },
  { value: 'reviewed',    label: 'Reviewed',     color: 'text-orange-500' },
  { value: 'skipped',     label: 'Not Testing',  color: 'text-zinc-500' },
]

export interface WishlistItem {
  id: string
  slug: string
  title: string
  description: string | null
  image_url: string | null
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
    skipped:     [],
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

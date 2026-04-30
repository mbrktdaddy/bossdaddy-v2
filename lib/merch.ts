export type MerchCategory =
  | 'apparel'
  | 'drinkware'
  | 'accessories'
  | 'stickers'
  | 'other'

export type MerchStatus =
  | 'concept'
  | 'coming_soon'
  | 'available'
  | 'sold_out'
  | 'discontinued'

export interface Merch {
  id: string
  slug: string
  name: string
  description: string | null
  price_cents: number | null
  image_url: string | null
  category: MerchCategory | null
  status: MerchStatus
  external_url: string | null
  position: number
  created_at: string
  updated_at: string
}

export const MERCH_CATEGORIES: { slug: MerchCategory; label: string; icon: string }[] = [
  { slug: 'apparel',     label: 'Apparel',     icon: '👕' },
  { slug: 'drinkware',   label: 'Drinkware',   icon: '🥤' },
  { slug: 'accessories', label: 'Accessories', icon: '🧰' },
  { slug: 'stickers',    label: 'Stickers',    icon: '🏷️' },
  { slug: 'other',       label: 'Other',       icon: '📦' },
]

export const MERCH_STATUSES: { value: MerchStatus; label: string; publiclyVisible: boolean }[] = [
  { value: 'concept',       label: 'Concept (hidden)',      publiclyVisible: false },
  { value: 'coming_soon',   label: 'Coming soon',           publiclyVisible: true  },
  { value: 'available',     label: 'Available',             publiclyVisible: true  },
  { value: 'sold_out',      label: 'Sold out (hidden)',     publiclyVisible: false },
  { value: 'discontinued',  label: 'Discontinued (hidden)', publiclyVisible: false },
]

export function formatPrice(cents: number | null): string {
  if (cents == null) return ''
  return `$${(cents / 100).toFixed(2)}`
}

export function getMerchCategoryBySlug(slug: string) {
  return MERCH_CATEGORIES.find((c) => c.slug === slug)
}

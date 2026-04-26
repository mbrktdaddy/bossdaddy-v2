export type ShopProductCategory =
  | 'apparel'
  | 'drinkware'
  | 'accessories'
  | 'stickers'
  | 'other'

export type ShopProductStatus =
  | 'concept'
  | 'coming_soon'
  | 'available'
  | 'sold_out'
  | 'discontinued'

export interface ShopProduct {
  id: string
  slug: string
  name: string
  description: string | null
  price_cents: number | null
  image_url: string | null
  category: ShopProductCategory | null
  status: ShopProductStatus
  external_url: string | null
  position: number
  created_at: string
  updated_at: string
}

export const SHOP_CATEGORIES: { slug: ShopProductCategory; label: string; icon: string }[] = [
  { slug: 'apparel',     label: 'Apparel',     icon: '👕' },
  { slug: 'drinkware',   label: 'Drinkware',   icon: '🥤' },
  { slug: 'accessories', label: 'Accessories', icon: '🧰' },
  { slug: 'stickers',    label: 'Stickers',    icon: '🏷️' },
  { slug: 'other',       label: 'Other',       icon: '📦' },
]

export const SHOP_STATUSES: { value: ShopProductStatus; label: string; publiclyVisible: boolean }[] = [
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

export function getShopCategoryBySlug(slug: string) {
  return SHOP_CATEGORIES.find((c) => c.slug === slug)
}

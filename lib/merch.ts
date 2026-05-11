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

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'fulfilled'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

export interface Merch {
  id: string
  slug: string
  name: string
  description: string | null
  price_cents: number | null
  image_url: string | null
  default_image_url: string | null
  category: MerchCategory | null
  status: MerchStatus
  featured: boolean
  external_url: string | null
  printful_sync_product_id: number | null
  currency: string
  archived_at: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface MerchVariant {
  id: string
  merch_id: string
  printful_variant_id: number | null
  printful_sync_variant_id: number | null
  size: string | null
  color: string | null
  retail_price_cents: number
  weight_g: number | null
  image_url: string | null
  in_stock: boolean
  position: number
  created_at: string
  updated_at: string
}

export interface Cart {
  id: string
  user_id: string | null
  anon_session_id: string | null
  created_at: string
  updated_at: string
}

export interface CartItem {
  id: string
  cart_id: string
  merch_id: string
  variant_id: string
  qty: number
  created_at: string
  updated_at: string
}

export interface CartItemWithDetails extends CartItem {
  merch: Pick<Merch, 'id' | 'slug' | 'name' | 'image_url' | 'default_image_url'>
  variant: MerchVariant
}

export interface ShippingAddress {
  name: string
  address1: string
  address2?: string
  city: string
  state: string
  state_code: string
  zip: string
  country: string
  country_code: string
}

export interface Order {
  id: string
  order_number: string
  user_id: string | null
  email: string
  status: OrderStatus
  stripe_session_id: string | null
  stripe_payment_intent_id: string | null
  printful_order_id: number | null
  subtotal_cents: number
  shipping_cents: number
  tax_cents: number
  total_cents: number
  currency: string
  shipping_address: ShippingAddress
  tracking_url: string | null
  tracking_number: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  merch_id: string
  variant_id: string
  qty: number
  unit_price_cents: number
  name_snapshot: string
  image_snapshot_url: string | null
  created_at: string
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

export const ORDER_STATUSES: { value: OrderStatus; label: string; terminal: boolean }[] = [
  { value: 'pending',   label: 'Pending',   terminal: false },
  { value: 'paid',      label: 'Paid',      terminal: false },
  { value: 'fulfilled', label: 'Fulfilled', terminal: false },
  { value: 'shipped',   label: 'Shipped',   terminal: false },
  { value: 'delivered', label: 'Delivered', terminal: true  },
  { value: 'cancelled', label: 'Cancelled', terminal: true  },
  { value: 'refunded',  label: 'Refunded',  terminal: true  },
]

export function formatPrice(cents: number | null): string {
  if (cents == null) return ''
  return `$${(cents / 100).toFixed(2)}`
}

export function getMerchCategoryBySlug(slug: string) {
  return MERCH_CATEGORIES.find((c) => c.slug === slug)
}

export function getMerchDisplayImage(merch: Pick<Merch, 'image_url' | 'default_image_url'>): string | null {
  return merch.default_image_url ?? merch.image_url ?? null
}

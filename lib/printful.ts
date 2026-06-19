// Server-only. Never import from client components.

const BASE_URL = 'https://api.printful.com'

function getHeaders() {
  const key = process.env.PRINTFUL_API_KEY
  if (!key) throw new Error('PRINTFUL_API_KEY is not set')
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getHeaders(),
    body: body != null ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Printful ${method} ${path} → ${res.status}: ${text}`)
  }
  const json = await res.json()
  return json.result as T
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PrintfulSyncProduct {
  id: number
  name: string
  thumbnail_url: string
  variants: number
  synced: number
}

export interface PrintfulSyncVariant {
  id: number
  variant_id: number
  name: string
  synced: boolean
  retail_price: string  // e.g. "28.00"
  currency: string
  is_ignored: boolean
  sku: string | null
  files: Array<{ type: string; preview_url: string }>
}

export interface PrintfulSyncProductDetail {
  sync_product: PrintfulSyncProduct & { external_id: string }
  sync_variants: PrintfulSyncVariant[]
}

export interface PrintfulShippingRate {
  id: string
  name: string
  rate: string
  currency: string
  minDeliveryDays: number
  maxDeliveryDays: number
}

export interface PrintfulOrderRecipient {
  name: string
  address1: string
  city: string
  state_code: string
  country_code: string
  zip: string
  email: string
}

export interface PrintfulOrderPayload {
  external_id: string
  shipping: string  // Printful rate ID, e.g. "STANDARD"
  recipient: PrintfulOrderRecipient
  items: Array<{
    sync_variant_id: number
    quantity: number
    retail_price: string
  }>
}

export interface PrintfulOrder {
  id: number
  status: string
  shipping: string
  shipping_service_name: string
  created: number
  updated: number
  recipient: PrintfulOrderRecipient
  items: Array<{ sync_variant_id: number; quantity: number }>
  costs: {
    currency: string
    subtotal: string
    shipping: string
    tax: string
    total: string
  }
}

// ─── API calls ───────────────────────────────────────────────────────────────

export function getSyncProducts(): Promise<PrintfulSyncProduct[]> {
  return request<PrintfulSyncProduct[]>('GET', '/store/products')
}

export function getSyncProductDetail(productId: number | bigint): Promise<PrintfulSyncProductDetail> {
  return request<PrintfulSyncProductDetail>('GET', `/store/products/${productId}`)
}

export function getShippingRates(payload: {
  recipient: Pick<PrintfulOrderRecipient, 'address1' | 'city' | 'state_code' | 'country_code' | 'zip'>
  items: Array<{ variant_id: number; quantity: number }>
  currency?: string
}): Promise<PrintfulShippingRate[]> {
  return request<PrintfulShippingRate[]>('POST', '/shipping/rates', payload)
}

export function createOrder(payload: PrintfulOrderPayload, confirm = false): Promise<PrintfulOrder> {
  return request<PrintfulOrder>('POST', confirm ? '/orders?confirm=true' : '/orders', payload)
}

export function confirmOrder(printfulOrderId: number | bigint): Promise<PrintfulOrder> {
  return request<PrintfulOrder>('POST', `/orders/${printfulOrderId}/confirm`)
}

export function getOrder(printfulOrderId: number | bigint): Promise<PrintfulOrder> {
  return request<PrintfulOrder>('GET', `/orders/${printfulOrderId}`)
}

// Cancels an order in Printful. Only succeeds while the order hasn't entered
// fulfillment — Printful returns an error once it's been picked up for
// production, so callers should treat failure as non-fatal (the refund still
// stands; the product may simply already be on its way).
export function deleteOrder(printfulOrderId: number | bigint): Promise<unknown> {
  return request<unknown>('DELETE', `/orders/${printfulOrderId}`)
}

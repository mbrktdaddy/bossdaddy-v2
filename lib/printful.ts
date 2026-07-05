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

// ─── Catalog (blank products we design onto) ─────────────────────────────────

export interface PrintfulCatalogProduct {
  id: number
  type: string
  brand: string | null
  model: string
  title: string
  description: string
  variant_count: number
}

export interface PrintfulCatalogVariant {
  id: number          // this is the variant_id used when creating sync variants
  product_id: number
  name: string
  size: string
  color: string
  color_code: string | null
  in_stock?: boolean
}

// Print placement / print-area info for a catalog product, used to size print
// files correctly. Shape varies by product; we read what we need defensively.
export interface PrintfulPrintfileInfo {
  product_id: number
  available_placements: Record<string, string>
  printfiles: Array<{ printfile_id: number; width: number; height: number; dpi: number }>
  variant_printfiles: Array<{ variant_id: number; placements: Record<string, number> }>
}

// Full catalog list (large — ~300+ blanks). Prefer getCatalogProduct once IDs
// are pinned in lib/merch/printful-catalog.ts.
export function getCatalogProducts(): Promise<PrintfulCatalogProduct[]> {
  return request<PrintfulCatalogProduct[]>('GET', '/products')
}

// A catalog product plus all its variants. Result shape: { product, variants }.
export function getCatalogProduct(
  productId: number,
): Promise<{ product: PrintfulCatalogProduct; variants: PrintfulCatalogVariant[] }> {
  return request<{ product: PrintfulCatalogProduct; variants: PrintfulCatalogVariant[] }>(
    'GET',
    `/products/${productId}`,
  )
}

export function getPrintfileInfo(productId: number): Promise<PrintfulPrintfileInfo> {
  return request<PrintfulPrintfileInfo>('GET', `/mockup-generator/printfiles/${productId}`)
}

// ─── File library ────────────────────────────────────────────────────────────

export interface PrintfulFile {
  id: number
  type: string
  url: string
  status: string      // 'ok' | 'waiting' | 'failed'
  preview_url: string
}

// Upload a print file to the store's file library by URL. Printful fetches the
// URL server-side, so it MUST be publicly reachable (hence the merch-designs
// bucket, not the admin-gated /api/merch/render endpoint).
export function uploadFile(url: string, filename?: string): Promise<PrintfulFile> {
  return request<PrintfulFile>('POST', '/files', { url, ...(filename ? { filename } : {}) })
}

// ─── Sync product creation ───────────────────────────────────────────────────

export interface CreateSyncVariant {
  variant_id: number        // catalog variant id (from getCatalogProduct)
  retail_price: string      // e.g. "28.00"
  files: Array<{ type?: string; url: string }>  // type defaults to 'default' placement
}

export interface CreateSyncProductPayload {
  sync_product: {
    name: string
    thumbnail?: string
    external_id?: string
  }
  sync_variants: CreateSyncVariant[]
}

// POST /store/products returns the created sync product SUMMARY at the top level
// of `result` (i.e. { id, external_id, ... }) — NOT the { sync_product,
// sync_variants } detail shape that the GET endpoint returns. Type it accordingly
// so callers read `.id` directly.
export interface CreatedSyncProduct {
  id: number
  external_id: string
  name: string
}

// Creates a store sync product from our print file(s). It lands as a draft in the
// Printful store; `merch:sync` then pulls it into the merch/merch_variants tables
// and the operator flips it live.
export function createSyncProduct(
  payload: CreateSyncProductPayload,
): Promise<CreatedSyncProduct> {
  return request<CreatedSyncProduct>('POST', '/store/products', payload)
}

// ─── Mockup generator ────────────────────────────────────────────────────────

export interface MockupTask {
  task_key: string
  status: 'pending' | 'completed' | 'failed'
}

export interface MockupResult extends MockupTask {
  mockups?: Array<{
    placement: string
    variant_ids: number[]
    mockup_url: string
    extra?: Array<{ url: string; option: string; title: string }>
  }>
  error?: string
}

// Kick off a mockup render for a catalog product. Async — returns a task_key you
// then poll with getMockupTask. `files[].image_url` must be publicly reachable.
export function createMockupTask(
  productId: number,
  payload: {
    variant_ids: number[]
    format?: 'jpg' | 'png'
    files: Array<{ placement: string; image_url: string }>
  },
): Promise<MockupTask> {
  return request<MockupTask>('POST', `/mockup-generator/create-task/${productId}`, {
    format: 'jpg',
    ...payload,
  })
}

export function getMockupTask(taskKey: string): Promise<MockupResult> {
  return request<MockupResult>('GET', `/mockup-generator/task?task_key=${encodeURIComponent(taskKey)}`)
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

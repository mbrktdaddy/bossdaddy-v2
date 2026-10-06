import type { SupabaseClient } from '@supabase/supabase-js'
import { LABELS } from '@/lib/labels'

export type ProductStore =
  | 'amazon' | 'walmart' | 'target' | 'costco' | 'sams-club'
  | 'home-depot' | 'lowes' | 'menards' | 'ace-hardware' | 'best-buy'
  | 'rei' | 'dicks' | 'bass-pro' | 'buckle' | 'kohls' | 'other'

export const STORE_OPTIONS: { value: ProductStore; label: string }[] = [
  // Major online / general retail
  { value: 'amazon',    label: 'Amazon' },
  { value: 'walmart',   label: 'Walmart' },
  { value: 'target',    label: 'Target' },
  { value: 'costco',    label: 'Costco' },
  { value: 'sams-club', label: "Sam's Club" },
  { value: 'best-buy',  label: 'Best Buy' },
  { value: 'kohls',     label: "Kohl's" },
  // Home improvement
  { value: 'home-depot',   label: 'Home Depot' },
  { value: 'lowes',        label: "Lowe's" },
  { value: 'menards',      label: 'Menards' },
  { value: 'ace-hardware', label: 'Ace Hardware' },
  // Outdoor / sporting
  { value: 'rei',       label: 'REI' },
  { value: 'dicks',     label: "Dick's Sporting Goods" },
  { value: 'bass-pro',  label: 'Bass Pro Shops' },
  // Apparel
  { value: 'buckle', label: 'Buckle' },
  // Fallback
  { value: 'other', label: 'Other / Unlisted' },
]

export function getStoreLabel(store: string, customName?: string | null): string {
  if (store === 'other') return customName?.trim() || 'the store'
  return STORE_OPTIONS.find((s) => s.value === store)?.label ?? store
}

// Status values are stable (DB column products.status); display labels via lib/labels.
// Lifecycle v2 (mig 158): catalog (private, no claim — the default) | radar
// (mig 157) → queued → testing → reviewed (set by a DB trigger when the review
// is approved), or passed / archived. 'considering' was retired into radar.
export type ProductStatus =
  | 'catalog'
  | 'radar'
  | 'queued'
  | 'testing'
  | 'reviewed'
  | 'passed'
  | 'archived'

// Admin labels. The bench pair matches the public vocabulary in lib/wishlist.ts,
// so the word you pick here is the word readers see.
export const PRODUCT_STATUS_OPTIONS: { value: ProductStatus; label: string }[] = [
  { value: 'catalog',     label: 'Catalog' },
  { value: 'radar',       label: LABELS.radar.full },
  { value: 'queued',      label: 'Up Next' },
  { value: 'testing',     label: 'Testing Now' },
  { value: 'reviewed',    label: 'Reviewed' },
  { value: 'passed',      label: 'Passed' },
  { value: 'archived',    label: 'Archived' },
]

// Mirrors the products_radar_take_length CHECK (mig 157). Here, not in
// lib/products/schema.ts, so the client form can read it without pulling zod.
export const RADAR_TAKE_MAX = 600

/**
 * A Radar item whose spotted_at is still in the future: scheduled, not live.
 * spotted_at doubles as the release time (mig 157), so public Radar queries
 * filter `spotted_at <= now()` and this is the same test in app code.
 */
export function isRadarScheduled(
  p: Pick<Product, 'status' | 'spotted_at'>,
  now: number = Date.now(),
): boolean {
  return p.status === 'radar' && !!p.spotted_at && new Date(p.spotted_at).getTime() > now
}

// "How I got it" (mig 158). Blank = no claim, the default: showcasing a product
// claims nothing. provided / loaner are a material connection, so they render
// the FTC disclosure wherever the product is reviewed or recommended.
export type ProductAcquisition = 'purchased' | 'provided' | 'loaner'

export const ACQUISITION_OPTIONS: { value: ProductAcquisition; label: string }[] = [
  { value: 'purchased', label: 'Bought it' },
  { value: 'provided',  label: 'Brand provided it' },
  { value: 'loaner',    label: 'Loaner (sent back)' },
]

/** What a product card may say about the product. Only claims the operator set. */
export interface ProductClaims {
  /** The stage claim, when the stage makes one. Never a disclaimer. */
  stage: { status: 'queued' | 'testing' | 'reviewed'; label: string } | null
  /** "Bought it", only when set. */
  bought: boolean
  /** The legally required material-connection line, or null. */
  disclosure: string | null
}

const STAGE_CLAIMS = new Set<ProductStatus>(['queued', 'testing', 'reviewed'])

/**
 * The ONE place that decides what a product card claims (brand-guide §1.9).
 *
 * Showcasing claims nothing. A product says Up Next / Testing Now / Reviewed or
 * "Bought it" only because the operator set its stage or "How I got it". No
 * default disclaimers ("not tested", "owner pick"). The one automatic claim is
 * legal: a provided or loaned unit gets its disclosure.
 */
export function productClaims(
  p: Pick<Product, 'status' | 'acquisition' | 'provided_by' | 'brand'>,
): ProductClaims {
  const stage = STAGE_CLAIMS.has(p.status)
    ? {
        status: p.status as 'queued' | 'testing' | 'reviewed',
        label: PRODUCT_STATUS_OPTIONS.find((o) => o.value === p.status)!.label,
      }
    : null
  return { stage, bought: p.acquisition === 'purchased', disclosure: acquisitionDisclosure(p) }
}

/** The material-connection disclosure for a provided or loaned unit, else null. */
export function acquisitionDisclosure(
  p: Pick<Product, 'acquisition' | 'provided_by' | 'brand'>,
): string | null {
  if (p.acquisition !== 'provided' && p.acquisition !== 'loaner') return null
  const who = p.provided_by?.trim() || p.brand?.trim() || 'The brand'
  const how = p.acquisition === 'loaner'
    ? `${who} loaned me this for testing, and it's been sent back.`
    : `${who} sent me this for testing.`
  return `${how} They didn't pay for coverage, and they didn't see this before it was published.`
}

export type TestingDuration =
  | '<1wk' | '1-4wks' | '1-3mo' | '3+mo'
  | '6mo' | '1yr' | '2yr' | '3yr' | '5yr'
  | 'custom'

export const TESTING_DURATION_OPTIONS: { value: TestingDuration; label: string }[] = [
  { value: '<1wk',   label: 'Less than 1 week' },
  { value: '1-4wks', label: '1–4 weeks' },
  { value: '1-3mo',  label: '1–3 months' },
  { value: '3+mo',   label: '3+ months' },
  { value: '6mo',    label: '6+ months' },
  { value: '1yr',    label: '1 year or more' },
  { value: '2yr',    label: '2 years or more' },
  { value: '3yr',    label: '3 years or more' },
  { value: '5yr',    label: '5+ years' },
  { value: 'custom', label: 'Specific date / note…' },
]

/** A single spec fact: a human label and its value (e.g. { label: 'Weight', value: '2.1 lbs' }). */
export interface ProductSpec {
  label: string
  value: string
}

export interface Product {
  id: string
  slug: string
  name: string
  brand: string | null
  specs: ProductSpec[]
  asin: string | null
  affiliate_url: string | null
  non_affiliate_url: string | null
  store: string
  custom_store_name: string | null
  image_url: string | null
  description: string | null
  category: string | null
  price_cents: number | null
  status: ProductStatus
  // Bench fields (folded in from the former wishlist_items table).
  priority: number
  review_id: string | null
  skip_reason: string | null
  estimated_review_date: string | null
  gallery_images: string[]
  // How I got it (mig 158). null = no claim.
  acquisition: ProductAcquisition | null
  provided_by: string | null
  // On the Radar (mig 157). Both are kept after the product moves on, so the
  // /gear/radar archive can show what was said and when.
  radar_take: string | null
  spotted_at: string | null
  // Provenance: 'hand' | 'pa_api' | 'adopted_from_research'.
  source: string
  created_at: string
  updated_at: string
}

const TOKEN_REGEX = /\[\[BUY:([a-z0-9-]+)\]\]/g

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPE_MAP[c])
}

export async function getProductBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()
  if (error) {
    console.error('getProductBySlug failed:', error)
    return null
  }
  return (data as Product | null) ?? null
}

/** Fetch multiple products by slug in one round-trip. Order is not guaranteed. */
export async function getProductsBySlugs(
  supabase: SupabaseClient,
  slugs: string[],
): Promise<Product[]> {
  const unique = [...new Set(slugs.filter(Boolean))]
  if (unique.length === 0) return []
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('slug', unique)
  if (error) {
    console.error('getProductsBySlugs failed:', error)
    return []
  }
  return ((data ?? []) as unknown as Product[])
}

/** One column of a spec-comparison table — a product plus presentation hints. */
export interface SpecComparisonColumn {
  slug: string
  name: string
  brand: string | null
  imageUrl?: string | null
  /** Link target for the column header (review or product page). */
  href?: string | null
  /** Highlight this column — the review's own product among its competitors. */
  isPrimary?: boolean
  specs: ProductSpec[]
}

/** One row of the matrix: a label and its value per column (null = missing). */
export interface SpecComparisonRow {
  label: string
  values: (string | null)[]
}

/**
 * Build a ragged-safe comparison matrix from N product spec lists.
 *
 * - Rows are the UNION of all spec labels across columns, matched
 *   case-insensitively AND whitespace-insensitively (label 'Weight', 'weight',
 *   and 'Weight ' / 'Battery  life' all collapse to one row); the first-seen
 *   casing wins as the display label.
 * - Row order follows first appearance across the columns in order.
 * - Missing cells are `null` so the renderer can show a placeholder — older
 *   products with `specs: []` simply contribute no rows and read as "—".
 * - Values are returned verbatim. Specs are free text with no unit
 *   normalization, so magnitudes are NOT assumed comparable — display as-is.
 * - No HTML escaping here: callers render values as React text children, which
 *   React escapes. (If a caller ever builds raw HTML, it must escape like
 *   `resolveProductTokens` does.)
 */
export function buildSpecComparison(columns: SpecComparisonColumn[]): SpecComparisonRow[] {
  const order: string[] = []                            // lowercased keys, first-seen order
  const display = new Map<string, string>()             // key → display label
  const byKey = new Map<string, Map<number, string>>()  // key → (colIdx → value)

  columns.forEach((col, idx) => {
    for (const spec of Array.isArray(col.specs) ? col.specs : []) {
      const label = spec?.label?.trim()
      const value = spec?.value?.trim()
      if (!label || !value) continue
      const key = label.toLowerCase().replace(/\s+/g, ' ')
      if (!display.has(key)) {
        display.set(key, label)
        order.push(key)
        byKey.set(key, new Map())
      }
      const cell = byKey.get(key)!
      if (!cell.has(idx)) cell.set(idx, value)  // first non-empty value per cell wins
    }
  })

  return order.map((key) => ({
    label: display.get(key)!,
    values: columns.map((_, idx) => byKey.get(key)!.get(idx) ?? null),
  }))
}

/** Does a column carry at least one non-empty spec? */
export function columnHasSpecs(col: SpecComparisonColumn): boolean {
  return (Array.isArray(col.specs) ? col.specs : []).some((s) => s?.label?.trim() && s?.value?.trim())
}

/**
 * A spec table is only worth rendering when at least TWO columns each carry
 * real specs — otherwise it's a single product (nothing to compare) or a lone
 * spec'd product next to all-"—" columns (reads worse than no table). Specs are
 * optional everywhere; this keeps sparse/absent data from producing an
 * embarrassing table. Callers gate both the section and any TOC entry on this.
 */
export function specComparisonRenderable(columns: SpecComparisonColumn[]): boolean {
  return columns.filter(columnHasSpecs).length >= 2
}

/**
 * Replace every `[[BUY:slug]]` token in the input HTML with an affiliate anchor.
 *
 * - Amazon URL present → `<a href="…" rel="sponsored nofollow noopener" target="_blank">{name} on Amazon</a>`
 * - Non-affiliate URL only → `<a href="…" target="_blank">{name}</a>` (no sponsored/nofollow)
 * - Unknown slug or no URL → `<span class="bd-link-missing" data-slug="…">[link missing: …]</span>`
 *
 * Runs at save time, before sanitizeHtml. Unknown slugs surface as visible
 * warnings so editors catch mistakes instead of silent drops.
 */
export async function resolveProductTokens(
  html: string,
  supabase: SupabaseClient,
): Promise<string> {
  const slugs = new Set<string>()
  for (const m of html.matchAll(TOKEN_REGEX)) slugs.add(m[1])
  if (slugs.size === 0) return html

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .in('slug', Array.from(slugs))

  if (error) {
    console.error('resolveProductTokens lookup failed:', error)
  }

  const bySlug = new Map<string, Product>()
  for (const row of (data ?? []) as Product[]) bySlug.set(row.slug, row)

  return html.replace(TOKEN_REGEX, (_, slug: string) => {
    const product = bySlug.get(slug)
    if (!product) {
      return `<span class="bd-link-missing" data-slug="${escapeHtml(slug)}">[link missing: ${escapeHtml(slug)}]</span>`
    }

    if (product.affiliate_url) {
      const storeLabel = getStoreLabel(product.store, product.custom_store_name)
      return `<a href="/go/${escapeHtml(product.slug)}" rel="sponsored nofollow noopener" target="_blank" data-product-slug="${escapeHtml(product.slug)}">${escapeHtml(product.name)} on ${escapeHtml(storeLabel)}</a>`
    }

    if (product.non_affiliate_url) {
      return `<a href="${escapeHtml(product.non_affiliate_url)}" target="_blank" data-product-slug="${escapeHtml(product.slug)}">${escapeHtml(product.name)}</a>`
    }

    return `<span class="bd-link-missing" data-slug="${escapeHtml(slug)}">[link missing: ${escapeHtml(slug)}]</span>`
  })
}

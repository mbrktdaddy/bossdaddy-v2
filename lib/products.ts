import type { SupabaseClient } from '@supabase/supabase-js'

export type ProductStore =
  | 'amazon' | 'walmart' | 'target' | 'kohls'
  | 'home-depot' | 'lowes' | 'menards' | 'other'

export const STORE_OPTIONS: { value: ProductStore; label: string }[] = [
  { value: 'amazon',     label: 'Amazon' },
  { value: 'walmart',    label: 'Walmart' },
  { value: 'target',     label: 'Target' },
  { value: 'kohls',      label: "Kohl's" },
  { value: 'home-depot', label: 'Home Depot' },
  { value: 'lowes',      label: "Lowe's" },
  { value: 'menards',    label: 'Menards' },
  { value: 'other',      label: 'Other / Unlisted' },
]

export function getStoreLabel(store: string, customName?: string | null): string {
  if (store === 'other') return customName?.trim() || 'the store'
  return STORE_OPTIONS.find((s) => s.value === store)?.label ?? store
}

export interface Product {
  id: string
  slug: string
  name: string
  asin: string | null
  affiliate_url: string | null
  non_affiliate_url: string | null
  store: string
  custom_store_name: string | null
  image_url: string | null
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

// Paste-a-link product import (docs/gear-radar-plan.md step 2b).
//
// The admin pastes a product URL; this turns it into suggested form values.
// Nothing here writes to the database. The form fills only EMPTY fields and the
// admin saves deliberately, so an import can never publish anything on its own.
//
// Two sources, in order of trust:
//   1. The page itself, fetched through the hardened link-preview fetcher
//      (SSRF + DNS-rebinding guard, size cap). Retailers and brands publish
//      schema.org Product JSON-LD for Google Shopping, which carries name, brand,
//      image, price, model number (mpn), GTIN and often specs. OpenGraph tags
//      are the fallback.
//   2. A live web lookup (lookupProductFacts), opt-in, for pages we can't read:
//      Amazon above all, whose Associates rules say product details and images
//      come from its own API (PA-API), not from its pages. The lookup returns
//      facts only, never an image.
//
// Retailer description copy is returned as REFERENCE, never as the product's
// description: it's their copyrighted marketing text, and Boss Daddy describes
// products in its own words.

import { z } from 'zod'
import { guardedFetch, resolveRedirects } from '@/lib/link-preview/fetch'
import { decodeEntities, metaContent, parseMetadata } from '@/lib/link-preview/parse'
import { extractAsin, buildAmazonAffiliateUrl } from '@/lib/amazon-tag'
import { aiResearch } from '@/lib/ai/research'
import { dedupeSizeVariants } from '@/lib/images/candidates'
import type { ProductSpec, ProductStore } from '@/lib/products'
import { cleanModelNumber, modelFromSku, modelKey, normalizeGtin, splitIdentifierSpecs } from '@/lib/products/identifiers'

/** Product pages are heavy (inline state, scripts); the DM preview cap is 512KB. */
const MAX_PRODUCT_HTML_BYTES = 4 * 1024 * 1024
const MAX_SPECS = 30
const MAX_REFERENCE = 2000

export interface ProductImport {
  /** The page we actually read (after redirects), tracking params stripped. */
  sourceUrl: string
  store: ProductStore
  customStoreName: string | null
  asin: string | null
  affiliateUrl: string | null
  nonAffiliateUrl: string | null
  name: string | null
  brand: string | null
  imageUrl: string | null
  /**
   * The page's product images in preference order: JSON-LD images, then
   * og:image, then twitter:image. Absolutized against the page URL, http(s)
   * only, decoded, deduped, SVGs dropped, size variants collapsed to the
   * largest, max 10. `imageUrl` is the first.
   */
  imageCandidates: string[]
  /** The retailer's own copy. Reference for the admin — never auto-published. */
  retailerDescription: string | null
  priceCents: number | null
  /** Manufacturer model number (schema.org mpn) — mig 159. */
  modelNumber: string | null
  /** GTIN / UPC / EAN, digits only, check digit verified. */
  gtin: string | null
  specs: ProductSpec[]
  /** Human list of what the import found, for the form's result line. */
  found: string[]
  /** Why something is missing, in plain words. */
  notes: string[]
  /** Offer the web lookup (Amazon, or a page we couldn't read). */
  canLookup: boolean
}

// ─── Store detection ──────────────────────────────────────────────────────────

const STORE_HOSTS: [RegExp, ProductStore][] = [
  [/(^|\.)amazon\.[a-z.]+$/i, 'amazon'],
  [/(^|\.)walmart\.com$/i, 'walmart'],
  [/(^|\.)target\.com$/i, 'target'],
  [/(^|\.)costco\.com$/i, 'costco'],
  [/(^|\.)samsclub\.com$/i, 'sams-club'],
  [/(^|\.)homedepot\.com$/i, 'home-depot'],
  [/(^|\.)lowes\.com$/i, 'lowes'],
  [/(^|\.)menards\.com$/i, 'menards'],
  [/(^|\.)acehardware\.com$/i, 'ace-hardware'],
  [/(^|\.)bestbuy\.com$/i, 'best-buy'],
  [/(^|\.)rei\.com$/i, 'rei'],
  [/(^|\.)dickssportinggoods\.com$/i, 'dicks'],
  [/(^|\.)basspro\.com$/i, 'bass-pro'],
  [/(^|\.)buckle\.com$/i, 'buckle'],
  [/(^|\.)kohls\.com$/i, 'kohls'],
]

/** Stores with no affiliate program: their link belongs in non_affiliate_url. */
const NO_AFFILIATE_PROGRAM = new Set<ProductStore>(['costco', 'sams-club'])

export function detectStore(hostname: string): ProductStore {
  return STORE_HOSTS.find(([re]) => re.test(hostname))?.[1] ?? 'other'
}

/** Amazon short links can't be resolved without fetching Amazon itself. */
export function isAmazonShortLink(hostname: string): boolean {
  return /^(amzn\.to|a\.co|amzn\.com)$/i.test(hostname)
}

/** Drop tracking params so the saved link is the product, not the campaign. */
export function stripTracking(url: string): string {
  try {
    const u = new URL(url)
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|gclid$|fbclid$|msclkid$|mc_|ref$|ref_$|cmpid$|cid$|irclickid$|irgwc$|afsrc$|cm_mmc$|clickid$|affid$|pd_rd_|pf_rd_|content-id$)/i.test(key)) {
        u.searchParams.delete(key)
      }
    }
    u.hash = ''
    return u.toString()
  } catch {
    return url
  }
}

// ─── schema.org Product JSON-LD ───────────────────────────────────────────────

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }
type JsonObject = { [key: string]: Json }

const isObject = (v: Json | undefined): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v)

function text(v: Json | undefined): string | null {
  if (typeof v === 'number') return String(v)
  if (typeof v !== 'string') return null
  const out = decodeEntities(v).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return out || null
}

function typesOf(node: JsonObject): string[] {
  const t = node['@type']
  return (Array.isArray(t) ? t : [t]).filter((x): x is string => typeof x === 'string')
}

/** Every JSON-LD node in the document, flattened through arrays and @graph. */
export function jsonLdNodes(html: string): JsonObject[] {
  const nodes: JsonObject[] = []
  const walk = (v: Json) => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (!isObject(v)) return
    nodes.push(v)
    if (Array.isArray(v['@graph'])) (v['@graph'] as Json[]).forEach(walk)
  }
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      walk(JSON.parse(m[1].trim()) as Json)
    } catch {
      // Malformed JSON-LD is common (trailing commas, raw newlines). Skip the block.
    }
  }
  return nodes
}

/** Every image URL in a schema.org `image` value (string, array, ImageObject). */
function allImages(v: Json | undefined): string[] {
  if (typeof v === 'string') {
    const s = decodeEntities(v).trim()
    return s ? [s] : []
  }
  if (Array.isArray(v)) return v.flatMap((item) => allImages(item))
  if (isObject(v)) {
    const s = text(v.url) ?? text(v.contentUrl)
    return s ? [decodeEntities(s).trim()].filter(Boolean) : []
  }
  return []
}

/** USD price in cents from an Offer, AggregateOffer, or a list of them. */
function priceCentsFrom(v: Json | undefined): number | null {
  const offers = Array.isArray(v) ? v : [v]
  for (const offer of offers) {
    if (!isObject(offer)) continue
    const currency = text(offer.priceCurrency) ?? (isObject(offer.priceSpecification) ? text(offer.priceSpecification.priceCurrency) : null)
    if (currency && currency.toUpperCase() !== 'USD') continue
    const raw = offer.price ?? offer.lowPrice ?? (isObject(offer.priceSpecification) ? offer.priceSpecification.price : undefined)
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw.replace(/[^0-9.]/g, '')) : NaN
    if (Number.isFinite(n) && n > 0) return Math.round(n * 100)
  }
  return null
}

function quantity(v: Json | undefined): string | null {
  if (!isObject(v)) return text(v)
  const value = text(v.value)
  if (!value) return null
  const unit = text(v.unitText) ?? text(v.unitCode)
  return unit ? `${value} ${unit}` : value
}

function pushSpec(specs: ProductSpec[], label: string, value: string | null) {
  if (!value) return
  const l = label.trim().slice(0, 60)
  const val = value.trim().slice(0, 200)
  if (!l || !val) return
  if (specs.some((s) => s.label.toLowerCase() === l.toLowerCase())) return
  if (specs.length < MAX_SPECS) specs.push({ label: l, value: val })
}

export interface JsonLdProduct {
  name: string | null
  brand: string | null
  imageUrl: string | null
  /** Node images, then the first variant's. */
  imageUrls: string[]
  description: string | null
  priceCents: number | null
  modelNumber: string | null
  gtin: string | null
  specs: ProductSpec[]
}

const GTIN_KEYS = ['gtin14', 'gtin13', 'gtin12', 'gtin8', 'gtin'] as const

/**
 * Model number and GTIN from a Product node. The model number prefers mpn, then
 * model (a string or a ProductModel), then a SKU that reads like a model number
 * (modelFromSku: retailer SKUs are their own catalog IDs, not the maker's).
 */
function identifiersOf(node: JsonObject): { modelNumber: string | null; gtin: string | null } {
  const model = isObject(node.model) ? text(node.model.name) : text(node.model)
  const modelNumber = cleanModelNumber(text(node.mpn)) ?? cleanModelNumber(model) ?? modelFromSku(text(node.sku))
  let gtin: string | null = null
  for (const key of GTIN_KEYS) {
    gtin = normalizeGtin(text(node[key]))
    if (gtin) break
  }
  return { modelNumber, gtin }
}

/** The first schema.org Product (or ProductGroup) in the page, or null. */
export function parseJsonLdProduct(html: string): JsonLdProduct | null {
  const node = jsonLdNodes(html).find((n) => typesOf(n).some((t) => t === 'Product' || t === 'ProductGroup'))
  if (!node) return null

  // A ProductGroup carries the shared facts; its first variant carries offers.
  const variants = Array.isArray(node.hasVariant) ? node.hasVariant.filter(isObject) : []
  const variant = variants[0]

  const brand = isObject(node.brand) ? text(node.brand.name) : text(node.brand)
  // Identifiers name ONE item, so a variant's count only when it's the only
  // one: the first of several may be a different color or size than the page.
  const own = identifiersOf(node)
  const only = variants.length === 1 ? identifiersOf(variants[0]) : { modelNumber: null, gtin: null }
  const specs: ProductSpec[] = []
  pushSpec(specs, 'Color', text(node.color))
  pushSpec(specs, 'Material', text(node.material))
  pushSpec(specs, 'Weight', quantity(node.weight))
  for (const prop of Array.isArray(node.additionalProperty) ? node.additionalProperty : []) {
    if (isObject(prop)) pushSpec(specs, text(prop.name) ?? '', quantity(prop.value) ?? text(prop.value))
  }
  // A "Model Number" / "UPC" additionalProperty is an identifier, not a spec.
  const fromSpecs = splitIdentifierSpecs(specs)

  const imageUrls = [...allImages(node.image), ...allImages(variant?.image)]

  return {
    name: text(node.name),
    brand,
    imageUrl: imageUrls[0] ?? null,
    imageUrls,
    description: text(node.description)?.slice(0, MAX_REFERENCE) ?? null,
    priceCents: priceCentsFrom(node.offers) ?? priceCentsFrom(variant?.offers),
    modelNumber: own.modelNumber ?? only.modelNumber ?? fromSpecs.modelNumber,
    gtin: own.gtin ?? only.gtin ?? fromSpecs.gtin,
    specs: fromSpecs.specs,
  }
}

/**
 * A product name as the site should print it: no ® ™ ℠ ©, no "(R)" / "(TM)"
 * glued to a word, and no footnote asterisks ("20V MAX*" points at a legal
 * footnote on the maker's page that the site doesn't carry).
 */
export function cleanProductName(name: string): string {
  return name
    .replace(/[\u00AE\u2122\u2120\u00A9]/g, '')
    .replace(/(?<=\w)\((?:R|TM)\)/gi, '')
    .replace(/(?<=\S)\*+(?=\s|$|[),.;:])/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** og:title / <title> often end in " | Walmart.com" — drop the site suffix. */
export function stripSiteSuffix(title: string, siteName: string | null): string {
  const parts = title.split(/\s+[|\-–—:]\s+/)
  if (parts.length < 2) return title
  const last = parts[parts.length - 1].toLowerCase()
  const site = siteName?.toLowerCase() ?? ''
  if ((site && last.includes(site.replace(/\.com$/, ''))) || /\.(com|net|org|co)$/.test(last)) {
    return parts.slice(0, -1).join(' - ').trim()
  }
  return title
}

function absolutize(maybeRelative: string | null, base: string): string | null {
  if (!maybeRelative) return null
  try {
    const u = new URL(maybeRelative, base)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

/**
 * Image URLs written into the page itself that name the model number
 * (…/DCD801B_1_1680.webp). Structured data can go stale — dewalt.com's points
 * at a deleted DCD801B_1.jpg while the page shows the _1680.webp — so these
 * are the fallback candidates. Without a model number there's no safe way to
 * tell the product's photos from logos and banners, so none are taken.
 */
export function pageImagesNaming(html: string, modelNumber: string | null, pageUrl: string): string[] {
  const model = modelNumber ? modelKey(modelNumber) : ''
  if (model.length < 4) return []
  // Inline scripts escape slashes (https:\/\/cdn…\/a.jpg); undo it so they match.
  const text = html.replace(/\\\//g, '/')
  // Cap AFTER collapsing sizes: pages list each image at several sizes
  // (_400/_800/_1680), and a raw cap filled up with two or three shots while
  // the feature graphics further down never made the list. The raw cap only
  // bounds the work on a huge page.
  const out: string[] = []
  const take = (url: string | null) => {
    if (url && out.length < 80 && modelKey(url).includes(model) && !out.includes(url)) out.push(url)
  }
  // Absolute and protocol-relative URLs anywhere in the page (markup, JSON, scripts).
  for (const m of text.matchAll(/(?<![\w:/.-])(?:https?:)?\/\/[^\s"'<>()\\]+?\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'<>()\\]*)?/gi)) {
    take(absolutizeImage(decodeEntities(m[0]), pageUrl))
  }
  // Root/relative paths only make sense inside attribute values.
  for (const m of text.matchAll(/\b(?:src|srcset|data-src|data-srcset|href|content)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const value = m[1] ?? m[2] ?? ''
    // srcset entries are "url descriptor" pairs separated by commas.
    for (const part of value.split(',')) {
      const candidate = decodeEntities(part.trim().split(/\s+/)[0] ?? '')
      if (/\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(candidate)) take(absolutizeImage(candidate, pageUrl))
    }
  }
  return dedupeSizeVariants(out).slice(0, 8)
}

/** Resolve an image reference against the page; protocol-relative means https. */
function absolutizeImage(ref: string, pageUrl: string): string | null {
  return absolutize(ref.startsWith('//') ? `https:${ref}` : ref, pageUrl)
}

// ─── Shopify ──────────────────────────────────────────────────────────────────
// Shopify storefronts publish every product as public JSON at /products/<handle>.js
// — photos, and a SKU/barcode per variant — which is far more reliable than
// scraping the theme's markup.

export interface ShopifyProduct {
  name: string | null
  brand: string | null
  imageUrls: string[]
  modelNumber: string | null
  gtin: string | null
  priceCents: number | null
}

/** `${origin}/products/<handle>.js` when this is a Shopify product page, else null. */
export function shopifyProductJsUrl(pageUrl: string, html: string): string | null {
  if (!/cdn\.shopify\.com|Shopify\.theme/.test(html)) return null
  try {
    const u = new URL(pageUrl)
    const m = u.pathname.match(/\/products\/([^/?#]+)/)
    const handle = m?.[1]?.replace(/\.(?:js|json|html?)$/i, '')
    return handle ? `${u.origin}/products/${handle}.js` : null
  } catch {
    return null
  }
}

/**
 * Shopify's `/products/<handle>.js` JSON. Identifiers and price come from ONE
 * variant — the one named by `?variant=`, or the only one — because a SKU or
 * barcode from the wrong variant would pin the wrong product.
 */
export function parseShopifyProduct(data: unknown, variantId: string | null): ShopifyProduct | null {
  if (!data || typeof data !== 'object') return null
  const d = data as Record<string, unknown>
  if (typeof d.title !== 'string' || !Array.isArray(d.variants)) return null

  const imageUrls = (Array.isArray(d.images) ? d.images : [])
    .filter((i): i is string => typeof i === 'string')
    .map((i) => (i.startsWith('//') ? `https:${i}` : i))
    .filter((i) => /^https?:\/\//i.test(i))

  const variants = d.variants.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
  const variant = variantId
    ? variants.find((v) => String(v.id) === variantId)
    : variants.length === 1 ? variants[0] : undefined

  return {
    name: d.title.trim() || null,
    brand: typeof d.vendor === 'string' && d.vendor.trim() ? d.vendor.trim() : null,
    imageUrls,
    modelNumber: typeof variant?.sku === 'string' ? modelFromSku(variant.sku) : null,
    gtin: typeof variant?.barcode === 'string' ? normalizeGtin(variant.barcode) : null,
    priceCents: typeof variant?.price === 'number' && Number.isFinite(variant.price) && variant.price > 0
      ? Math.round(variant.price) : null,
  }
}

/** Turn a fetched product page into suggested form values. Pure — unit-tested. */
export function extractFromHtml(html: string, pageUrl: string, shopify: ShopifyProduct | null = null): Omit<ProductImport, 'store' | 'customStoreName' | 'asin' | 'affiliateUrl' | 'nonAffiliateUrl' | 'canLookup' | 'notes' | 'sourceUrl'> {
  const ld = parseJsonLdProduct(html)
  const og = parseMetadata(html)
  const headEnd = html.search(/<\/head\s*>/i)
  const head = headEnd === -1 ? html : html.slice(0, headEnd)

  const ogPrice = metaContent(head, 'product:price:amount') ?? metaContent(head, 'og:price:amount')
  const ogCurrency = metaContent(head, 'product:price:currency') ?? metaContent(head, 'og:price:currency')
  const ogPriceCents = ogPrice && (!ogCurrency || ogCurrency.toUpperCase() === 'USD')
    ? Math.round(parseFloat(ogPrice.replace(/[^0-9.]/g, '')) * 100) || null
    : null

  const rawName = ld?.name ?? (og.title ? stripSiteSuffix(og.title, og.siteName) : null)
  const pageName = rawName ? cleanProductName(rawName).slice(0, 160) || null : null
  const pageBrand = ld?.brand ?? (metaContent(head, 'product:brand') ? text(metaContent(head, 'product:brand')!) : null)
  const twitterImage = metaContent(head, 'twitter:image')
  const candidatesWith = (shopifyImages: string[]) => dedupeSizeVariants([
    ...new Set(
      [...(ld?.imageUrls ?? []), ...shopifyImages, og.imageUrl, twitterImage, ...pageImagesNaming(html, ld?.modelNumber ?? shopify?.modelNumber ?? null, pageUrl)]
        .map((u) => absolutize(u ? decodeEntities(u).trim() : null, pageUrl))
        .filter((u): u is string => !!u && !/\.svg(?:[?#]|$)/i.test(u)),
    ),
  ]).slice(0, 10)
  const imageCandidates = candidatesWith(shopify?.imageUrls ?? [])
  const imageUrl = imageCandidates[0] ?? null
  const retailerDescription = ld?.description ?? og.description
  const specs = ld?.specs ?? []

  // Shopify's product JSON only fills what the page itself left empty.
  const name = pageName ?? (shopify?.name ? cleanProductName(shopify.name).slice(0, 160) || null : null)
  const brand = pageBrand ?? shopify?.brand ?? null
  const priceCents = ld?.priceCents ?? ogPriceCents ?? shopify?.priceCents ?? null
  const modelNumber = ld?.modelNumber ?? shopify?.modelNumber ?? null
  const gtin = ld?.gtin ?? shopify?.gtin ?? null
  const shopifyHelped = !!shopify && (
    imageCandidates.join('\n') !== candidatesWith([]).join('\n')
    || name !== pageName || brand !== pageBrand || modelNumber !== (ld?.modelNumber ?? null)
    || gtin !== (ld?.gtin ?? null) || priceCents !== (ld?.priceCents ?? ogPriceCents)
  )

  const found: string[] = []
  if (shopifyHelped) found.push('Shopify product data')
  if (name) found.push('name')
  if (brand) found.push('brand')
  if (modelNumber) found.push('model number')
  if (gtin) found.push('GTIN')
  if (imageUrl) found.push('image')
  if (priceCents) found.push('price')
  if (specs.length) found.push(`${specs.length} spec${specs.length === 1 ? '' : 's'}`)
  if (retailerDescription) found.push('retailer description (reference)')

  return { name, brand, imageUrl, imageCandidates, retailerDescription, priceCents, modelNumber, gtin, specs, found }
}

// ─── The import ───────────────────────────────────────────────────────────────

const FETCH_FAILURE_NOTE: Record<string, string> = {
  'blocked':            "That address isn't a public web page.",
  'dns':                "That site doesn't resolve.",
  'timeout':            'The site took too long to answer.',
  'too-large':          'The page is too large to read.',
  'bad-status':         'The site refused the request (many retailers block automated reads).',
  'bad-type':           "That link isn't a web page.",
  'too-many-redirects': 'The link redirects too many times.',
  'network':            "Couldn't reach the site.",
}

export async function importProductFromUrl(rawUrl: string, amazonTag: string): Promise<ProductImport> {
  const url = new URL(rawUrl)
  const store = detectStore(url.hostname)
  const empty: ProductImport = {
    sourceUrl: stripTracking(url.toString()), store, customStoreName: null, asin: null,
    affiliateUrl: null, nonAffiliateUrl: null, name: null, brand: null, imageUrl: null, imageCandidates: [],
    retailerDescription: null, priceCents: null, modelNumber: null, gtin: null, specs: [], found: [], notes: [], canLookup: false,
  }


  // Amazon: the ID and the affiliate link come straight from the URL. Details
  // need PA-API or the web lookup — never a read of Amazon's own page.
  const amazonImport = (amazonUrl: string): ProductImport => {
    const asin = extractAsin(amazonUrl)
    if (!asin) return { ...empty, store: 'amazon', notes: ['No Amazon product ID (ASIN) found in that link.'] }
    const canonical = `https://www.amazon.com/dp/${asin}`
    return {
      ...empty,
      store: 'amazon',
      sourceUrl: canonical,
      asin,
      affiliateUrl: amazonTag ? buildAmazonAffiliateUrl(asin, amazonTag) : null,
      nonAffiliateUrl: amazonTag ? null : canonical,
      found: ['Amazon product ID', amazonTag ? 'affiliate link' : 'product link'],
      notes: ['Amazon details and photos come from its product API (after 3 qualifying sales). Use the web lookup for the facts.'],
      canLookup: true,
    }
  }
  // a.co / amzn.to — what the Amazon app's Share button produces. Follow the
  // redirect headers to the product URL (it carries the ASIN) and stop there:
  // Amazon's page itself is never read.
  if (isAmazonShortLink(url.hostname)) {
    const resolved = await resolveRedirects(url.toString(), (u) => !!extractAsin(u))
    if (!resolved.ok) {
      return { ...empty, store: 'amazon', notes: ["Couldn't open that short Amazon link. Open it in your browser and paste the full product URL (it contains /dp/…)."] }
    }
    return amazonImport(resolved.url)
  }
  if (store === 'amazon') return amazonImport(url.toString())

  const fetched = await guardedFetch(url.toString(), { maxBytes: MAX_PRODUCT_HTML_BYTES, expect: 'html' })
  if (!fetched.ok) {
    const notes = [FETCH_FAILURE_NOTE[fetched.reason] ?? "Couldn't read that page."]
    // A refused address (private network) is never kept as a link.
    if (fetched.reason === 'blocked') return { ...empty, notes, canLookup: false }
    // The page couldn't be read, but the link is still the product's link. Keep
    // it (cleaned) with its store, or a store that blocks reads leaves the
    // product with no buy link at all.
    if (!NO_AFFILIATE_PROGRAM.has(store)) {
      notes.push('Saved as a plain link. Paste your affiliate link for this store when you have one.')
    }
    return {
      ...empty,
      nonAffiliateUrl: empty.sourceUrl,
      customStoreName: store === 'other' ? url.hostname.replace(/^www\./, '') : null,
      notes,
      canLookup: true,
    }
  }

  const finalUrl = stripTracking(fetched.data.url)
  const finalStore = detectStore(new URL(finalUrl).hostname)
  // A brand's "buy" link can redirect to Amazon. Same rule: use the URL, not the page.
  if (finalStore === 'amazon') return amazonImport(finalUrl)
  const html = fetched.data.body.toString('utf8')
  // Shopify stores publish the product as JSON next to the page. Any failure
  // here just leaves the page-only result.
  let shopify: ShopifyProduct | null = null
  const jsUrl = shopifyProductJsUrl(finalUrl, html)
  if (jsUrl) {
    try {
      const res = await guardedFetch(jsUrl, { maxBytes: 1_000_000, expect: 'json' })
      if (res.ok) {
        shopify = parseShopifyProduct(JSON.parse(res.data.body.toString('utf8')), new URL(finalUrl).searchParams.get('variant'))
      }
    } catch {
      shopify = null
    }
  }
  const extracted = extractFromHtml(html, finalUrl, shopify)
  const siteName = parseMetadata(html).siteName

  const notes: string[] = []
  if (!extracted.name) notes.push('No product details on that page — try the web lookup.')
  if (!NO_AFFILIATE_PROGRAM.has(finalStore)) {
    notes.push('Saved as a plain link. Paste your affiliate link for this store when you have one.')
  }

  return {
    ...empty,
    ...extracted,
    sourceUrl: finalUrl,
    store: finalStore,
    customStoreName: finalStore === 'other' ? (siteName ?? new URL(finalUrl).hostname.replace(/^www\./, '')) : null,
    nonAffiliateUrl: finalUrl,
    notes,
    canLookup: !extracted.name || extracted.specs.length === 0,
  }
}

// ─── Web lookup (opt-in AI) ───────────────────────────────────────────────────

const LookupSchema = z.object({
  found: z.boolean(),
  name: z.string().nullable(),
  brand: z.string().nullable(),
  summary: z.string().nullable(),
  model_number: z.string().nullable(),
  gtin: z.string().nullable(),
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
  price_usd: z.number().nullable(),
  sources: z.array(z.object({ url: z.string(), title: z.string().nullable(), supports: z.string().nullable() })),
})

const LOOKUP_SYSTEM = `You identify one exact retail product and report facts about it for a product catalog.
Rules:
- Use web search. Prefer the manufacturer's own page, then major retailer listings.
- Facts the admin gave you (model number, brand, GTIN, name) are correct: search for that exact product, usually by brand + model number. One search is often enough; never more than two.
- Don't write any text between searches. Search, then answer.
- If the sources describe a different product than the admin's model number or GTIN, set found to false rather than report the other one.
- Report ONLY facts stated by those sources. NEVER invent, estimate or infer a value; omit anything you can't confirm.
- If you can't confirm the exact product (same model, not a similar one), set found to false and leave the rest empty.
- name: the product's full name as the manufacturer gives it. brand: the brand only.
- model_number: the manufacturer's model / part number for this exact version (a tool-only unit and a kit differ), never a retailer's item or SKU number. null if no source states it.
- gtin: the UPC / EAN barcode number for this exact version, digits only. null if no source states it.
- summary: two plain factual sentences on what the product is and does. No marketing language, no opinions.
- specs: concise label/value pairs with units (e.g. Weight → 2.1 lbs), at most 20. Don't repeat the model number or GTIN there.
- price_usd: the typical current US price if clearly stated, else null.
- sources: every page you took a fact from: its exact URL, its title, and which facts it supports (e.g. "model number, GTIN" or "price"). At most 6. Only pages you actually read in search results.`

export interface LookupSource {
  url: string
  title: string | null
  /** Which facts the page backs ("price", "model number, specs"), if the model said. */
  supports: string | null
}

export interface ProductLookup {
  found: boolean
  name: string | null
  brand: string | null
  /** Factual summary — reference for the admin, not the published description. */
  summary: string | null
  modelNumber: string | null
  gtin: string | null
  specs: ProductSpec[]
  priceCents: number | null
  /** Where the facts came from, so the admin can check them before saving. */
  sources: LookupSource[]
}

const MAX_SOURCES = 6

/**
 * The lookup's sources: the pages the model says it used (with what each one
 * backs), else the search tool's own result list. http(s) only, deduped.
 */
export function lookupSources(
  cited: { url: string; title: string | null; supports: string | null }[],
  searched: { url: string; title: string | null }[],
): LookupSource[] {
  const out: LookupSource[] = []
  const seen = new Set<string>()
  const add = (url: string, title: string | null, supports: string | null) => {
    let clean: string
    try {
      const u = new URL(url.trim())
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return
      clean = u.toString()
    } catch {
      return
    }
    if (seen.has(clean) || out.length >= MAX_SOURCES) return
    seen.add(clean)
    out.push({ url: clean, title: title?.trim().slice(0, 160) || null, supports: supports?.trim().slice(0, 120) || null })
  }
  for (const s of cited) add(s.url, s.title, s.supports)
  if (!out.length) for (const s of searched) add(s.url, s.title, null)
  return out
}

export interface LookupInput {
  /** The pasted product link, if any (a store page the model can't open). */
  url: string | null
  asin: string | null
  /** What the admin already typed. Model number + brand is the strongest anchor. */
  name?: string | null
  brand?: string | null
  modelNumber?: string | null
  gtin?: string | null
}

/** Whether there's anything to look up: a link, an identifier, or a name. */
export function hasLookupInput(input: LookupInput): boolean {
  return !!(input.url || input.modelNumber?.trim() || input.gtin?.trim() || input.name?.trim())
}

/**
 * The lookup prompt: the admin's typed facts first, as ground truth, then the
 * link. A typed model number turns a guess from a store URL's words into one
 * exact search.
 */
export function buildLookupPrompt(input: LookupInput): string {
  const known = [
    input.modelNumber?.trim() && `- Model number: ${input.modelNumber.trim()}`,
    input.brand?.trim() && `- Brand: ${input.brand.trim()}`,
    input.gtin?.trim() && `- GTIN / UPC: ${input.gtin.trim()}`,
    input.name?.trim() && `- Name: ${input.name.trim()}`,
  ].filter(Boolean)
  const lines = ['Identify this product and report its facts.']
  if (known.length) lines.push('', 'Known facts from the admin (correct; search for exactly this product):', ...(known as string[]))
  if (input.url) lines.push('', `Product link: ${input.url} (a store page you can't open; its words may describe the product)`)
  if (input.asin) lines.push(`Amazon ASIN: ${input.asin}`)
  if (!input.modelNumber?.trim() && !input.gtin?.trim()) {
    lines.push('', 'No model number was given: confirm the exact model before reporting anything.')
  }
  return lines.join('\n')
}

/** Live web lookup of a product's facts. Opt-in; costs a research call. */
export async function lookupProductFacts(input: LookupInput): Promise<ProductLookup> {
  const { object, sources: searched } = await aiResearch({
    tag: 'product-import',
    system: LOOKUP_SYSTEM,
    prompt: buildLookupPrompt(input),
    schema: LookupSchema,
    maxSteps: 4,
    // Plain search: the filtering variant didn't finish inside 50s. Two
    // searches: with a model number, the first one usually finds the product.
    search: { maxUses: 2, dynamicFiltering: false },
    // Room for ~20 specs, the summary and up to 6 cited sources, plus the text
    // the model writes between searches. 1500 ran out once sources were added.
    maxOutputTokens: 4000,
    // Extraction lane: invention is the failure mode, so pin it cold.
    temperature: 0,
    // No retries: an attempt can run past a minute, and a retry after our own
    // timeout only hides the real error behind "Delay was aborted". The admin
    // can simply run it again.
    retryOnTransient: false,
    maxRetries: 0,
    // Runs as a background job (the import route), so the cap is generous:
    // measured runs took 20-50s+, which a 50s request limit couldn't hold.
    timeout: 150_000,
  })

  if (!object.found) return { found: false, name: null, brand: null, summary: null, modelNumber: null, gtin: null, specs: [], priceCents: null, sources: [] }
  const raw: ProductSpec[] = []
  for (const s of object.specs) pushSpec(raw, s.label, s.value)
  // The model can still slip into specs despite the prompt; it's taken from
  // there only when the dedicated field came back empty.
  const split = splitIdentifierSpecs(raw)
  return {
    found: true,
    name: object.name ? cleanProductName(object.name).slice(0, 160) || null : null,
    brand: object.brand?.trim().slice(0, 120) || null,
    summary: object.summary?.trim().slice(0, MAX_REFERENCE) || null,
    sources: lookupSources(object.sources ?? [], searched),
    // An invalid GTIN (wrong length or check digit) is dropped, never "fixed".
    modelNumber: cleanModelNumber(object.model_number) ?? split.modelNumber,
    gtin: normalizeGtin(object.gtin) ?? split.gtin,
    specs: split.specs.slice(0, 20),
    priceCents: object.price_usd && object.price_usd > 0 ? Math.round(object.price_usd * 100) : null,
  }
}

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
//      image, price, GTIN and often specs. OpenGraph tags are the fallback.
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
import type { ProductSpec, ProductStore } from '@/lib/products'

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
  /** The retailer's own copy. Reference for the admin — never auto-published. */
  retailerDescription: string | null
  priceCents: number | null
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
      if (/^(utm_|gclid$|fbclid$|msclkid$|mc_|ref$|ref_$|cmpid$|cid$|irclickid$|clickid$|affid$|pd_rd_|pf_rd_|content-id$)/i.test(key)) {
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

function firstImage(v: Json | undefined): string | null {
  if (typeof v === 'string') return v.trim() || null
  if (Array.isArray(v)) {
    for (const item of v) {
      const found = firstImage(item)
      if (found) return found
    }
    return null
  }
  if (isObject(v)) return text(v.url) ?? text(v.contentUrl)
  return null
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
  description: string | null
  priceCents: number | null
  specs: ProductSpec[]
}

/** The first schema.org Product (or ProductGroup) in the page, or null. */
export function parseJsonLdProduct(html: string): JsonLdProduct | null {
  const node = jsonLdNodes(html).find((n) => typesOf(n).some((t) => t === 'Product' || t === 'ProductGroup'))
  if (!node) return null

  // A ProductGroup carries the shared facts; its first variant carries offers.
  const variant = Array.isArray(node.hasVariant) ? node.hasVariant.find(isObject) : undefined

  const brand = isObject(node.brand) ? text(node.brand.name) : text(node.brand)
  const specs: ProductSpec[] = []
  pushSpec(specs, 'Model', text(node.mpn) ?? text(node.model))
  pushSpec(specs, 'Color', text(node.color))
  pushSpec(specs, 'Material', text(node.material))
  pushSpec(specs, 'Weight', quantity(node.weight))
  for (const prop of Array.isArray(node.additionalProperty) ? node.additionalProperty : []) {
    if (isObject(prop)) pushSpec(specs, text(prop.name) ?? '', quantity(prop.value) ?? text(prop.value))
  }

  return {
    name: text(node.name),
    brand,
    imageUrl: firstImage(node.image) ?? firstImage(variant?.image),
    description: text(node.description)?.slice(0, MAX_REFERENCE) ?? null,
    priceCents: priceCentsFrom(node.offers) ?? priceCentsFrom(variant?.offers),
    specs,
  }
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

/** Turn a fetched product page into suggested form values. Pure — unit-tested. */
export function extractFromHtml(html: string, pageUrl: string): Omit<ProductImport, 'store' | 'customStoreName' | 'asin' | 'affiliateUrl' | 'nonAffiliateUrl' | 'canLookup' | 'notes' | 'sourceUrl'> {
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
  const name = rawName ? rawName.slice(0, 160) : null
  const brand = ld?.brand ?? (metaContent(head, 'product:brand') ? text(metaContent(head, 'product:brand')!) : null)
  const imageUrl = absolutize(ld?.imageUrl ?? og.imageUrl, pageUrl)
  const retailerDescription = ld?.description ?? og.description
  const priceCents = ld?.priceCents ?? ogPriceCents
  const specs = ld?.specs ?? []

  const found: string[] = []
  if (name) found.push('name')
  if (brand) found.push('brand')
  if (imageUrl) found.push('image')
  if (priceCents) found.push('price')
  if (specs.length) found.push(`${specs.length} spec${specs.length === 1 ? '' : 's'}`)
  if (retailerDescription) found.push('retailer description (reference)')

  return { name, brand, imageUrl, retailerDescription, priceCents, specs, found }
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
    affiliateUrl: null, nonAffiliateUrl: null, name: null, brand: null, imageUrl: null,
    retailerDescription: null, priceCents: null, specs: [], found: [], notes: [], canLookup: false,
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
    return { ...empty, notes: [FETCH_FAILURE_NOTE[fetched.reason] ?? "Couldn't read that page."], canLookup: fetched.reason !== 'blocked' }
  }

  const finalUrl = stripTracking(fetched.data.url)
  const finalStore = detectStore(new URL(finalUrl).hostname)
  // A brand's "buy" link can redirect to Amazon. Same rule: use the URL, not the page.
  if (finalStore === 'amazon') return amazonImport(finalUrl)
  const html = fetched.data.body.toString('utf8')
  const extracted = extractFromHtml(html, finalUrl)
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
  specs: z.array(z.object({ label: z.string(), value: z.string() })),
  price_usd: z.number().nullable(),
})

const LOOKUP_SYSTEM = `You identify one exact retail product and report facts about it for a product catalog.
Rules:
- Use web search. Prefer the manufacturer's own page, then major retailer listings.
- Report ONLY facts stated by those sources. NEVER invent, estimate or infer a value; omit anything you can't confirm.
- If you can't confirm the exact product (same model, not a similar one), set found to false and leave the rest empty.
- name: the product's full name as the manufacturer gives it. brand: the brand only.
- summary: two plain factual sentences on what the product is and does. No marketing language, no opinions.
- specs: concise label/value pairs with units (e.g. Weight → 2.1 lbs), at most 20.
- price_usd: the typical current US price if clearly stated, else null.`

export interface ProductLookup {
  found: boolean
  name: string | null
  brand: string | null
  /** Factual summary — reference for the admin, not the published description. */
  summary: string | null
  specs: ProductSpec[]
  priceCents: number | null
}

/** Live web lookup of a product's facts by URL / ASIN. Opt-in; costs a research call. */
export async function lookupProductFacts(input: { url: string; asin: string | null }): Promise<ProductLookup> {
  const { object } = await aiResearch({
    tag: 'product-import',
    system: LOOKUP_SYSTEM,
    prompt: `Identify this product and report its facts.\nURL: ${input.url}${input.asin ? `\nAmazon ASIN: ${input.asin}` : ''}`,
    schema: LookupSchema,
    maxSteps: 5,
    search: { maxUses: 3 },
    maxOutputTokens: 1500,
    // Extraction lane: invention is the failure mode, so pin it cold.
    temperature: 0,
    // Interactive: a fast miss beats a slow retry the admin is waiting on.
    retryOnTransient: false,
    timeout: 50_000,
  })

  if (!object.found) return { found: false, name: null, brand: null, summary: null, specs: [], priceCents: null }
  const specs: ProductSpec[] = []
  for (const s of object.specs) pushSpec(specs, s.label, s.value)
  return {
    found: true,
    name: object.name?.trim().slice(0, 160) || null,
    brand: object.brand?.trim().slice(0, 120) || null,
    summary: object.summary?.trim().slice(0, MAX_REFERENCE) || null,
    specs: specs.slice(0, 20),
    priceCents: object.price_usd && object.price_usd > 0 ? Math.round(object.price_usd * 100) : null,
  }
}

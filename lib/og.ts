/**
 * Open Graph / Twitter preview-image URL builder.
 *
 * Social platforms (Facebook, X, LinkedIn, iMessage, WhatsApp, Slack…) and the
 * CDN cache a link's preview image keyed on the EXACT image URL. If the URL never
 * changes, an edited page keeps serving its old preview forever. So every OG image
 * URL carries a `v` cache-buster with two parts:
 *
 *   v = <OG_TEMPLATE_VERSION>-<contentVersion>
 *
 * - OG_TEMPLATE_VERSION — bump this by one whenever the `/api/og` card design
 *   changes. That flushes EVERY cached preview site-wide in one edit (covers the
 *   static pages that have no per-row timestamp).
 * - contentVersion — `Date.parse(updatedAt)` for dynamic pages, so editing a
 *   review/guide/collection automatically busts just that page's preview.
 *
 * After a template bump, still re-scrape already-shared links in each platform's
 * debugger (e.g. Facebook Sharing Debugger) — they won't re-fetch on their own.
 */
export const OG_TEMPLATE_VERSION = 2

export type OgType = 'review' | 'guide' | 'article'

/**
 * Shared OpenGraph defaults. Next.js does NOT deep-merge `openGraph`: when a
 * page defines its own openGraph object, the root layout's `siteName`/`locale`
 * are dropped (Discord/Slack show site name above the title; without it the
 * card looks anonymous). Spread `...OG_SITE` into every page's openGraph so
 * these survive. Brand name is intentionally hardcoded (not via labels.ts).
 */
export const OG_SITE = { siteName: 'Boss Daddy Life', locale: 'en_US' } as const

/**
 * Trim a description for SOCIAL cards (X/Discord show ~125 chars and truncate
 * on mobile). Keep the full text for the page's search `description` — only
 * clamp what goes into `og:description`/`twitter:description`. Prefers ending
 * on a complete sentence; otherwise cuts at a word boundary with an ellipsis.
 */
export function clampSocialDescription(text: string | null | undefined, max = 125): string | undefined {
  if (!text) return undefined
  const t = text.trim()
  if (t.length <= max) return t
  const slice = t.slice(0, max)
  const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '))
  if (sentenceEnd >= max * 0.5) return t.slice(0, sentenceEnd + 1)
  const wordEnd = slice.lastIndexOf(' ')
  return `${t.slice(0, wordEnd > 0 ? wordEnd : max - 1).trimEnd()}…`
}

export function ogImageUrl(opts: {
  title: string
  type?: OgType
  category?: string
  /** Row `updated_at` (or any ISO timestamp) for dynamic pages. Omit for static pages. */
  updatedAt?: string | null
  /** Absolute origin to prefix (e.g. siteUrl). Omit for a relative URL resolved via metadataBase. */
  base?: string
  /** Call-to-action label rendered as a pill on the card (e.g. "Read the Review"). Omit → tagline. */
  cta?: string
}): string {
  const { title, type = 'guide', category, updatedAt, base = '', cta } = opts
  const params = new URLSearchParams({ title, type })
  if (category) params.set('category', category)
  if (cta) params.set('cta', cta)
  const contentVersion = updatedAt ? Date.parse(updatedAt) || 0 : 0
  params.set('v', `${OG_TEMPLATE_VERSION}-${contentVersion}`)
  return `${base}/api/og?${params.toString()}`
}

/**
 * Full OG/Twitter image descriptor (URL + dimensions + alt). Use for BOTH
 * `openGraph.images` and `twitter.images` so the card carries `og:image:alt`
 * and `twitter:image:alt` (accessibility + a card-quality signal X/FB read).
 * Declaring width/height lets platforms render the card without a re-fetch.
 */
export function ogImageMeta(opts: {
  title: string
  type?: OgType
  category?: string
  updatedAt?: string | null
  base?: string
  /** Call-to-action label rendered as a pill on the card (e.g. "Read the Review"). */
  cta?: string
  /** Override the default "<title> — Boss Daddy Life" alt text. */
  alt?: string
}): { url: string; width: number; height: number; alt: string } {
  const { alt, ...urlOpts } = opts
  return {
    url: ogImageUrl(urlOpts),
    width: 1200,
    height: 630,
    alt: alt ?? `${opts.title} — Boss Daddy Life`,
  }
}

/**
 * Absolutize a stored image path for use in JSON-LD / structured data, which
 * requires fully-qualified URLs. Storage URLs are already absolute (http…) and
 * pass through; relative paths get the site origin prepended. Returns undefined
 * for empty input so callers can fall back (e.g. to the generated OG card).
 */
export function toAbsoluteUrl(url: string | null | undefined, base: string): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//.test(url)) return url
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
}

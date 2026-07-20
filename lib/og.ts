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
export const OG_TEMPLATE_VERSION = 6

// 'site' = a section/home card with no content-type badge.
export type OgType = 'review' | 'guide' | 'article' | 'site'

// Brand X/Twitter handle — matches app/layout.tsx. Included in every social card
// so per-page metadata (which fully REPLACES the layout's twitter object) keeps
// the site/creator attribution.
export const TWITTER_HANDLE = '@bossdaddylife'

/**
 * Shared OpenGraph defaults. Next.js does NOT deep-merge `openGraph`: when a
 * page defines its own openGraph object, the root layout's `siteName`/`locale`
 * are dropped (Discord/Slack show site name above the title; without it the
 * card looks anonymous). Spread `...OG_SITE` into every page's openGraph so
 * these survive. Brand name is intentionally hardcoded (not via labels.ts).
 */
export const OG_SITE = { siteName: 'Boss Daddy Life', locale: 'en_US' } as const

/**
 * Trim a description for SOCIAL cards. X/Discord show roughly this much before
 * truncating on mobile; the default (155) lets normal one-to-two-sentence copy
 * through (X allows up to 200) and only trims genuinely long text. Keep the
 * full text for the page's search `description` — only clamp what goes into
 * `og:description`/`twitter:description`. Prefers ending on a complete
 * sentence; otherwise cuts at a word boundary with an ellipsis.
 */
export function clampSocialDescription(text: string | null | undefined, max = 155): string | undefined {
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
  /**
   * Absolute URL of the page's hero image. When present, the card renders that
   * photo as a full-bleed background (with a brand/title overlay) instead of the
   * plain text card. Must be one of our own Supabase storage URLs — /api/og
   * validates the host and falls back to the text card otherwise.
   */
  image?: string | null
}): string {
  const { title, type = 'guide', category, updatedAt, base = '', cta, image } = opts
  const params = new URLSearchParams({ title, type })
  if (category) params.set('category', category)
  if (cta) params.set('cta', cta)
  if (image) params.set('img', image)
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
  /** Absolute hero image URL — renders a photo card (see ogImageUrl). */
  image?: string | null
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

/**
 * JSON-LD structured-data image set. Google recommends providing the
 * representative image in 16:9, 4:3, AND 1:1 for the richest results, so this
 * returns three aspect-cropped variants (via the /api/img crop endpoint) of one
 * of OUR hero images. `heroUrl` MUST be an absolute Boss-Daddy image URL
 * (storage or /images) — /api/img rejects anything else. Pass the already-
 * absolutized hero (e.g. via toAbsoluteUrl); returns undefined for empty input
 * so callers can fall back to a single generated-card URL.
 */
export function aspectVariants(heroUrl: string | null | undefined, base: string): string[] | undefined {
  if (!heroUrl) return undefined
  return ['16x9', '4x3', '1x1'].map(
    (ar) => `${base}/api/img?ar=${ar}&url=${encodeURIComponent(heroUrl)}`,
  )
}

/**
 * One place every public page builds its social metadata. Resolves the preview
 * image (page hero → photo card; no hero → branded text card) and emits a
 * complete, consistent openGraph + twitter + canonical block.
 *
 * Next.js REPLACES (does not deep-merge) the layout's `openGraph`/`twitter` when
 * a page defines its own, so this helper re-declares siteName/locale/card/handle
 * every time — that's why it exists.
 */
export function buildSocialMetadata(opts: {
  /** Page <title> used for search + as the social title unless ogTitle is set. */
  title: string
  description?: string | null
  /** Canonical path, e.g. "/reviews/foo". Joined onto siteUrl. */
  path: string
  siteUrl: string
  /** Social-card title override (defaults to `title`). */
  ogTitle?: string
  /** Card badge/style. */
  type?: OgType
  /** OpenGraph object type. */
  ogType?: 'website' | 'article'
  category?: string
  cta?: string
  /** Absolute hero URL → photo card. Falsy → text card. */
  heroUrl?: string | null
  updatedAt?: string | null
  /** Override the card alt text. */
  imageAlt?: string
}): import('next').Metadata {
  const {
    title, description, path, siteUrl, ogTitle, type = 'guide',
    ogType = 'article', category, cta, heroUrl, updatedAt, imageAlt,
  } = opts

  const canonicalUrl = `${siteUrl}${path}`
  const socialTitle = ogTitle ?? title
  const image = ogImageMeta({
    title: socialTitle, type, category, updatedAt, base: siteUrl, cta,
    image: heroUrl || undefined, alt: imageAlt,
  })
  const socialDescription = clampSocialDescription(description)

  return {
    // `absolute` bypasses the root '%s | Boss Daddy' title template. Callers pass
    // a COMPLETE title (brand already included), so templating would double the
    // brand ("… | Boss Daddy | Boss Daddy") and push past Google's ~60-char cap.
    title: { absolute: title },
    ...(description ? { description } : {}),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      ...OG_SITE,
      type: ogType,
      url: canonicalUrl,
      title: socialTitle,
      ...(socialDescription ? { description: socialDescription } : {}),
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
      title: socialTitle,
      ...(socialDescription ? { description: socialDescription } : {}),
      images: [image],
    },
  }
}

const AMAZON_HOST_RE = /(?:^|\.)amazon\.(com|ca|co\.uk|de|fr|es|it|co\.jp|com\.au|in|com\.br|com\.mx)$/i

// ASINs are 10 alphanumeric chars (uppercase). Modern products almost always
// start with B; older books / ISBN-mapped ASINs may be numeric. Match either.
const ASIN_RE      = /^[A-Z0-9]{10}$/
const ASIN_PATH_RE = /\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin)\/([A-Z0-9]{10})(?=\/|$|\?)/i

/**
 * Appends an Amazon Associates tag to an Amazon URL if one isn't already present.
 * Returns the URL unchanged for non-Amazon destinations or when tag is empty.
 */
export function appendAmazonTag(url: string, tag: string): string {
  if (!tag) return url
  try {
    const parsed = new URL(url)
    if (!AMAZON_HOST_RE.test(parsed.hostname)) return url
    if (parsed.searchParams.has('tag')) return url
    parsed.searchParams.set('tag', tag)
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Pull the ASIN out of any Amazon URL form we recognize:
 *   /dp/ASIN, /dp/ASIN/slug, /gp/product/ASIN, /gp/aw/d/ASIN, /exec/obidos/asin/ASIN
 * Returns null if the URL isn't Amazon or no ASIN was found.
 */
export function extractAsin(url: string): string | null {
  try {
    const parsed = new URL(url.trim())
    if (!AMAZON_HOST_RE.test(parsed.hostname)) return null
    const m = parsed.pathname.match(ASIN_PATH_RE)
    return m ? m[1].toUpperCase() : null
  } catch {
    return null
  }
}

export function isValidAsin(asin: string): boolean {
  return ASIN_RE.test(asin.trim().toUpperCase())
}

/**
 * Build a canonical, tag-stamped Amazon affiliate URL from an ASIN.
 * Skips SiteStripe entirely — the URL Amazon would produce is deterministic.
 */
export function buildAmazonAffiliateUrl(asin: string, tag: string): string {
  const clean = asin.trim().toUpperCase()
  return `https://www.amazon.com/dp/${clean}?tag=${tag}`
}

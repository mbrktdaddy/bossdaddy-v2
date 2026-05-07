const AMAZON_HOST_RE = /(?:^|\.)amazon\.(com|ca|co\.uk|de|fr|es|it|co\.jp|com\.au|in|com\.br|com\.mx)$/i

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

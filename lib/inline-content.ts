/**
 * Split resolved article/review body HTML into an ordered list of segments so
 * inline tokens can render as rich server components instead of plain markup.
 *
 * Recognized inline markers (all post-sanitize forms of editor tokens):
 *   - `[[BUY:slug]]`        → standalone `<a data-product-slug>` anchor
 *   - `[[COLLECTION:slug]]` → `<div class="bd-collection-embed">` marker
 *   - `[[REVIEW:slug]]` / `[[GUIDE:slug]]` → `<div class="bd-content-link">` marker
 *
 * Shared by the guide and review detail pages so both render inline cross-links
 * and product cards identically.
 */

export type InlineProduct = {
  slug: string
  name: string
  affiliate_url: string | null
  non_affiliate_url: string | null
  store: string
  custom_store_name: string | null
  image_url: string | null
}

export type ContentSegment =
  | { type: 'html'; content: string }
  | { type: 'product'; product: InlineProduct }
  | { type: 'collection'; slug: string }
  | { type: 'contentlink'; contentType: 'review' | 'guide'; slug: string }

/** All distinct product slugs referenced by inline [[BUY:slug]] anchors. */
export function extractProductSlugs(html: string): string[] {
  const seen = new Set<string>()
  const regex = /data-product-slug="([^"]+)"/g
  let match
  while ((match = regex.exec(html)) !== null) {
    seen.add(match[1])
  }
  return Array.from(seen)
}

export function splitContentForInlineCards(html: string, products: InlineProduct[]): ContentSegment[] {
  // Standalone [[BUY:slug]] anchor (post-resolve form)
  const productRe = /<p>\s*<a\s[^>]*data-product-slug="([^"]+)"[^>]*>[^<]*<\/a>\s*<\/p>/g
  // Standalone [[COLLECTION:slug]] embed marker (post-resolve form)
  const collectionRe = /<div\s+class="bd-collection-embed"\s+data-collection-slug="([a-z0-9-]+)"[^>]*>\s*<\/div>/g
  // Standalone [[REVIEW:slug]] / [[GUIDE:slug]] cross-link marker (post-resolve form)
  const contentLinkRe = /<div\s+class="bd-content-link"\s+data-content-type="(review|guide)"\s+data-content-slug="([a-z0-9-]+)"[^>]*>\s*<\/div>/g

  // Gather every inline-replaceable match, sort by position, then weave them
  // into segments so the prose between them stays intact.
  type RawMatch = { index: number; length: number; segment: ContentSegment }
  const matches: RawMatch[] = []
  let m: RegExpExecArray | null
  while ((m = productRe.exec(html)) !== null) {
    const product = products.find((p) => p.slug === m![1])
    if (!product) continue
    matches.push({ index: m.index, length: m[0].length, segment: { type: 'product', product } })
  }
  while ((m = collectionRe.exec(html)) !== null) {
    matches.push({ index: m.index, length: m[0].length, segment: { type: 'collection', slug: m[1] } })
  }
  while ((m = contentLinkRe.exec(html)) !== null) {
    matches.push({
      index: m.index,
      length: m[0].length,
      segment: { type: 'contentlink', contentType: m[1] as 'review' | 'guide', slug: m[2] },
    })
  }
  matches.sort((a, b) => a.index - b.index)

  const segments: ContentSegment[] = []
  let lastIndex = 0
  for (const match of matches) {
    if (match.index > lastIndex) {
      segments.push({ type: 'html', content: html.slice(lastIndex, match.index) })
    }
    segments.push(match.segment)
    lastIndex = match.index + match.length
  }
  if (lastIndex < html.length) {
    segments.push({ type: 'html', content: html.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'html', content: html }]
}

/**
 * Split resolved article/review body HTML into an ordered list of segments so
 * inline tokens can render as rich server components instead of plain markup.
 *
 * Recognized inline markers (all post-sanitize forms of editor tokens):
 *   - `[[BUY:slug]]`        → standalone `<a data-product-slug>` anchor
 *   - `[[COLLECTION:slug]]` → `<div class="bd-collection-embed">` marker
 *   - `[[REVIEW:slug]]` / `[[GUIDE:slug]]` → `<div class="bd-content-link">` marker
 *   - a filled inline image → `<figure class="bd-image-filled">` (Phase 3: rendered
 *     through next/image with its stored size, lazy, with a credit line)
 *
 * Figures inside a `.bd-image-grid` gallery stay HTML — the scroll-snap strip
 * is CSS-driven and must keep its children in one div.
 *
 * Shared by the guide, review and collection detail pages so all three render
 * inline cross-links, product cards and figures identically (components/content/ArticleBody.tsx).
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

export type FigureSegment = {
  type: 'figure'
  slotId: string | null
  src: string
  alt: string
  caption: string
  /** Present when the figure was filled after mig 166 (written on the <img>). */
  width: number | null
  height: number | null
  /** 'own' | 'web' | 'amazon' | 'ai' when written at fill time. */
  origin: string | null
}

export type ContentSegment =
  | { type: 'html'; content: string }
  | { type: 'product'; product: InlineProduct }
  | { type: 'collection'; slug: string }
  | { type: 'contentlink'; contentType: 'review' | 'guide'; slug: string }
  | FigureSegment

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

/** All distinct image URLs in filled figures (standalone + gallery) — for the asset lookup. */
export function extractFigureSrcs(html: string): string[] {
  const seen = new Set<string>()
  const re = /<figure\b[^>]*\bclass="[^"]*\bbd-image-filled\b[^"]*"[^>]*>[\s\S]*?<img\b[^>]*\bsrc="([^"]+)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) seen.add(decodeEntities(m[1]))
  return Array.from(seen)
}

function decodeEntities(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`))
  return m ? decodeEntities(m[1]) : null
}

const GALLERY_RE = /<div\b[^>]*\bclass="bd-image-grid"[^>]*>[\s\S]*?<\/div>/g
const FILLED_FIGURE_RE = /<figure\b[^>]*\bclass="[^"]*\bbd-image-filled\b[^"]*"[^>]*>[\s\S]*?<\/figure>/g

/** Parse one standalone filled figure's markup. Null when it has no <img src>. */
export function parseFigure(raw: string): FigureSegment | null {
  const open = raw.match(/^<figure\b[^>]*>/)?.[0] ?? ''
  const img = raw.match(/<img\b[^>]*>/)?.[0]
  if (!img) return null
  const src = attr(img, 'src')
  if (!src) return null
  const w = Number(attr(img, 'width'))
  const h = Number(attr(img, 'height'))
  const captionHtml = raw.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? ''
  return {
    type: 'figure',
    slotId: attr(open, 'data-slot-id'),
    src,
    alt: attr(img, 'alt') ?? '',
    caption: decodeEntities(captionHtml.replace(/<[^>]*>/g, '')).trim(),
    width: w > 0 && h > 0 ? w : null,
    height: w > 0 && h > 0 ? h : null,
    origin: attr(open, 'data-origin'),
  }
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

  // Standalone filled figures — skipping any that sit inside a gallery strip.
  const galleryRanges: Array<{ start: number; end: number }> = []
  const galleryRe = new RegExp(GALLERY_RE.source, GALLERY_RE.flags)
  while ((m = galleryRe.exec(html)) !== null) galleryRanges.push({ start: m.index, end: m.index + m[0].length })
  const figureRe = new RegExp(FILLED_FIGURE_RE.source, FILLED_FIGURE_RE.flags)
  while ((m = figureRe.exec(html)) !== null) {
    const start = m.index
    if (galleryRanges.some((r) => start >= r.start && start < r.end)) continue
    const segment = parseFigure(m[0])
    if (!segment) continue
    matches.push({ index: start, length: m[0].length, segment })
  }

  matches.sort((a, b) => a.index - b.index)

  const segments: ContentSegment[] = []
  let lastIndex = 0
  for (const match of matches) {
    if (match.index < lastIndex) continue // overlapping match (defensive)
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

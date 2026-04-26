/**
 * Product-mention management — find, remove, and reorder every product
 * reference in body HTML, whether it's a raw [[BUY:slug]] token or a
 * resolved affiliate anchor stamped with `data-product-slug`.
 *
 * The ProductLinkPanel uses these helpers so editors can manage what's
 * already mentioned instead of just adding more.
 */

import { extractH2Headings, type InsertPosition } from './inlineImages'

export type { InsertPosition }
export { extractH2Headings }

export interface ProductLite {
  id: string
  slug: string
  name: string
  affiliate_url: string | null
  non_affiliate_url: string | null
}

export type MentionKind = 'token' | 'anchor-tagged' | 'anchor-by-url'

export interface ProductMention {
  slug: string
  /** What kind of mention this is */
  kind: MentionKind
  /** 1-based position within the ordered list of mentions */
  position: number
  start: number
  end: number
  raw: string
  /** Visible label, when available (anchor inner text or "[[BUY:slug]]") */
  label: string
}

const TOKEN_RE   = /\[\[BUY:([a-z0-9-]+)\]\]/g
const ANCHOR_RE  = /<a\b[^>]*>(?:[\s\S]*?)<\/a>/g

function escapeRegex(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

function findAttr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`))
  return m ? m[1] : null
}

function decode(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

export function extractMentions(content: string, products: ProductLite[]): ProductMention[] {
  const out: Omit<ProductMention, 'position'>[] = []

  // 1. Raw [[BUY:slug]] tokens (only present during in-progress editing,
  //    since save resolves them — but we still surface them while editing).
  const tokenRe = new RegExp(TOKEN_RE.source, TOKEN_RE.flags)
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(content)) !== null) {
    out.push({
      slug: m[1],
      kind: 'token',
      start: m.index,
      end:   m.index + m[0].length,
      raw:   m[0],
      label: m[0],
    })
  }

  // Build URL → slug + slug-by-data lookups for anchor matching
  const urlToSlug = new Map<string, string>()
  for (const p of products) {
    if (p.affiliate_url)     urlToSlug.set(p.affiliate_url, p.slug)
    if (p.non_affiliate_url) urlToSlug.set(p.non_affiliate_url, p.slug)
  }

  // 2 + 3. Anchors — by data-product-slug attribute, or by href URL fallback.
  const anchorRe = new RegExp(ANCHOR_RE.source, ANCHOR_RE.flags)
  while ((m = anchorRe.exec(content)) !== null) {
    const raw = m[0]
    const tagged = findAttr(raw, 'data-product-slug')
    const href   = decode(findAttr(raw, 'href') ?? '')
    let slug: string | null = null
    let kind: MentionKind   = 'anchor-by-url'
    if (tagged) {
      slug = decode(tagged)
      kind = 'anchor-tagged'
    } else if (href && urlToSlug.has(href)) {
      slug = urlToSlug.get(href) ?? null
    }
    if (!slug) continue
    const innerText = raw.replace(/<[^>]*>/g, '').trim()
    out.push({
      slug,
      kind,
      start: m.index,
      end:   m.index + raw.length,
      raw,
      label: innerText || raw,
    })
  }

  // Sort by document position and assign 1-based positions
  out.sort((a, b) => a.start - b.start)
  return out.map((mention, i) => ({ ...mention, position: i + 1 }))
}

export function removeMentionAtPosition(
  content: string,
  position: number,
  products: ProductLite[],
): string {
  const mentions = extractMentions(content, products)
  const target = mentions.find((m) => m.position === position)
  if (!target) return content
  // For anchor mentions wrapped in <p>, remove the wrapper too if it's solo.
  if (target.kind !== 'token') {
    const wrappedRe = new RegExp(`<p>\\s*${escapeRegex(target.raw)}\\s*</p>`, 'g')
    if (wrappedRe.test(content)) {
      return content.replace(wrappedRe, '').replace(/\n{3,}/g, '\n\n')
    }
  }
  return content.slice(0, target.start) + content.slice(target.end).replace(/^\n{3,}/, '\n\n')
}

export function moveMentionToPosition(
  content: string,
  currentPos: number,
  targetPos: number,
  products: ProductLite[],
): string {
  const mentions = extractMentions(content, products)
  if (mentions.length <= 1 || currentPos === targetPos) return content
  const source = mentions.find((m) => m.position === currentPos)
  if (!source) return content
  const clamped = Math.max(1, Math.min(targetPos, mentions.length))
  if (clamped === currentPos) return content

  const without = content.slice(0, source.start) + content.slice(source.end)
  const remaining = extractMentions(without, products)
  let insertAt: number
  if (clamped - 1 >= remaining.length) {
    insertAt = remaining.length === 0 ? without.length : remaining[remaining.length - 1].end
  } else {
    insertAt = remaining[clamped - 1].start
  }
  return without.slice(0, insertAt) + source.raw + without.slice(insertAt)
}

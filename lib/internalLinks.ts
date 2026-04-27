/**
 * Internal-link management — find, remove, reorder, and re-text every
 * `<a>` in body HTML that points to an article or review on this site.
 *
 * The InternalLinkPanel uses these helpers to surface a "Currently in
 * this article" section so editors can manage what's already there
 * instead of just blindly inserting more.
 */

import { extractH2Headings, type InsertPosition } from './inlineImages'

export type { InsertPosition }
export { extractH2Headings }

export interface InternalLink {
  href: string
  /** Normalized pathname — same value regardless of whether the original
   *  href was absolute (`https://site.com/reviews/x`) or relative (`/reviews/x`).
   *  Use this for equality checks; use `href` only for display. */
  path: string
  text: string
  /** 1-based position within the ordered list of internal links in body */
  position: number
  start: number
  end: number
  raw: string
  type: 'article' | 'review' | 'other'
}

// Anchors whose href starts with /articles/ or /reviews/ — relative URLs
// only, since that's what the editor produces. Absolute production URLs are
// out of scope on purpose (would also catch external shares).
const ANCHOR_RE = /<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g

function hrefToPath(href: string): string {
  try {
    return new URL(href).pathname
  } catch {
    // already a relative path — use as-is
    return href
  }
}

function classifyHref(href: string): InternalLink['type'] {
  const pathname = hrefToPath(href)
  if (pathname.startsWith('/articles/')) return 'article'
  if (pathname.startsWith('/reviews/'))  return 'review'
  return 'other'
}

export function isInternalHref(href: string): boolean {
  return classifyHref(href) !== 'other'
}

export function extractInternalLinks(content: string): InternalLink[] {
  const out: InternalLink[] = []
  const re = new RegExp(ANCHOR_RE.source, ANCHOR_RE.flags)
  let m: RegExpExecArray | null
  let position = 0
  while ((m = re.exec(content)) !== null) {
    const type = classifyHref(m[1])
    if (type === 'other') continue
    position += 1
    out.push({
      href: m[1],
      path: hrefToPath(m[1]),
      text: m[2].replace(/<[^>]*>/g, '').trim(),
      position,
      start: m.index,
      end:   m.index + m[0].length,
      raw:   m[0],
      type,
    })
  }
  return out
}

function escapeRegex(s: string): string {
  return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Build a paragraph wrapping a single internal link. */
export function buildInternalLinkMarkup(href: string, text: string): string {
  return `<p><a href="${escAttr(href)}">${escAttr(text)}</a></p>`
}

/** Remove the link at the given 1-based position. Surrounding `<p>` wrapper
 *  is removed too if it exists and contained only this link. */
export function removeLinkAtPosition(content: string, position: number): string {
  const links = extractInternalLinks(content)
  const target = links.find((l) => l.position === position)
  if (!target) return content
  // Try to remove `<p><a>…</a></p>` if the link is the sole child of a paragraph
  const wrappedRe = new RegExp(`<p>\\s*${escapeRegex(target.raw)}\\s*</p>`, 'g')
  if (wrappedRe.test(content)) {
    return content.replace(wrappedRe, '').replace(/\n{3,}/g, '\n\n')
  }
  return content.replace(target.raw, '').replace(/\n{3,}/g, '\n\n')
}

/** Update the visible link text (preserves href + surrounding tags). */
export function updateLinkText(content: string, position: number, nextText: string): string {
  const links = extractInternalLinks(content)
  const target = links.find((l) => l.position === position)
  if (!target) return content
  const escapedHref = escapeRegex(target.href)
  const re = new RegExp(`(<a\\b[^>]*\\bhref="${escapedHref}"[^>]*>)([\\s\\S]*?)(</a>)`, '')
  // Replace only the Nth occurrence of this href
  let count = 0
  return content.replace(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (full, href) => {
    if (!isInternalHref(href)) return full
    count += 1
    if (count !== position) return full
    return full.replace(re, `$1${escAttr(nextText)}$3`)
  })
}

/** Move the link at currentPos to targetPos within the ordered list of
 *  internal links. Surrounding prose stays put — only the anchors swap. */
export function moveLinkToPosition(content: string, currentPos: number, targetPos: number): string {
  const links = extractInternalLinks(content)
  if (currentPos === targetPos || links.length <= 1) return content
  const source = links.find((l) => l.position === currentPos)
  if (!source) return content
  const clamped = Math.max(1, Math.min(targetPos, links.length))
  if (clamped === currentPos) return content

  // Remove source from content
  const without = content.slice(0, source.start) + content.slice(source.end)
  // Re-extract positions in the trimmed content
  const remaining = extractInternalLinks(without)
  let insertAt: number
  if (clamped - 1 >= remaining.length) {
    insertAt = remaining.length === 0 ? without.length : remaining[remaining.length - 1].end
  } else {
    insertAt = remaining[clamped - 1].start
  }
  return without.slice(0, insertAt) + source.raw + without.slice(insertAt)
}

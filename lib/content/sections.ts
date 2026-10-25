import { htmlToStructuredText, paragraphsToHtml } from './html'

// Section-level view of body HTML for the patch-based refine (content pipeline
// plan, Phase 2). A section = an <h2> and everything up to the next <h2>; the
// prose before the first <h2> is the intro. Non-prose blocks inside a section
// (figures, galleries, collection embeds, cross-link cards) are carried across
// a rewrite untouched; inline product anchors become [[BUY:slug]] tokens so the
// model keeps them in place and the save resolves them back.

export interface BodySection {
  index: number
  /** null for the intro. */
  heading: string | null
  /** The raw <h2 …>…</h2> tag, verbatim, so a rewrite keeps its attributes. */
  headingTag: string | null
  start: number
  end: number
  html: string
}

const H2_RE = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi

// Block-level things that are not prose and must survive a rewrite, in the
// order they appear. Galleries first so their inner figures aren't matched twice.
export const PRESERVED_BLOCK_RE =
  /<div\b[^>]*\bclass="bd-image-grid"[^>]*>[\s\S]*?<\/div>|<figure\b[\s\S]*?<\/figure>|<div\b[^>]*\bclass="bd-collection-embed"[^>]*>\s*<\/div>|<div\b[^>]*\bclass="bd-content-link"[^>]*>\s*<\/div>|<div\b[^>]*\bclass="bd-(?:callout|steps|facts|timeline|chart)"[^>]*>[\s\S]*?<\/div>|<div\b[^>]*\bclass="bd-video"[^>]*>\s*<\/div>/gi

export function splitSections(html: string): BodySection[] {
  const out: BodySection[] = []
  const heads: { start: number; end: number; text: string; tag: string }[] = []
  const re = new RegExp(H2_RE.source, H2_RE.flags)
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    heads.push({ start: m.index, end: m.index + m[0].length, text: m[1].replace(/<[^>]*>/g, '').trim(), tag: m[0] })
  }

  const introEnd = heads.length ? heads[0].start : html.length
  const intro = html.slice(0, introEnd)
  if (intro.replace(/<[^>]*>/g, '').trim()) {
    out.push({ index: 0, heading: null, headingTag: null, start: 0, end: introEnd, html: intro })
  }
  heads.forEach((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].start : html.length
    out.push({ index: out.length, heading: h.text, headingTag: h.tag, start: h.start, end, html: html.slice(h.start, end) })
  })
  return out
}

export function sectionLabel(s: BodySection): string {
  return s.heading ?? 'Introduction'
}

/** Resolved affiliate anchors → the editor token the save step resolves again. */
export function anchorsToTokens(html: string): string {
  return html.replace(/<a\b[^>]*\bdata-product-slug="([^"]+)"[^>]*>[\s\S]*?<\/a>/gi, (_m, slug) => `[[BUY:${slug}]]`)
}

/** Split a section into its prose HTML and the blocks that must be carried over. */
export function extractPreservedBlocks(sectionHtml: string): { prose: string; blocks: string[] } {
  const blocks: string[] = []
  const prose = sectionHtml.replace(PRESERVED_BLOCK_RE, (m) => { blocks.push(m); return '' })
  return { prose, blocks }
}

/** The section's prose as model-readable text: heading stripped, tokens in place, no blocks. */
export function sectionToStructuredText(s: BodySection): string {
  const withoutHeading = s.headingTag ? s.html.replace(s.headingTag, '') : s.html
  const { prose } = extractPreservedBlocks(withoutHeading)
  return htmlToStructuredText(anchorsToTokens(prose))
}

/**
 * Replace one section's prose with new plain-text paragraphs. The heading tag
 * is kept verbatim; preserved blocks are re-attached at the end of the section
 * (where the draft assembler puts them); everything outside the section is
 * untouched byte-for-byte.
 */
export function replaceSectionProse(html: string, index: number, newProse: string): string {
  const sections = splitSections(html)
  const s = sections[index]
  if (!s) return html
  const { blocks } = extractPreservedBlocks(s.headingTag ? s.html.replace(s.headingTag, '') : s.html)
  const body = paragraphsToHtml(newProse)
  const rebuilt = [s.headingTag, body, ...blocks].filter(Boolean).join('\n')
  const lead = s.start > 0 && !html.slice(0, s.start).endsWith('\n') ? '\n' : ''
  return html.slice(0, s.start) + lead + rebuilt + (s.end < html.length ? '\n\n' : '') + html.slice(s.end).replace(/^\n+/, '')
}

/** Count [[BUY:slug]] tokens per slug in a piece of text. */
export function countTokens(text: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of text.matchAll(/\[\[BUY:([a-z0-9-]+)\]\]/g)) out[m[1]] = (out[m[1]] ?? 0) + 1
  return out
}

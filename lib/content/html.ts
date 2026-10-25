import { buildPlaceholderFigure } from '@/lib/inlineImages'
import { videoMarker, type ContentElement } from './elements'

// The ONE place a generated draft becomes body HTML, and the one place body
// HTML is turned back into model-readable text. Until 2026-10-23 both wizards
// and both workspaces each carried their own copy of the assembly, and the two
// refine routes each carried their own tag-stripper — which is how the verdict
// ("1–2 paragraphs") shipped wrapped in a single <p> for months.

export interface DraftSection {
  heading: string
  body: string
}

export interface DraftInlineImage {
  afterHeading: string
  prompt: string
  altText: string
  caption: string
}

export interface AssembleDraftArgs {
  introduction?: string | null
  sections?: DraftSection[] | null
  /** The closing block — "The Verdict" for reviews, "Wrapping Up" for guides. */
  closing?: { heading: string; body: string } | null
  /** AI-suggested placements; each becomes a placeholder <figure> after its heading. */
  inlineImages?: DraftInlineImage[] | null
  /** Drafted body elements; each becomes a marker div after its part's prose ('' = after the intro). */
  elements?: ContentElement[] | null
  /** Planned video slots (subject only) — an empty marker the author fills in the editor. */
  videoSlots?: { afterHeading: string; subject: string }[] | null
}

function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * A ContentElement as the marker HTML the sanitizer allows, globals.css styles
 * and the Tiptap nodes edit (lib/content/elements.ts). Body text is light
 * Markdown like the prose; attributes are escaped.
 */
export function elementToHtml(el: ContentElement): string {
  if (el.type === 'callout') {
    return `<div class="bd-callout" data-kind="${el.kind}" data-title="${escAttr(el.title)}">\n${paragraphsToHtml(el.body)}\n</div>`
  }
  if (el.type === 'facts') {
    const items = el.items.map((f) => `<li><strong>${inlineMarksToHtml(f.label.replace(/:\s*$/, ''))}:</strong> ${inlineMarksToHtml(f.value)}</li>`).join('\n')
    return `<div class="bd-facts" data-title="${escAttr(el.title)}">\n<ul>\n${items}\n</ul>\n</div>`
  }
  if (el.type === 'chart') {
    // Same row shape as facts — the public page draws the SVG from these rows
    // and keeps the list for screen readers; the editor edits the list.
    const items = el.items.map((r) => `<li><strong>${inlineMarksToHtml(r.label.replace(/:\s*$/, ''))}:</strong> ${r.value}</li>`).join('\n')
    const unit = el.unit ? ` data-unit="${escAttr(el.unit)}"` : ''
    return `<div class="bd-chart" data-title="${escAttr(el.title)}"${unit}>\n<ul>\n${items}\n</ul>\n</div>`
  }
  if (el.type === 'timeline') {
    const items = el.items.map((e) => {
      const t = e.title.replace(/[.:]\s*$/, '')
      const lead = /[!?…]$/.test(t) ? t : `${t}.`
      return `<li><strong>${inlineMarksToHtml(e.when)}</strong> ${inlineMarksToHtml(lead)}${e.body ? ` ${inlineMarksToHtml(e.body)}` : ''}</li>`
    }).join('\n')
    return `<div class="bd-timeline" data-title="${escAttr(el.title)}">\n<ol>\n${items}\n</ol>\n</div>`
  }
  const items = el.items
    .map((i) => {
      const t = i.title.replace(/[.:]\s*$/, '')
      const lead = /[!?…]$/.test(t) ? t : `${t}.`
      return `<li><strong>${inlineMarksToHtml(lead)}</strong>${i.body ? ` ${inlineMarksToHtml(i.body)}` : ''}</li>`
    })
    .join('\n')
  const time = el.time ? ` data-time="${escAttr(el.time)}"` : ''
  return `<div class="bd-steps" data-title="${escAttr(el.title)}"${time}>\n<ol>\n${items}\n</ol>\n</div>`
}

const BULLET_RE = /^[-*]\s+(.*)$/
// 1–2 digits only, and a standalone numbered list needs 2+ items: a lone
// "2024. That was the year…" or "3. That's how many…" is a sentence, not a step.
const NUMBER_RE = /^\d{1,2}[.)]\s+(.*)$/
const H3_RE = /^###\s+(.*)$/
const QUOTE_RE = /^>\s?(.*)$/

/** `**bold**`, `*italic*` / `_italic_` — the only inline marks the subset allows. */
export function inlineMarksToHtml(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(])\*(?!\s)([^*\n]+?)\*(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_(?!\s)([^_\n]+?)_(?=[\s.,;:!?)]|$)/g, '$1<em>$2</em>')
}

function listToHtml(tag: 'ul' | 'ol', items: string[]): string {
  return `<${tag}>\n${items.map((t) => `<li>${inlineMarksToHtml(t.trim())}</li>`).join('\n')}\n</${tag}>`
}

/**
 * Model prose → body HTML. Since 2026-10-25 the prose is a constrained
 * Markdown subset (docs/rich-elements-plan.md §2): blank lines separate
 * paragraphs (single newlines inside one are spaces); `- ` / `* ` lines form a
 * bulleted list and `1.` lines a numbered one (consecutive lines, blank line
 * ends it); `### ` is an H3; `> ` lines are a pull-quote; `**bold**` and
 * `*italic*` are the only inline marks. Anything else — `#`/`##` headings, code
 * fences, tables, raw HTML — is left literal, so it reads as the mistake it is
 * instead of forking the document. Body text is NOT escaped here — it is
 * sanitized on save like every other body write.
 */
export function paragraphsToHtml(text: string | null | undefined): string {
  const out: string[] = []
  for (const block of (text ?? '').split(/\n\s*\n+/)) {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) continue

    if (lines.every((l) => BULLET_RE.test(l))) {
      out.push(listToHtml('ul', lines.map((l) => l.match(BULLET_RE)![1])))
      continue
    }
    if (lines.length >= 2 && lines.every((l) => NUMBER_RE.test(l))) {
      out.push(listToHtml('ol', lines.map((l) => l.match(NUMBER_RE)![1])))
      continue
    }
    if (lines.length === 1 && H3_RE.test(lines[0])) {
      out.push(`<h3>${inlineMarksToHtml(lines[0].match(H3_RE)![1].trim())}</h3>`)
      continue
    }
    if (lines.every((l) => QUOTE_RE.test(l))) {
      const quote = lines.map((l) => l.match(QUOTE_RE)![1]).join(' ').trim()
      if (quote) out.push(`<blockquote><p>${inlineMarksToHtml(quote)}</p></blockquote>`)
      continue
    }

    // A list glued to its lead-in sentence without a blank line: split them.
    const firstList = lines.findIndex((l) => BULLET_RE.test(l) || NUMBER_RE.test(l))
    const rest0 = lines.slice(firstList)
    const restIsList = rest0.every((l) => BULLET_RE.test(l)) || (rest0.length >= 2 && rest0.every((l) => NUMBER_RE.test(l)))
    if (firstList > 0 && restIsList) {
      out.push(`<p>${inlineMarksToHtml(lines.slice(0, firstList).join(' '))}</p>`)
      const rest = lines.slice(firstList)
      out.push(rest.every((l) => NUMBER_RE.test(l))
        ? listToHtml('ol', rest.map((l) => l.match(NUMBER_RE)![1]))
        : listToHtml('ul', rest.map((l) => l.replace(BULLET_RE, '$1').replace(NUMBER_RE, '$1'))))
      continue
    }

    out.push(`<p>${inlineMarksToHtml(lines.join(' '))}</p>`)
  }
  return out.join('\n')
}

function normHeading(h: string): string {
  return h.trim().toLowerCase()
}

export function assembleDraftHtml(args: AssembleDraftArgs): string {
  const slots = (args.inlineImages ?? []).map((img, i) => ({ ...img, slotId: `slot-${i + 1}` }))

  const elementsAfter = (heading: string) =>
    [
      ...(args.elements ?? [])
        .filter((el) => normHeading(el.afterHeading) === normHeading(heading))
        .map(elementToHtml),
      ...(args.videoSlots ?? [])
        .filter((v) => normHeading(v.afterHeading) === normHeading(heading))
        .map((v) => videoMarker({ id: '', caption: '', subject: v.subject })),
    ].join('\n')

  const parts: string[] = []
  const intro = paragraphsToHtml(args.introduction)
  const introEls = elementsAfter('')
  if (intro || introEls) parts.push([intro, introEls].filter(Boolean).join('\n'))

  for (const s of args.sections ?? []) {
    const body = paragraphsToHtml(s.body)
    const els = elementsAfter(s.heading)
    const figures = slots
      .filter((sl) => normHeading(sl.afterHeading) === normHeading(s.heading))
      .map((sl) => buildPlaceholderFigure({ slotId: sl.slotId, prompt: sl.prompt, alt: sl.altText, caption: sl.caption }))
      .join('\n')
    parts.push(`<h2>${s.heading.trim()}</h2>\n${body}${els ? `\n${els}` : ''}${figures ? `\n${figures}` : ''}`)
  }

  if (args.closing?.body?.trim()) {
    const els = elementsAfter(args.closing.heading)
    parts.push(`<h2>${args.closing.heading}</h2>\n${paragraphsToHtml(args.closing.body)}${els ? `\n${els}` : ''}`)
  }

  return parts.join('\n\n')
}

/**
 * Body HTML → structured plain text for a model to EDIT: `## ` marks each H2,
 * paragraphs are separated by blank lines, list items become "- " lines,
 * figures and embeds are dropped (they are re-attached after the refine).
 * The old approach collapsed the whole article into one line, so "preserve
 * everything else" had no structure to preserve.
 */
export function htmlToStructuredText(html: string): string {
  const decoded = (s: string) =>
    s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")

  return html
    .replace(/<figure\b[\s\S]*?<\/figure>/gi, '')
    .replace(/<div\b[^>]*class="bd-[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_m, t) => `\n\n## ${t.replace(/<[^>]+>/g, '').trim()}\n\n`)
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (_m, t) => `\n\n### ${t.replace(/<[^>]+>/g, '').trim()}\n\n`)
    // Numbered lists round-trip as "1." lines so a refine keeps them numbered.
    .replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_m, inner: string) => {
      let n = 0
      return inner.replace(/<li\b[^>]*>([\s\S]*?)<\/li>\s*/gi, (_li, t: string) => `${++n}. ${t.replace(/<[^>]+>/g, '').trim()}\n`) + '\n\n'
    })
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>\s*/gi, (_m, t) => `- ${t.replace(/<[^>]+>/g, '').trim()}\n`)
    .replace(/<\/(p|ul|ol|blockquote)>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map((l) => decoded(l).replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Remove authoring-only metadata before body HTML is rendered publicly. The
 * image prompt, the pre-generation alt and the caption copy live on the
 * <figure> for the InlineMediaPanel; on the public page they are dead weight
 * and the prompt text is an "AI-generated" tell in view-source. `data-slot-id`
 * stays (harmless, and the lightbox keys off figure identity).
 */
export function stripAuthoringAttrs(html: string): string {
  return html.replace(/<(figure|div)\b[^>]*>/gi, (tag) =>
    tag.replace(/\s+data-(prompt|alt|caption)="[^"]*"/gi, ''),
  )
}

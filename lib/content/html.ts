import { buildPlaceholderFigure } from '@/lib/inlineImages'

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
}

/**
 * Model prose → paragraphs. Blank lines (the prompts ask for \n\n) separate
 * paragraphs; single newlines inside a paragraph are kept as spaces. Body text
 * is NOT escaped here — it is sanitized on save like every other body write —
 * which matches what the wizards always did.
 */
export function paragraphsToHtml(text: string | null | undefined): string {
  return (text ?? '')
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join('\n')
}

function normHeading(h: string): string {
  return h.trim().toLowerCase()
}

export function assembleDraftHtml(args: AssembleDraftArgs): string {
  const slots = (args.inlineImages ?? []).map((img, i) => ({ ...img, slotId: `slot-${i + 1}` }))

  const parts: string[] = []
  const intro = paragraphsToHtml(args.introduction)
  if (intro) parts.push(intro)

  for (const s of args.sections ?? []) {
    const body = paragraphsToHtml(s.body)
    const figures = slots
      .filter((sl) => normHeading(sl.afterHeading) === normHeading(s.heading))
      .map((sl) => buildPlaceholderFigure({ slotId: sl.slotId, prompt: sl.prompt, alt: sl.altText, caption: sl.caption }))
      .join('\n')
    parts.push(`<h2>${s.heading.trim()}</h2>\n${body}${figures ? `\n${figures}` : ''}`)
  }

  if (args.closing?.body?.trim()) {
    parts.push(`<h2>${args.closing.heading}</h2>\n${paragraphsToHtml(args.closing.body)}`)
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
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_m, t) => `- ${t.replace(/<[^>]+>/g, '').trim()}\n`)
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

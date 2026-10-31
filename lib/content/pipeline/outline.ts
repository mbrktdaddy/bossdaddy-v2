import { z } from 'zod'
import { INQUIRY_TRIGGER } from '../prompts'
import { briefDataBlocks, briefFacts, briefHeaderLines, briefLabel, briefProductSlugs, hasFirsthand } from './briefs'
import { PLAN_TYPES } from '../elements'
import type { ElementPlan } from '../elements'
import type { BlockChoices, Brief, Outline, OutlinePart, RelatedPiece } from './types'

// Stage 1 — the outline the author edits before any prose is written. This is
// where blocks and length are chosen per piece (no forced eight blocks, no
// fixed 3–5 × 150–250), where the author's facts are distributed across parts,
// and where cross-links / near-duplicates surface.

export const OutlineOutput = z.object({
  titleOptions: z.array(z.string().min(1).max(120)).min(2).max(4)
    .describe('2–4 title options; include the product name / topic keyword; aim under 70 chars'),
  excerpt: z.string().min(1).max(200).describe('One punchy card sentence; aim under 160 chars'),
  parts: z.array(z.object({
    kind:        z.enum(['intro', 'body', 'closing']),
    heading:     z.string().max(200).describe('Empty string for the intro'),
    intent:      z.string().min(1).max(400).describe('One line: what this part must do for the reader'),
    notes:       z.array(z.string().max(300)).max(8)
      .describe("Which of the AUTHOR FACTS this part draws on — copy them verbatim from the list; a part may have none"),
    targetWords: z.number().int().min(40).max(600),
    format:      z.enum(['prose', 'steps', 'list'])
      .describe('"steps" when the reader performs things in order (one numbered list is the spine of the part); "list" when 3+ parallel options, criteria or items scan better as bullets; "prose" otherwise. Most parts are prose; an intro and a closing always are; an essay never has steps or list'),
  })).min(3).max(12).describe('Exactly one intro first, one closing last, body parts between'),
  blocks: z.object({
    tldr:         z.boolean(),
    keyTakeaways: z.boolean(),
    faqs:         z.boolean(),
    bestFor:      z.boolean(),
    notFor:       z.boolean(),
    prosCons:     z.boolean(),
  }).describe('Which structured blocks this particular piece earns — recommend, do not default to all'),
  elements: z.array(z.object({
    type:         z.enum(PLAN_TYPES).describe('"callout" = a boxed aside (a warning, a safety note, a tip, a faith note) that would otherwise interrupt the paragraph; "steps" = a boxed numbered recap of a procedure the piece teaches; "facts" = a label/value box of the hard numbers the piece states; "timeline" = a dated sequence the piece narrates; "chart" = a bar chart of 3+ comparable numbers in ONE unit the piece states (weights, prices, hours); "video" = a slot for a short demo the AUTHOR will film or link — you only name the subject in "reason"'),
    afterHeading: z.string().max(200).describe('The exact heading of the part it follows, or "" for right after the introduction'),
    reason:       z.string().min(1).max(160).describe('One line: why a reader needs this here'),
  })).max(3).describe('Body elements this piece EARNS — most pieces earn 0–1; a how-to earns one steps box; an essay earns none'),
  imageCount: z.number().int().min(0).max(6),
})
export type OutlineModelOutput = z.infer<typeof OutlineOutput>

/** The house default per piece; the model recommends against it, the author decides. */
export function defaultBlockChoices(brief: Brief): BlockChoices {
  if (brief.contentType === 'review') {
    return { tldr: true, keyTakeaways: true, faqs: true, bestFor: true, notFor: true, prosCons: true, subScores: true }
  }
  const t = brief.pieceType
  return {
    tldr: t !== 'essay',
    keyTakeaways: t !== 'essay',
    faqs: t === 'guide',
    bestFor: false, notFor: false, prosCons: false, subScores: false,
  }
}

function structureGuidance(brief: Brief): string {
  if (brief.contentType === 'review') {
    return `- Parts: an intro (2–3 sentences, ~60 words), 3–5 body parts (150–250 words each — performance, design, value, family use, or whatever this product actually turns on), and a closing titled "The Verdict" (1–2 paragraphs, ~120 words, a clear buy/skip call).
- Blocks: a review normally earns tldr, keyTakeaways, bestFor, notFor and prosCons; faqs only if real purchase questions exist for this product.`
  }
  const inquiry = brief.inquiryMode
  if (brief.pieceType === 'essay') {
    return `- Parts: an intro that opens inside a real moment FROM THE AUTHOR FACTS (or on the question itself if there is none — never an invented memory), 4–7 body parts (150–300 words each) that move the story or argument forward${inquiry ? ', one of which states the strongest opposing view and answers it in the same part' : ''}, and a closing (1–2 paragraphs) that lands honestly without a bow on top${inquiry ? ' — on the position, stated as a conviction, with the reason it convinced you; never a shrug' : ''}.
- Blocks: essays normally earn none.`
  }
  if (brief.pieceType === 'howto') {
    return `- Parts: an intro (2–3 sentences naming the problem), 3–5 body parts (120–200 words each, one step or decision each, phone-skimmable), and a closing (1–2 sentences, the single most important next step).
- Blocks: tldr + keyTakeaways; faqs rarely.`
  }
  return `- Parts: an intro (2–3 sentences, a real scenario from the facts or the reader's own situation — no invented anecdote), 5–8 body parts (200–350 words each, each with a clear takeaway${inquiry ? ' — or, in the inquiry register, each advancing the argument one real step, one part stating the strongest opposing view and answering it' : ''}), and a closing titled "Wrapping Up" (1–2 paragraphs with a specific next step${inquiry ? ' — stating the position as a conviction and the reason it convinced you' : ''}).
- Blocks: tldr + keyTakeaways + faqs for a comprehensive guide; drop any the topic doesn't earn.`
}

export function outlinePrompt(brief: Brief, related: RelatedPiece[]): string {
  const facts = briefFacts(brief)
  const slugs = briefProductSlugs(brief)
  const inquiry = brief.contentType === 'guide' && brief.inquiryMode
  const fixedImages = brief.imageSlots !== 'auto' ? brief.imageSlots : null

  return `${inquiry ? `${INQUIRY_TRIGGER}\n\nThis is a discussion piece, not a gear piece — plan it in the inquiry register — a witness, not a student: humble in posture, decisive in substance. The outline must arrive at a position; every body part moves toward it.\n\n` : ''}Plan a dad-focused ${briefLabel(brief)}. Produce the OUTLINE only — no prose.

${briefHeaderLines(brief)}
${briefDataBlocks(brief) ? `\n${briefDataBlocks(brief)}\n` : ''}
AUTHOR FACTS (${facts.length ? 'the only firsthand material this piece may claim — assign each fact to the part where it belongs, verbatim' : 'NONE — the author gave no firsthand notes, so plan parts that need none: no testing scenarios, no family moments, no "last weekend"'}):
${facts.length ? facts.map((f) => `- ${f}`).join('\n') : '(none)'}

STRUCTURE:
${structureGuidance(brief)}
- Headings are specific and useful, written the way a reader scans ("Battery life across a weekend", not "Performance").
- "intent" is one plain sentence a writer could act on.
- "format" is a recommendation the author sees: give a part "steps" or "list" only when a reader would genuinely scan it that way (a sequence they perform; 3+ parallel options or criteria; a checklist). Narrative, argument, verdicts and intros are "prose".
- "elements" are boxed body elements the author sees and keeps or drops. Recommend a callout only where a warning, safety point, tip or faith note would otherwise break a paragraph; ONE steps box for a piece that teaches a procedure (it recaps the steps the prose explains — after the introduction or after the last step part); ONE facts box when the piece will state 3+ hard numbers worth scanning (price paid, weight, capacity, time tested) — reviews with author facts usually earn it; ONE timeline when the piece narrates a dated sequence (a testing period, a first year, a season); ONE chart only when 3+ numbers in the SAME unit will be compared (never for a lone figure, never invented); ONE video slot only for a how-to where a 30-second demo beats words — the author supplies the clip, so name the subject precisely in "reason". Essays earn none. Most pieces earn 0–1.
- Target words per part should fit the content, not a template — a simple product gets a shorter piece.
${slugs.length ? `- Product links are placed by the system, not by you — do not mention them.\n` : ''}${fixedImages != null ? `- imageCount must be exactly ${fixedImages}.` : '- imageCount: 2–3 if images would genuinely help, 0–1 for a short or abstract piece.'}
${related.length ? `
ALREADY PUBLISHED on this site (if one of these covers the same ground, say so in the first title option by prefixing "DUPLICATE? " — otherwise plan this piece to complement them, not repeat them):
${related.map((r) => `- [${r.type}] ${r.title} (/${r.type}s/${r.slug})`).join('\n')}
` : ''}
Return the outline as the structured object; each field's description says what it needs.`
}

/**
 * Product tokens are assigned in code so the per-document rules hold exactly:
 * one slug → first body part, a middle body part, the closing (the system
 * prompt's EARLY / MID / VERDICT rule); several slugs → one each, spread across
 * body parts; none → nothing.
 */
export function assignProductTokens(parts: OutlinePart[], brief: Brief): OutlinePart[] {
  const slugs = briefProductSlugs(brief)
  const out = parts.map((p) => ({ ...p, productToken: null as string | null }))
  if (!slugs.length) return out

  const bodyIdx = out.map((p, i) => (p.kind === 'body' ? i : -1)).filter((i) => i >= 0)
  const closingIdx = out.findIndex((p) => p.kind === 'closing')

  if (slugs.length === 1 && brief.contentType === 'review') {
    const slug = slugs[0]
    if (bodyIdx.length) out[bodyIdx[0]].productToken = slug
    if (bodyIdx.length > 2) out[bodyIdx[Math.floor(bodyIdx.length / 2)]].productToken = slug
    else if (bodyIdx.length === 2) out[bodyIdx[1]].productToken = slug
    if (closingIdx >= 0) out[closingIdx].productToken = slug
    return out
  }

  // Guides: one token per slug, spread across body parts in order.
  const targets = bodyIdx.length ? bodyIdx : (closingIdx >= 0 ? [closingIdx] : [])
  slugs.forEach((slug, n) => {
    const idx = targets[Math.min(n, targets.length - 1)]
    if (idx != null) out[idx].productToken = out[idx].productToken ?? slug
  })
  return out
}

/**
 * Keep only element plans that point at a real part (exact heading, or '' for
 * the intro), at most one steps box, none on an essay. Order follows the parts.
 */
export function normalizeElementPlans(plans: ElementPlan[] | undefined, parts: OutlinePart[], brief: Brief): ElementPlan[] {
  if (!plans?.length) return []
  if (brief.contentType === 'guide' && brief.pieceType === 'essay') return []
  const headings = parts.filter((p) => p.kind !== 'intro').map((p) => p.heading)
  const norm = (h: string) => h.trim().toLowerCase()
  const out: ElementPlan[] = []
  const seen = new Set<string>()
  for (const p of plans) {
    const after = p.afterHeading.trim()
    const match = after === '' ? '' : headings.find((h) => norm(h) === norm(after))
    if (match == null) continue
    // One steps / facts / timeline box per piece; callouts may repeat.
    if (p.type !== 'callout') { if (seen.has(p.type)) continue; seen.add(p.type) }
    out.push({ type: p.type, afterHeading: match, reason: p.reason.trim() })
  }
  const order = (h: string) => (h === '' ? -1 : headings.indexOf(h))
  return out.sort((a, b) => order(a.afterHeading) - order(b.afterHeading)).slice(0, 3)
}

/** Normalise the model's outline into the editable Outline the run stores. */
export function buildOutline(model: OutlineModelOutput, brief: Brief, related: RelatedPiece[]): Outline {
  const parts: OutlinePart[] = []
  const intro = model.parts.find((p) => p.kind === 'intro')
  const closing = [...model.parts].reverse().find((p) => p.kind === 'closing')
  const bodies = model.parts.filter((p) => p.kind === 'body')

  parts.push({
    kind: 'intro', heading: '', intent: intro?.intent ?? 'Open the piece.',
    notes: intro?.notes ?? [], targetWords: intro?.targetWords ?? 60, productToken: null,
  })
  const essay = brief.contentType === 'guide' && brief.pieceType === 'essay'
  for (const b of bodies) {
    parts.push({
      kind: 'body', heading: b.heading.trim() || 'Untitled', intent: b.intent, notes: b.notes, targetWords: b.targetWords, productToken: null,
      // Essays never get a list spine, whatever the model said (critic: list-in-essay).
      format: essay ? 'prose' : (b.format ?? 'prose'),
    })
  }
  const closingHeading = brief.contentType === 'review' ? 'The Verdict' : 'Wrapping Up'
  parts.push({
    kind: 'closing', heading: closing?.heading.trim() || closingHeading, intent: closing?.intent ?? 'Land the piece.',
    notes: closing?.notes ?? [], targetWords: closing?.targetWords ?? 120, productToken: null,
  })

  const duplicate = model.titleOptions.find((t) => /^DUPLICATE\?/i.test(t))
  const titleOptions = model.titleOptions.map((t) => t.replace(/^DUPLICATE\?\s*/i, '').trim()).filter(Boolean)
  const defaults = defaultBlockChoices(brief)

  return {
    title: titleOptions[0] ?? briefHeaderLines(brief).split('\n')[0],
    titleOptions,
    excerpt: model.excerpt,
    parts: assignProductTokens(parts, brief),
    blocks: {
      ...model.blocks,
      // Sub-scores exist only on reviews and are always offered there (the
      // author confirms the numbers before save).
      subScores: defaults.subScores,
    },
    imageCount: brief.imageSlots !== 'auto' ? brief.imageSlots : model.imageCount,
    elements: normalizeElementPlans(model.elements, parts, brief),
    related,
    duplicateWarning: duplicate
      ? 'The planner thinks this topic is already covered on the site — check the related pieces before writing.'
      : null,
  }
}

/** Author edits come back through this; keeps the invariants the stages rely on. */
export const OutlineEdit = z.object({
  title:    z.string().min(1).max(120),
  excerpt:  z.string().min(1).max(200),
  parts:    z.array(z.object({
    kind:         z.enum(['intro', 'body', 'closing']),
    heading:      z.string().max(200),
    intent:       z.string().min(1).max(400),
    notes:        z.array(z.string().max(300)).max(12),
    targetWords:  z.number().int().min(40).max(600),
    productToken: z.string().regex(/^[a-z0-9-]+$/).max(80).nullable(),
    // Optional: runs stored before 2026-10-25 have no format. z.object strips
    // unknown keys, so leaving this out would silently drop the author's choice.
    format:       z.enum(['prose', 'steps', 'list']).optional(),
  })).min(3).max(12),
  elements: z.array(z.object({
    type:         z.enum(PLAN_TYPES),
    afterHeading: z.string().max(200),
    reason:       z.string().max(160),
  })).max(3).optional(),
  blocks:   z.object({
    tldr: z.boolean(), keyTakeaways: z.boolean(), faqs: z.boolean(),
    bestFor: z.boolean(), notFor: z.boolean(), prosCons: z.boolean(), subScores: z.boolean(),
  }),
  imageCount: z.number().int().min(0).max(6),
})

export function validateOutlineShape(parts: { kind: string }[]): string | null {
  if (parts[0]?.kind !== 'intro') return 'The first part must be the intro.'
  if (parts[parts.length - 1]?.kind !== 'closing') return 'The last part must be the closing.'
  if (parts.filter((p) => p.kind === 'intro').length !== 1) return 'Exactly one intro.'
  if (parts.filter((p) => p.kind === 'closing').length !== 1) return 'Exactly one closing.'
  if (!parts.some((p) => p.kind === 'body')) return 'At least one body part.'
  return null
}

export { hasFirsthand }

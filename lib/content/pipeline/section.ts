import { INQUIRY_TRIGGER } from '../prompts'
import { sourceLinkLines } from '../links'
import { assembleDraftHtml } from '../html'
import { briefDataBlocks, briefHeaderLines, briefLabel, hasFirsthand, hasReferences } from './briefs'
import type { Brief, OutlinePart, PartFormat, RunState } from './types'

// Stage 2 — one part at a time, streamed. Each call sees the approved outline,
// everything written so far, and ONLY this part's share of the author's facts.

const KIND_LABEL = { intro: 'introduction', body: 'section', closing: 'closing' } as const

export function sectionBudget(targetWords: number): number {
  // ~1.5 tokens/word of prose plus thinking headroom: adaptive thinking shares
  // `maxOutputTokens` on the 5 generation, and at effort high Opus 5 spends
  // 500–1700 reasoning tokens on one part (measured 2026-11-01 — a 350-word
  // part hit the old 2200 cap with 1646 of them). Billing is by tokens used,
  // not the cap, so the headroom is free until it's needed.
  return Math.min(8000, Math.max(3500, Math.round(targetWords * 4) + 3000))
}

/** The prose written so far, in order, with headings — what the model must not repeat. */
export function priorProse(run: RunState, upTo: number): string {
  const parts = run.outline?.parts ?? []
  const out: string[] = []
  for (let i = 0; i < upTo; i++) {
    const s = run.sections[i]
    if (!s) continue
    const p = parts[i]
    out.push(p.kind === 'intro' ? s.text : `## ${p.heading}\n\n${s.text}`)
  }
  return out.join('\n\n')
}

export function sectionPrompt(run: RunState, index: number): string {
  const outline = run.outline
  if (!outline) throw new Error('No outline')
  const part = outline.parts[index]
  if (!part) throw new Error('No such part')
  const brief = run.brief
  const inquiry = brief.contentType === 'guide' && brief.inquiryMode
  const total = outline.parts.length
  const prior = priorProse(run, index)
  const firsthand = hasFirsthand(brief)
  // Specs + competitors only: this part's reference share arrives via `part.refs` below,
  // not the whole reference block (which ran to 120 lines at ten links).
  const data = briefDataBlocks(brief, { references: false })

  const headingLine = part.kind === 'intro' ? '(no heading — this opens the piece)' : `"${part.heading}"`
  const tokenLine = part.productToken
    ? `Product link for this part: embed exactly ONE [[BUY:${part.productToken}]] token, ${part.kind === 'closing' ? 'at the very end after the closing recommendation' : "at the end of this part's strongest benefit statement"}. Never write a raw URL.`
    : 'Product link for this part: none — write no [[BUY:]] tokens here.'

  const kindRules = part.kind === 'intro'
    ? (firsthand && part.notes.length
        ? 'Open inside a real moment from the notes below (first person). 2–3 sentences; no throat-clearing, no "in this article".'
        : 'Open on the decision or question the reader is facing. No invented scenario, no "last weekend my son…" — the notes carry nothing like that. 2–3 sentences.')
    : part.kind === 'closing'
      ? (brief.contentType === 'review'
          ? 'This is the verdict: a clear buy / skip call that matches the target rating, honest about who it is not for.'
          : inquiry
            ? 'State the position as a conviction — what you believe and the reason it convinced you. If one specific sub-question genuinely stays open, name it in a sentence. Never end on a shrug, a both-sides wrap-up, "it\'s up to each dad", or a question in place of the answer. No recap.'
            : 'Land it with one specific next step. No bow on top, no recap of every section.')
      : inquiry
        ? 'Advance the argument one real step — this part exists to move the reader toward the position, not to survey. If this part raises the opposing view, state it at its strongest and answer it here, in the same part. No hedging on the thesis. Humor is welcome at an idea or a trend, never at a person. End when the step is made — no summary sentence, no "but who\'s to say".'
        : 'Lead with the most useful information, not background. Every claim needs a specific. End when the part has done its job — no summary sentence.'

  return `${inquiry ? `${INQUIRY_TRIGGER}\n\nThis is a discussion piece in the inquiry register (see your system prompt): a witness, not a student — humble in posture, decisive in substance. You have reached a conviction and are showing your work.\n\n` : ''}STAGED DRAFTING — you are writing ONE part of a ${briefLabel(brief)}: part ${index + 1} of ${total}, the ${KIND_LABEL[part.kind]} ${headingLine}.

Title: ${outline.title}
${briefHeaderLines(brief)}
${data ? `\n${data}\n` : ''}
FULL OUTLINE (headings in order — write only yours):
${outline.parts.map((p, i) => `${i + 1}. ${p.kind === 'intro' ? '[intro]' : p.kind === 'closing' ? `[closing] ${p.heading}` : p.heading}${i === index ? '   ← THIS PART' : ''}`).join('\n')}
${prior ? `
WRITTEN SO FAR (continue from here; do not repeat or summarise it):
"""
${prior}
"""
` : ''}
THIS PART
- Intent: ${part.intent}
- Target length: about ${part.targetWords} words.
- ${kindRules}
- ${registerRule(outline.register)}
- ${tokenLine}
${part.notes.length
    ? `- Author facts for this part — the ONLY firsthand material you may claim; use them concretely, don't restate them as a list:\n${part.notes.map((n) => `    • ${n}`).join('\n')}`
    : `- Author facts for this part: none. Write from general knowledge and the product/topic facts above. Do NOT claim any usage, test result, duration or family reaction.`}
${referenceLines(part, brief)}
${disciplineRules(brief, !!prior)}
${formatRules(part, brief)}

Write only the prose of this part: no heading, no title, no preamble, no sign-off. Paragraphs separated by a blank line. No JSON, no # or ## headings, no code fences, no tables, no HTML.`
}

/**
 * The register — decided once at the outline, shown to every part — plus the
 * standing rule behind it (brand-guide §1.6 "The topic sets the register"):
 * the subject on its own terms; fatherhood where the part's intent or facts
 * bring it. Before 2026-11-13 the system prompt framed every piece at the
 * family table, and the pictures followed the prose into the kitchen.
 */
function registerRule(register: string | undefined): string {
  const set = register ? `Register (set at the outline): ${register} ` : ''
  return `${set}Write this part on the subject's own terms, in its own world and vocabulary. Fatherhood, the kids and the family table enter where this part's intent or facts bring them — not as a reflex; "we dads know" is a tool, not the frame.`
}

/**
 * The two rules the 2026-11-13 eval showed the writer breaking most (plan §4a):
 * specifics invented past the notes — the dominant finding class in every run
 * since the 10-23 baseline — and parts written one at a time disagreeing with
 * each other ("a two-evening job" in the intro, a four-day schedule in the close).
 * The first rule names the forms the inventions took; the second makes the
 * earlier part the authority when this part's intent pulls the other way.
 */
function disciplineRules(brief: Brief, hasPrior: boolean): string {
  const firsthand = hasFirsthand(brief)
  const scene = firsthand
    ? 'You may set a scene the notes give; you may not furnish it with details they do not — no "cleats still on", no "flat on my back", no reconstructed conversation, no reaction nobody recorded.'
    : 'With no author facts there is no scene to set — no "last weekend", no reaction, no "I noticed".'
  const continuity = hasPrior
    ? '- Continuity: this part agrees with everything WRITTEN SO FAR — every number, count, name, sequence of steps, time span, product term and claim about what happened stays exactly as an earlier part stated it (an earlier "two-evening job" is not laid out over four days here; a roster of nine stays nine; the same patch is not a mesh in one part and a metal plate in another). Where this part\'s intent conflicts with what an earlier part already said, keep the earlier part\'s facts and serve the intent with them. Check the written parts for the figures and sequence you are about to use before you write.'
    : '- Continuity: what this part states — numbers, counts, names, sequence, time spans — is what every later part must agree with, so state only what the facts above support; a figure you are not sure of is left unsaid, not estimated.'
  return `- Specifics: every number, price, duration, count, measurement, date, model name, scene, line of dialogue, physical detail, mishap and reaction comes from the author facts, the product facts or the reference facts above — nothing else. ${scene} Where a specific would strengthen the sentence and the facts above do not have it, write the general truth instead; never fill the gap. A sweeping claim of experience ("I\'ve met grown men who…", "every dad I know") is an argument, not a memory — make it one. A statistic or study not in the facts above: name it with its source only if you are certain of both; otherwise make the point without the number. Never invent a figure or a source.\n${continuity}`
}

/**
 * This part's share of the reference facts (assigned at the outline), with the
 * attribution rule; a "cite nothing here" line when the piece has references
 * but this part got none; '' when the brief carries no references at all.
 */
function referenceLines(part: OutlinePart, brief: Brief): string {
  const refs = part.refs ?? []
  if (refs.length) {
    // Only the addresses of sources this part cites are offered, so a link can't wander.
    const links = sourceLinkLines(brief, refs)
    return `- Reference facts for this part — attributed knowledge, NOT experience: state each as what its source says ("the maker lists…", "per the recall notice"), name the source in words, and never claim you tested what only the source states:\n${refs.map((r) => `    • ${r}`).join('\n')}${links ? `\n- Source links: the FIRST time this part names one of these sources, write the name as a link in exactly this form — [Name](url) — using only these addresses, each at most once. A source not listed here is named in words only. Never any other URL:\n${links.split('\n').map((l) => `    ${l}`).join('\n')}` : ''}`
  }
  if (hasReferences(brief)) return '- Reference facts for this part: none. Cite no source in this part — the sourced facts belong to other parts.'
  return ''
}

/**
 * The light-Markdown subset the part may use and when (docs/rich-elements-plan.md
 * §2). `paragraphsToHtml` renders exactly this subset; anything else stays literal.
 */
export function formatRules(part: OutlinePart, brief: Brief): string {
  const essay = brief.contentType === 'guide' && brief.pieceType === 'essay'
  const format: PartFormat = part.kind === 'body' ? (part.format ?? 'prose') : 'prose'
  const shape = essay
    ? 'This is an essay: paragraphs only. No lists, no sub-headings — the argument carries itself.'
    : format === 'steps'
      ? 'This part is STEPS: one numbered list ("1. ", "2. " …) is the spine of the part — one action per item, a bold lead-in ("**Check the straps.** Then…") and a sentence or two after it; a short paragraph before the list to set it up and, if useful, one after. No second list.'
      : format === 'list'
        ? 'This part is a LIST: one bulleted list ("- ") of the parallel options, criteria or items — a bold lead-in per item, then the specific that makes it true; a short paragraph before the list to set it up. No second list.'
        : part.kind === 'body'
          ? 'This part is PROSE: paragraphs. A short list (3–6 items) is fine only if the reader would genuinely scan it — a sequence they perform, a checklist, 3+ parallel options; never a list of the paragraph you were about to write.'
          : 'Paragraphs only — no lists here.'
  return `FORMAT (light Markdown — only these marks exist; everything else is literal text):
- ${shape}
- "**bold**" for a lead-in or the one phrase that matters; "*italic*" sparingly.
- "### " starts a sub-heading inside this part — only when a 200+ word part splits into two clearly different halves; never for a short part.
- "> " starts a one-sentence pull-quote: at most one per piece, and only a line that earns re-reading.${
    part.productToken && (format === 'steps' || format === 'list')
      ? '\n- The [[BUY:]] token goes in a paragraph before or after the list, never inside a list item.'
      : ''}`
}

/** All written parts as structured text ("## heading" + prose) for the blocks and critic stages. */
export function runProse(run: RunState): string {
  return priorProse(run, run.sections.length)
}

/** The run's prose as body HTML for the preview / save, with image placeholders. */
export function runToDraftHtml(run: RunState): string {
  const parts = run.outline?.parts ?? []
  const intro = parts.findIndex((p) => p.kind === 'intro')
  const closing = parts.findIndex((p) => p.kind === 'closing')
  const bodies = parts
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.kind === 'body')
    .map(({ p, i }) => ({ heading: p.heading, body: run.sections[i]?.text ?? '' }))
    .filter((s) => s.body.trim())
  return assembleDraftHtml({
    introduction: intro >= 0 ? run.sections[intro]?.text ?? '' : '',
    sections: bodies,
    closing: closing >= 0 && run.sections[closing]?.text ? { heading: parts[closing].heading, body: run.sections[closing]!.text } : null,
    inlineImages: run.images?.inline ?? [],
    elements: run.blocks?.elements ?? [],
    videoSlots: (run.outline?.elements ?? [])
      .filter((e) => e.type === 'video')
      .map((e) => ({ afterHeading: e.afterHeading, subject: e.reason })),
  })
}

export function nextUnwrittenIndex(run: RunState): number {
  const n = run.outline?.parts.length ?? 0
  for (let i = 0; i < n; i++) if (!run.sections[i]?.text) return i
  return -1
}

export function partLabel(p: OutlinePart): string {
  return p.kind === 'intro' ? 'Introduction' : p.heading
}

import { INQUIRY_TRIGGER } from '../prompts'
import { assembleDraftHtml } from '../html'
import { briefDataBlocks, briefHeaderLines, briefLabel, hasFirsthand } from './briefs'
import type { OutlinePart, RunState } from './types'

// Stage 2 — one part at a time, streamed. Each call sees the approved outline,
// everything written so far, and ONLY this part's share of the author's facts.

const KIND_LABEL = { intro: 'introduction', body: 'section', closing: 'closing' } as const

export function sectionBudget(targetWords: number): number {
  // ~1.5 tokens/word of prose plus thinking headroom (adaptive thinking shares
  // the budget on the 5 generation); floor keeps tiny parts from truncating.
  return Math.min(6000, Math.max(1500, Math.round(targetWords * 4) + 800))
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

  const headingLine = part.kind === 'intro' ? '(no heading — this opens the piece)' : `"${part.heading}"`
  const tokenLine = part.productToken
    ? `Product link for this part: embed exactly ONE [[BUY:${part.productToken}]] token, ${part.kind === 'closing' ? 'at the very end after the closing recommendation' : "at the end of this part's strongest benefit statement"}. Never write a raw URL.`
    : 'Product link for this part: none — write no [[BUY:]] tokens here.'

  const kindRules = part.kind === 'intro'
    ? (firsthand && part.notes.length
        ? 'Open inside a real moment from the notes below (first-person dad). 2–3 sentences; no throat-clearing, no "in this article".'
        : 'Open on the decision or question the reader is facing. No invented scenario, no "last weekend my son…" — the notes carry nothing like that. 2–3 sentences.')
    : part.kind === 'closing'
      ? (brief.contentType === 'review'
          ? 'This is the verdict: a clear buy / skip call that matches the target rating, honest about who it is not for.'
          : inquiry
            ? 'Commit to your best answer and say plainly why you find it convincing; name what genuinely stays open, but don\'t end on a shrug.'
            : 'Land it with one specific next step. No bow on top, no recap of every section.')
      : 'Lead with the most useful information, not background. Every claim needs a specific. End when the part has done its job — no summary sentence.'

  return `${inquiry ? `${INQUIRY_TRIGGER}\n\nThis is a discussion piece in the inquiry register (see your system prompt): humble in posture, decisive in substance.\n\n` : ''}STAGED DRAFTING — you are writing ONE part of a ${briefLabel(brief)}: part ${index + 1} of ${total}, the ${KIND_LABEL[part.kind]} ${headingLine}.

Title: ${outline.title}
${briefHeaderLines(brief)}
${briefDataBlocks(brief) ? `\n${briefDataBlocks(brief)}\n` : ''}
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
- ${tokenLine}
${part.notes.length
    ? `- Author facts for this part — the ONLY firsthand material you may claim; use them concretely, don't restate them as a list:\n${part.notes.map((n) => `    • ${n}`).join('\n')}`
    : `- Author facts for this part: none. Write from general knowledge and the product/topic facts above. Do NOT claim any usage, test result, duration or family reaction.`}

Write only the prose of this part: no heading, no title, no preamble, no sign-off. Paragraphs separated by a blank line. Plain text — no JSON, no markdown headings, no bullet lists unless the intent calls for one.`
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

import { z } from 'zod'
import { INQUIRY_TRIGGER } from '../../prompts'
import { briefFacts, briefLabel } from '../briefs'
import { runProse } from '../section'
import type { Blocks, RunState } from '../types'

// Stage 4b — the judgement half of the critic: the things a regex can't see.
// Temperature 0, low effort, findings only. It is told what the author
// actually did, so "firsthand claim with no note behind it" is answerable.

export const CRITIC_CODES = [
  'unsupported-firsthand',   // "I ran it for three weekends" with no note saying so
  'invented-anecdote',       // a family moment, friend, or scene not in the notes
  'claim-without-specifics', // "long battery life" where a number was available or none exists
  'contradiction',           // the prose disagrees with a spec, a note, or itself
  'tone-edge-on',            // roast/smirk on a vulnerable or safety topic
  'preachy',                 // sermonising, scripture saturation, judging another man's walk — conviction stated as the author's own is NOT preachy
  'generic',                 // a part that could be about any product / any topic
  'rating-mismatch',         // verdict or tone disagrees with the target rating
  'other',
] as const

export const CriticOutput = z.object({
  findings: z.array(z.object({
    severity: z.enum(['block', 'warn', 'note']),
    code:     z.enum(CRITIC_CODES),
    message:  z.string().min(1).max(300).describe('One sentence an editor could act on'),
    part:     z.number().int().min(1).nullable().describe('1-based part number from the outline, or null if whole-piece'),
    quote:    z.string().max(200).nullable().describe('The offending phrase, verbatim and short'),
  })).max(20),
  summary: z.string().max(500).describe('Two sentences: the piece\'s biggest strength and its biggest risk'),
})
export type CriticModelOutput = z.infer<typeof CriticOutput>

/** The structured blocks as plain text for the editor (null when none were derived yet). */
export function blocksText(run: { blocks: Blocks | null }): string | null {
  const b = run.blocks
  if (!b) return null
  const lines: string[] = []
  if (b.tldr) lines.push(`TL;DR: ${b.tldr}`)
  if (b.keyTakeaways?.length) lines.push(`Key takeaways:\n${b.keyTakeaways.map((t) => `- ${t}`).join('\n')}`)
  if (b.bestFor?.length) lines.push(`Best for:\n${b.bestFor.map((t) => `- ${t}`).join('\n')}`)
  if (b.notFor?.length) lines.push(`Not for:\n${b.notFor.map((t) => `- ${t}`).join('\n')}`)
  if (b.pros?.length) lines.push(`Pros:\n${b.pros.map((t) => `- ${t}`).join('\n')}`)
  if (b.cons?.length) lines.push(`Cons:\n${b.cons.map((t) => `- ${t}`).join('\n')}`)
  if (b.faqs?.length) lines.push(`FAQs:\n${b.faqs.map((f) => `Q: ${f.question}\nA: ${f.answer}`).join('\n\n')}`)
  if (b.subScores) lines.push(`Suggested sub-scores: quality ${b.subScores.quality}, value ${b.subScores.value}, ease ${b.subScores.ease}, daily use ${b.subScores.dailyUse}; would rebuy: ${b.wouldRebuy ? 'yes' : 'no'}`)
  for (const el of b.elements ?? []) {
    const where = el.afterHeading ? `after "${el.afterHeading}"` : 'after the introduction'
    if (el.type === 'callout') lines.push(`Callout (${el.kind}, ${where}) "${el.title}": ${el.body}`)
    else if (el.type === 'steps') lines.push(`Steps box (${where}) "${el.title}"${el.time ? `, ${el.time}` : ''}:\n${el.items.map((i, n) => `${n + 1}. ${i.title} — ${i.body}`).join('\n')}`)
    else if (el.type === 'facts') lines.push(`Key facts (${where}) "${el.title}":\n${el.items.map((f) => `- ${f.label}: ${f.value}`).join('\n')}`)
    else if (el.type === 'chart') lines.push(`Chart (${where}) "${el.title}"${el.unit ? ` in ${el.unit}` : ''}:\n${el.items.map((r) => `- ${r.label}: ${r.value}`).join('\n')}`)
    else lines.push(`Timeline (${where}) "${el.title}":\n${el.items.map((e) => `- ${e.when}: ${e.title}${e.body ? ` — ${e.body}` : ''}`).join('\n')}`)
  }
  return lines.join('\n\n') || null
}

/** The critic's own system prompt — the editor, never the writer (no voice blocks on purpose). */
export const CRITIC_SYSTEM =
  'You are a meticulous, fair editor for Boss Daddy (BossDaddyLife.com), a dad-focused gear and life site. You return findings only, never rewrites. You never flag religious, moral or metaphysical positions as misleading claims — stating them is the genre on discussion pieces.'

/**
 * @param profileFacts The author's standing profile as "- label: value" lines
 *   (`voiceProfileFactLines`, relationships only — names never reach the
 *   critic). The writer sees these in its system prompt, so a fiancée, a
 *   region or a trade is on record even when the brief's notes never mention
 *   it; without this block the editor flagged every such line as invented
 *   (eval baseline 2026-10-23: "my fiancé's 2014 Odyssey").
 */
export function criticPrompt(run: RunState, blocksText: string | null, profileFacts: string[] = []): string {
  const brief = run.brief
  const inquiry = brief.contentType === 'guide' && brief.inquiryMode
  const facts = briefFacts(brief)
  const parts = run.outline!.parts

  return `${inquiry ? `${INQUIRY_TRIGGER}\n\n` : ''}You are the EDITOR, not the writer. Read this ${briefLabel(brief)} against the author's notes and the house rules, and return findings only. Be specific and sparing — a finding must be something an editor would actually change. Severity: block = must fix before publishing; warn = should fix; note = worth a look.

Title: ${run.outline!.title}
${brief.contentType === 'review' ? `Author's target rating: ${brief.ratingHint}/10.` : ''}

AUTHOR NOTES (${facts.length ? 'the only firsthand experience on record — any usage claim, duration, test result, family reaction, friend or anecdote NOT traceable to these is unsupported-firsthand or invented-anecdote' : 'NONE — any firsthand claim at all is unsupported'}):
${facts.length ? facts.map((f) => `- ${f}`).join('\n') : '(none)'}
${profileFacts.length ? `
ALSO ON RECORD — the author's standing profile (family by relationship, background, region). Mentioning one of these is NOT invented. What IS still unsupported: any specific event, quote, reaction or detail about them that the notes above don't give.
${profileFacts.join('\n')}
` : ''}
PARTS (1-based, for the "part" field):
${parts.map((p, i) => `${i + 1}. ${p.kind === 'intro' ? '[intro]' : p.heading}`).join('\n')}

THE PIECE:
"""
${runProse(run)}
"""
${blocksText ? `
STRUCTURED BLOCKS (judge them too — they must be traceable to the prose):
${blocksText}
` : ''}
WHAT TO CHECK (the banlist words, product-token counts and family names are checked by code — don't repeat those):
- Firsthand claims and anecdotes against the notes (the FTC question).
- Claims without specifics where a specific was available, or where none exists and the claim should go.
- Contradictions with the specs, the notes, or between parts.
- Tone: the roast must be OFF on safety, loss, struggle, money hardship — flag edge where it shouldn't be. Humor aimed at an idea, a trend or an institution is on-brand — flag only humor aimed at a named person, a man's worth, or his struggle.
- Faith density (brand-guide §1.6): on product, review, how-to and money pieces, more than one faith reference, or any scripture the notes didn't supply, is a warn ("sermon creep"); on discussion pieces, conviction stated plainly is correct — flag only saturation or lecturing the reader.${inquiry ? `
- Inquiry register — a witness, not a student. Severities here are fixed:
  - block: the piece never lands — no position stated as the author's conviction, or a closing that hands the question back ("it's up to each dad", a both-sides-equal wrap-up, a question in place of the answer).
  - block: preaching that judges another man's walk, or party politics (candidates, parties, campaign framing, personal attacks on named people). A firm moral position is NOT preaching and NOT partisanship — it is the job; never flag a stance for being a stance.
  - warn: an opposing view aired at full strength and not answered in the same part, or a strawman.
  - warn: the author performing doubt about his own thesis ("I'm not sure about any of this", "I could be wrong about all of it") instead of naming one open sub-question.
  - warn: a faith passage that presents the foundation (grace through faith) as one option among several the author is weighing.` : ''}
- A part that could be about any product or topic ("generic").
${brief.contentType === 'review' ? '- Does the verdict and the overall tone match the target rating?\n' : ''}
Return the structured object. An empty findings list is a valid, good answer.`
}

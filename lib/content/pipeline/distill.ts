import { z } from 'zod'
import { briefFacts, briefHeaderLines, briefLabel } from './briefs'
import type { Brief } from './types'

// The brief step (docs/content-pipeline-plan.md §4a, 2026-11-13): before the
// outline, the author's whole dump — dictated notes, pasted logs, the structured
// fields — becomes (1) clean firsthand FACTS, one per line, in the author's own
// specifics; (2) the GAPS a reader of this piece would expect answered and the
// notes don't: the specifics a writer would otherwise be tempted to invent, which
// the eval found to be the dominant finding class; (3) ASIDES — instructions the
// notes carried that are not facts. The author edits the facts, answers the gaps
// (each answer becomes "Label: answer"), and the curated list replaces the raw
// split on the brief (`Brief.facts`). Skippable; a failed distill never blocks.

export const MAX_DISTILL_FACTS = 60
export const MAX_DISTILL_GAPS = 6
export const MAX_DISTILL_ASIDES = 6
/** Under the outline's 300-char note cap. */
export const MAX_DISTILL_FACT_LEN = 280

export const DistillOutput = z.object({
  facts:  z.array(z.string()).describe("Every firsthand fact in the notes as a clean one-line statement in the author's own specifics"),
  gaps:   z.array(z.object({
    question: z.string().describe('One plain question, dad to dad'),
    label:    z.string().describe('A 2–5 word noun phrase that will prefix the answer, e.g. "Time owned"'),
    why:      z.string().nullable().optional().describe('Under 12 words: why a reader expects this'),
  })).describe('Up to 6 questions the notes do not answer; none that they do'),
  asides: z.array(z.string()).optional().describe('Instructions or wishes found in the notes (tone, structure, length) — not facts'),
})
export type DistillModelOutput = z.infer<typeof DistillOutput>

export interface DistillGap { question: string; label: string; why: string | null }
export interface Distilled { facts: string[]; gaps: DistillGap[]; asides: string[] }

export const DISTILL_SYSTEM = `You are the editor preparing a writer's brief for a product-review and dad-life site. The author's notes are raw: dictated, pasted, out of order, mixed with asides.
Return three things.
1. facts — every firsthand fact in the notes as a clean, one-line, self-contained statement, keeping the author's own specifics (numbers, durations, names of things, what happened, what broke, who was there). Under 40 words each, in the author's own first person ("I paid about $50 at Harbor Freight"), never "he". Merge duplicates, fix dictation, keep the order of events. Never add anything the notes do not say — not a brand, a place or a name the notes leave out; never soften or round a specific. An instruction or an opinion about the piece is not a fact.
2. gaps — up to 6 questions a reader of THIS piece would expect answered that the notes do not answer: the specifics a writer would otherwise be tempted to invent (how long it was owned or used, what was paid, which model or year, who else used it, what happened next, how it ended, where). Each has a question (one line, plain, dad to dad), a label (a 2–5 word noun phrase that will prefix the answer, e.g. "Time owned", "Price paid"), and why (under 12 words). Ask nothing the notes already answer. For a discussion piece the gaps are about the author's own experience and position, never research.
3. asides — any instruction or wish found IN THE NOTES THEMSELVES (tone, structure, length, what to avoid) as short lines, so the writer sees them without mistaking them for facts. The brief's own fields (product, category, target rating) are not asides.`

/** The author's raw firsthand material as the model should see it; '' when there is none. */
export function firsthandSource(brief: Brief): string {
  if (brief.contentType === 'review') {
    // The structured fields as lines, then the free notes — never the curated list, which is the output.
    const structured = briefFacts({ ...brief, facts: undefined, notes: undefined })
    return [structured.map((l) => `- ${l}`).join('\n'), brief.notes?.trim() ?? ''].filter(Boolean).join('\n\n')
  }
  return brief.context?.trim() ?? ''
}

export function distillPrompt(brief: Brief): string {
  return `Prepare the brief for a ${briefLabel(brief)}.

${briefHeaderLines(brief)}

THE AUTHOR'S NOTES (raw, firsthand):
"""
${firsthandSource(brief)}
"""

Return the structured object: facts, gaps, asides.`
}

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t
}

/** Caps and de-duplication on the model's output; the shapes the panel renders. */
export function normalizeDistilled(out: DistillModelOutput): Distilled {
  const facts: string[] = []
  for (const f of out.facts ?? []) {
    const t = clip(f, MAX_DISTILL_FACT_LEN)
    if (t && !facts.includes(t)) facts.push(t)
    if (facts.length >= MAX_DISTILL_FACTS) break
  }
  const gaps = (out.gaps ?? [])
    .map((g) => ({ question: clip(g.question ?? '', 200), label: clip(g.label ?? '', 60).replace(/:$/, ''), why: g.why ? clip(g.why, 120) : null }))
    .filter((g) => g.question && g.label)
    .slice(0, MAX_DISTILL_GAPS)
  const asides = (out.asides ?? []).map((a) => clip(a, 160)).filter(Boolean).slice(0, MAX_DISTILL_ASIDES)
  return { facts, gaps, asides }
}

/** An answered gap as the fact line the brief carries. */
export function gapToFact(label: string, answer: string): string {
  return `${label.trim().replace(/:$/, '')}: ${answer.replace(/\s+/g, ' ').trim()}`
}

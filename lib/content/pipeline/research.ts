import { z } from 'zod'
import {
  MAX_REFERENCES, MAX_REF_FACTS, MAX_REF_FACT_LEN,
  clipFact, isPasteKey, isRetailerUrl, normalizeLinkInput, referenceKey, referenceSourceName, scrubReferenceTitle,
  type ReferenceNote,
} from '../references'
import { sanitizeSpecValue } from '../specs'
import { briefLabel, briefSubject } from './briefs'
import type { Brief, RunState } from './types'

// "Research this part" (docs/content-pipeline-plan.md §4a, 2026-11-13): at the
// plan step, one live web search for the facts a section needs and the notes
// don't give. The author keeps what belongs; kept facts become that part's
// `refs` lines and their sources join the brief's references like any fetched
// link — so the section writer cites them, the critic counts them as supported,
// and the workspace panel shows them. Nothing is kept without the author.

export const MAX_RESEARCH_FINDINGS = 8

export const ResearchOutput = z.object({
  findings: z.array(z.object({
    fact:        z.string().describe('One line under 30 words stating exactly what the page says, with its number, date or name'),
    sourceTitle: z.string().nullable().optional().describe('The page title, or null'),
    sourceUrl:   z.string().describe('The address of the page the fact was retrieved from'),
  })).describe('3–6 facts; empty when nothing solid turned up'),
})
export type ResearchModelOutput = z.infer<typeof ResearchOutput>

export const RESEARCH_SYSTEM = `You are a research assistant for a product-review and dad-life site. Find the few verifiable facts a reader would want in ONE section of a piece.
- Search the web. Use only facts you actually retrieved, each with the address of the page it came from. Never answer from memory.
- Prefer the maker, government agencies, standards bodies, universities and major publications. Never a retailer product page, never a forum.
- Each fact is one line under 30 words with its number, date or name; no opinions, no marketing language, nothing inferred.
- 3–6 facts. If nothing solid turns up, return an empty list.`

export function researchPrompt(run: RunState, index: number): string {
  const brief = run.brief
  const part = run.outline?.parts[index]
  if (!part) throw new Error('No such part')
  const onRecord = [...part.notes, ...(part.refs ?? [])]
  const cited = new Set<string>()
  for (const n of brief.referenceNotes ?? []) if (n.status === 'ok' && !isPasteKey(n.url)) cited.add(n.url)
  return `Research ONE section of a ${briefLabel(brief)} about ${briefSubject(brief)}.

Section: ${part.kind === 'intro' ? 'the introduction' : `"${part.heading}"`}
What the section must do: ${part.intent}
${onRecord.length ? `
ALREADY ON RECORD for this section — do not repeat these:
${onRecord.map((l) => `- ${l}`).join('\n')}
` : ''}${cited.size ? `
SOURCES THE PIECE ALREADY USES — prefer a new one unless one of these is clearly best:
${[...cited].map((u) => `- ${u}`).join('\n')}
` : ''}
Search the web and return 3–6 verifiable facts a reader of this section would want, each with the address of its page. Return the structured object.`
}

export interface ResearchFinding {
  /** The ref line the part stores: "fact (source: name)". */
  line: string
  fact: string
  source: { url: string; title: string | null }
}
export interface ResearchResult {
  findings: ResearchFinding[]
  /** The sources behind the findings, in the brief's note shape. */
  notes: ReferenceNote[]
  costUsd: number | null
}

/** Model findings → scrubbed, de-duplicated findings grouped by source; retailer and bad addresses dropped. */
export function toResearchResult(raw: ResearchModelOutput['findings']): Omit<ResearchResult, 'costUsd'> {
  const byUrl = new Map<string, { title: string | null; facts: string[] }>()
  const findings: ResearchFinding[] = []
  const seen = new Set<string>()
  for (const f of raw) {
    const url = normalizeLinkInput(f.sourceUrl ?? '')
    if (!url || isRetailerUrl(url)) continue
    const fact = sanitizeSpecValue(clipFact(f.fact ?? ''), MAX_REF_FACT_LEN)
    if (!fact || seen.has(fact)) continue
    seen.add(fact)
    const entry = byUrl.get(url) ?? { title: scrubReferenceTitle(f.sourceTitle), facts: [] }
    entry.facts.push(fact)
    byUrl.set(url, entry)
    const name = referenceSourceName({ url, title: entry.title })
    findings.push({ line: `${fact} (source: ${name})`, fact, source: { url, title: entry.title } })
    if (findings.length >= MAX_RESEARCH_FINDINGS) break
  }
  const notes: ReferenceNote[] = [...byUrl].map(([url, e]) => ({ url, title: e.title, status: 'ok', facts: e.facts }))
  return { findings, notes }
}

/**
 * Research the author kept joins the brief: a `{ url }` reference per new source
 * and its note (facts merged into an existing note for the same address). null
 * when the reference list is full — the author removes one in the brief first.
 */
export function mergeResearchReferences(brief: Brief, notes: readonly ReferenceNote[]): Brief | null {
  const refs = [...(brief.references ?? [])]
  const listed = new Set(refs.map(referenceKey))
  for (const n of notes) {
    if (!listed.has(n.url)) { refs.push({ url: n.url }); listed.add(n.url) }
  }
  if (refs.length > MAX_REFERENCES) return null
  const byUrl = new Map((brief.referenceNotes ?? []).map((n) => [n.url, n]))
  for (const n of notes) {
    const prev = byUrl.get(n.url)
    byUrl.set(n.url, prev && prev.status === 'ok'
      ? { ...prev, facts: [...new Set([...prev.facts, ...n.facts])].slice(0, MAX_REF_FACTS) }
      : n)
  }
  return { ...brief, references: refs, referenceNotes: [...byUrl.values()] }
}

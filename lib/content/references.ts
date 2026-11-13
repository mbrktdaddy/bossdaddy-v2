import { z } from 'zod'
import { dataBlock } from './prompts'
import { sanitizeSpecValue } from './specs'

// Reference material the author points at: links, fetched + distilled into
// attributed facts BEFORE the run starts (docs/content-pipeline-plan.md §4a).
//
// Two lanes, never mixed: the author's NOTES are firsthand (the only thing the
// draft may claim as experience); REFERENCES are attributed knowledge ("DeWalt
// lists…", "per the CPSC notice") — fenced as untrusted data like specs, never
// written in the first person, never a critic fact. Raw page text never reaches
// the Opus stages: the fetch route distils each link to ≤ MAX_REF_FACTS short
// lines, the author reviews them, and only those lines ride on the brief.

export const MAX_REFERENCES = 10
export const MAX_REF_FACTS = 12
export const MAX_REF_FACT_LEN = 200
export const MAX_REF_NOTE_LEN = 200

export const ReferenceInput = z.object({
  url:  z.string().url().max(500),
  /** What the author wants from the page ("the weight + battery spec", "the recall notice"). */
  note: z.string().max(MAX_REF_NOTE_LEN).optional(),
})
export type ReferenceInput = z.infer<typeof ReferenceInput>

export const ReferenceNote = z.object({
  url:    z.string().url().max(500),
  title:  z.string().max(200).nullable(),
  status: z.enum(['ok', 'failed', 'skipped']),
  facts:  z.array(z.string().max(MAX_REF_FACT_LEN)).max(MAX_REF_FACTS),
  /** Why it failed / was skipped — shown to the author, never to the model. */
  error:  z.string().max(200).optional(),
})
export type ReferenceNote = z.infer<typeof ReferenceNote>

// Retailer product pages block fetchers and the product import pipeline already
// owns specs — the panel offers "link the product" instead of fetching.
const RETAILER_HOSTS = ['amazon.', 'amzn.to', 'homedepot.com', 'lowes.com', 'walmart.com', 'target.com', 'bestbuy.com', 'ebay.com']

export function hostOf(url: string): string | null {
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
}

export function isRetailerUrl(url: string): boolean {
  const host = hostOf(url)
  return !!host && RETAILER_HOSTS.some((r) => host === r || host.includes(r))
}

/** A page title for a prompt: markup/URLs/injection-shaped text dropped, capped. null when nothing safe is left. */
export function scrubReferenceTitle(title: string | null | undefined): string | null {
  return title ? sanitizeSpecValue(title, 200) : null
}

/** Drop injection-shaped or empty lines and cap the rest; same scrubber specs use. */
export function scrubReferenceFacts(facts: readonly string[]): string[] {
  const out: string[] = []
  for (const f of facts) {
    const v = sanitizeSpecValue(f, MAX_REF_FACT_LEN)
    if (v && !out.includes(v)) out.push(v)
    if (out.length >= MAX_REF_FACTS) break
  }
  return out
}

/** The fenced prompt block of every fetched reference; '' when none carried facts. */
export function referenceBlock(notes: readonly ReferenceNote[] | undefined): string {
  const ok = (notes ?? []).filter((n) => n.status === 'ok' && n.facts.length)
  if (!ok.length) return ''
  return dataBlock(
    'REFERENCE NOTES — facts pulled from sources the author supplied. Attributed knowledge, NOT firsthand: state them as what the source says ("the maker lists…", "per the recall notice"), never as something the author did or saw; name the source in words, never paste a URL; never go beyond these lines',
    ok.map((n) => {
      const head = `${scrubReferenceTitle(n.title) || hostOf(n.url) || n.url} (${hostOf(n.url) ?? n.url})`
      return `- ${head}:\n${n.facts.map((f) => `    • ${f}`).join('\n')}`
    }).join('\n'),
  )
}

/** Keep only the notes whose link is still on the list (the author removed one). */
export function pruneReferenceNotes(refs: readonly ReferenceInput[], notes: readonly ReferenceNote[]): ReferenceNote[] {
  const urls = new Set(refs.map((r) => r.url))
  return notes.filter((n) => urls.has(n.url))
}

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
/** Pasted text: enough for a bill section or a spec sheet, bounded for the brief + the prompt. */
export const MAX_REF_TEXT_LEN = 20_000
export const MIN_REF_TEXT_LEN = 40
export const MAX_REF_LABEL_LEN = 120

// A link must be a plain web address: http(s) only (no file:, javascript:, data:), and no
// user:pass@ — credentials in a pasted URL would land in prompts and logs.
function isWebUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return (u.protocol === 'http:' || u.protocol === 'https:') && !u.username && !u.password
  } catch { return false }
}
const WebUrl = z.string().url().max(500).refine(isWebUrl, 'Only plain http(s) links, without a login in the address.')

/**
 * A reference is a LINK the route reads, or TEXT the author pasted — for a page
 * that can't be fetched (a bot wall, a PDF they have, a sign-in page). Both are
 * distilled the same way and ride on the brief the same way.
 */
export const ReferenceInput = z.object({
  url:   WebUrl.optional(),
  /** The document itself, when there is no fetchable link. */
  text:  z.string().max(MAX_REF_TEXT_LEN).optional(),
  /** What the pasted text is ("H.R. 5344 bill text") — becomes the source name. */
  label: z.string().max(MAX_REF_LABEL_LEN).optional(),
  /** What the author wants from it ("the weight + battery spec", "the recall notice"). */
  note:  z.string().max(MAX_REF_NOTE_LEN).optional(),
}).refine(
  (r) => (r.url ? r.text == null : (r.text?.trim().length ?? 0) >= MIN_REF_TEXT_LEN),
  `A reference is a link, or pasted text of at least ${MIN_REF_TEXT_LEN} characters — not both.`,
)
export type ReferenceInput = z.infer<typeof ReferenceInput>

// Pasted text has no address, so its note is keyed by a digest of the text
// ("paste:1a2b3c4d"): the same text pastes to the same key, an edit re-reads.
export const PASTE_PREFIX = 'paste:'
function fnv1a(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
export function pasteKey(text: string): string { return `${PASTE_PREFIX}${fnv1a(text.trim())}` }
export function isPasteKey(key: string): boolean { return key.startsWith(PASTE_PREFIX) }
/** The key a reference's note is stored under: the link, or the paste digest. */
export function referenceKey(r: ReferenceInput): string { return r.url ?? pasteKey(r.text ?? '') }

const NoteKey = z.string().max(500).refine((k) => isPasteKey(k) || isWebUrl(k), 'A note is keyed by a web link or a paste digest.')

export const ReferenceNote = z.object({
  /** The link, or `paste:<digest>` for pasted text — the key the panel matches on. */
  url:    NoteKey,
  title:  z.string().max(200).nullable(),
  status: z.enum(['ok', 'failed', 'skipped']),
  facts:  z.array(z.string().max(MAX_REF_FACT_LEN)).max(MAX_REF_FACTS),
  /** Why it failed / was skipped — shown to the author, never to the model. */
  error:  z.string().max(200).optional(),
})
export type ReferenceNote = z.infer<typeof ReferenceNote>

// Retailer product pages block fetchers and the product import pipeline already
// owns specs — the panel offers "link the product" instead of fetching. Matched on
// the host or a subdomain of it, never a substring: mytarget.com is not Target.
// amzn.to and a.co are Amazon's short domains (Associates rules: never read the page).
const RETAILER_DOMAINS = ['amzn.to', 'a.co', 'homedepot.com', 'lowes.com', 'walmart.com', 'target.com', 'bestbuy.com', 'ebay.com']
const AMAZON_HOST = /(^|\.)amazon\.[a-z.]+$/
/** For search exclusion (research): the retailer domains as a plain list. */
// Wider than the fetch skip-list on purpose: a search should not cite a store page at all
// (the first smoke cited zoro.com). The author still reviews every finding.
export const RETAILER_BLOCKLIST = [
  'amazon.com', 'amazon.ca', 'amazon.co.uk', ...RETAILER_DOMAINS,
  'zoro.com', 'grainger.com', 'acmetools.com', 'toolnut.com', 'northerntool.com', 'harborfreight.com', 'menards.com', 'acehardware.com', 'cpooutlets.com', 'ohiopowertool.com',
]

function hostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`)
}

export function hostOf(url: string): string | null {
  if (isPasteKey(url)) return null
  try { return new URL(url).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
}

export function isRetailerUrl(url: string): boolean {
  const host = hostOf(url)
  return !!host && (AMAZON_HOST.test(host) || RETAILER_DOMAINS.some((d) => hostMatches(host, d)))
}

// Link shorteners: the fetch is locked to the pasted host, so a short link must be
// followed to the page it lands on first (the route does, with the SSRF-guarded resolver).
const SHORTENER_HOSTS = ['bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'buff.ly', 'lnkd.in', 'is.gd', 'rb.gy', 'shorturl.at', 'cutt.ly', 'tiny.cc', 't.ly', 'fb.me', 'dub.sh']

export function isShortenerUrl(url: string): boolean {
  const host = hostOf(url)
  return !!host && SHORTENER_HOSTS.some((s) => hostMatches(host, s))
}

/** A page title for a prompt: markup/URLs/injection-shaped text dropped, capped. null when nothing safe is left. */
export function scrubReferenceTitle(title: string | null | undefined): string | null {
  return title ? sanitizeSpecValue(title, 200) : null
}

// A fact over the cap is cut at the last clause or word break past 60% of the cap
// (never mid-word) and marked, so a long roster reads as a shortened line, not a
// mangled one. The prompt asks for short facts; this is the backstop.
export function clipFact(f: string): string {
  const t = f.trim()
  if (t.length <= MAX_REF_FACT_LEN) return t
  const head = t.slice(0, MAX_REF_FACT_LEN - 1)
  const floor = Math.floor(MAX_REF_FACT_LEN * 0.6)
  let cut = -1
  for (const m of head.matchAll(/[,;:]\s|\s/g)) if (m.index > floor) cut = m.index
  return `${(cut > 0 ? head.slice(0, cut) : head).replace(/[,;:]$/, '')}…`
}

/** Drop injection-shaped or empty lines and cap the rest; same scrubber specs use. */
export function scrubReferenceFacts(facts: readonly string[]): string[] {
  const out: string[] = []
  for (const f of facts) {
    const v = sanitizeSpecValue(clipFact(f), MAX_REF_FACT_LEN)
    if (v && !out.includes(v)) out.push(v)
    if (out.length >= MAX_REF_FACTS) break
  }
  return out
}

/** How a source is named in prompts and the workspace: its (scrubbed) title, else its host, else "pasted text". */
export function referenceSourceName(n: Pick<ReferenceNote, 'url' | 'title'>): string {
  return scrubReferenceTitle(n.title) || (isPasteKey(n.url) ? 'pasted text' : hostOf(n.url) || n.url)
}

/** The fenced prompt block of every read reference; '' when none carried facts. */
export function referenceBlock(notes: readonly ReferenceNote[] | undefined): string {
  const ok = (notes ?? []).filter((n) => n.status === 'ok' && n.facts.length)
  if (!ok.length) return ''
  return dataBlock(
    'REFERENCE NOTES — facts pulled from sources the author supplied. Attributed knowledge, NOT firsthand: state them as what the source says ("the maker lists…", "per the recall notice"), never as something the author did or saw; name the source in words, never paste a URL; never go beyond these lines',
    ok.map((n) => {
      const head = `${referenceSourceName(n)} (${isPasteKey(n.url) ? 'pasted by the author' : hostOf(n.url) ?? n.url})`
      return `- ${head}:\n${n.facts.map((f) => `    • ${f}`).join('\n')}`
    }).join('\n'),
  )
}

/** Keep only the notes whose link is still on the list (the author removed one). */
export function pruneReferenceNotes(refs: readonly ReferenceInput[], notes: readonly ReferenceNote[]): ReferenceNote[] {
  const keys = new Set(refs.map(referenceKey))
  return notes.filter((n) => keys.has(n.url))
}

/** A typed or pasted link → a plain web URL, or null. "dewalt.com/x" gets https://. */
export function normalizeLinkInput(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(t)
  const looksLikeHost = /^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(t)
  const candidate = hasScheme ? t : looksLikeHost ? `https://${t}` : t
  if (!isWebUrl(candidate)) return null
  return new URL(candidate).toString()
}

/**
 * The links that still need a read: never fetched, failed, or read and then
 * emptied by the author. Retailer links are never read and a skipped one (a
 * short link that landed on a retailer) is settled.
 */
export function unfetchedReferences(refs: readonly ReferenceInput[], notes: readonly ReferenceNote[]): ReferenceInput[] {
  return refs.filter((r) => {
    if (r.url && isRetailerUrl(r.url)) return false
    const key = referenceKey(r)
    const n = notes.find((x) => x.url === key)
    if (n?.status === 'skipped') return false
    return !n || n.status !== 'ok' || n.facts.length === 0
  })
}

/** Fresh notes replace the old note for the same link; notes for removed links are dropped. */
export function mergeReferenceNotes(refs: readonly ReferenceInput[], notes: readonly ReferenceNote[], fresh: readonly ReferenceNote[]): ReferenceNote[] {
  const replaced = new Set(fresh.map((n) => n.url))
  return pruneReferenceNotes(refs, [...notes.filter((n) => !replaced.has(n.url)), ...fresh])
}

// Turn the author's free-text notes into the fact lines the outline distributes
// across parts. Pure + dependency-free so the wizards can count facts live.
//
// A line break is a boundary (bullets, phone dictation, one-thought-per-line
// notes), and so is a sentence end followed by a capital/digit/quote. Leading
// list markers ("- ", "• ", "3. ") are stripped so the fact reads as prose.

const LIST_MARKER = /^(?:[-*•]|\d{1,2}[.)])\s+/
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z0-9"'])/
const URL = /https?:\/\/[^\s<>"']+/g
// A fact that was only a lead-in to a link ("Specs here:") once the link is gone.
const LEAD_IN_ONLY = /[:(\-–—]$/

/**
 * Links the author pasted. They are held OUT of the facts: no stage can read a
 * URL, so handing one to the outline as a verbatim fact makes the writer
 * describe a page it never saw. The raw text keeps them for a future reader.
 */
export function extractLinks(text: string | undefined | null): string[] {
  if (!text) return []
  const seen = new Set<string>()
  for (const m of text.match(URL) ?? []) seen.add(m.replace(/[.,;:!?)\]]+$/, ''))
  return [...seen]
}

/**
 * The outline copies each fact verbatim into a part's notes, and that schema
 * caps a note at 300 characters — so a dictated run-on with no punctuation
 * would fail the outline stage. Facts are soft-wrapped under this length at
 * the last clause break (", " "; " " — " " and " " but ") before the limit.
 */
export const MAX_FACT_LEN = 280
const CLAUSE_BREAK = /(?:,|;|:| —| –| and| but| so| then)\s/g

function wrapFact(fact: string): string[] {
  const out: string[] = []
  let rest = fact
  while (rest.length > MAX_FACT_LEN) {
    const head = rest.slice(0, MAX_FACT_LEN)
    let cut = -1
    for (const m of head.matchAll(CLAUSE_BREAK)) {
      const at = m.index + m[0].length
      if (at > 40) cut = at
    }
    if (cut < 0) cut = head.lastIndexOf(' ') > 40 ? head.lastIndexOf(' ') + 1 : MAX_FACT_LEN
    out.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) out.push(rest)
  return out
}

export function splitFacts(text: string | undefined | null): string[] {
  if (!text) return []
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    // Marker first, or "2. Chuck wobbled" splits at the numeral.
    const line = raw.trim().replace(LIST_MARKER, '')
    for (const s of line.split(SENTENCE_BOUNDARY)) {
      const t = s.replace(URL, '').replace(/\s{2,}/g, ' ').trim()
      if (t && !LEAD_IN_ONLY.test(t)) out.push(...wrapFact(t))
    }
  }
  return out
}

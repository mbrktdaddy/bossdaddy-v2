// Product specs reach the drafting prompt from three sources: the author's own
// entry, the Amazon/Shopify page scraper (lib/products/import.ts) and the
// specs-grade research pass. The scraped ones are untrusted text that ends up
// verbatim inside a model prompt, so they get the same treatment as any other
// user-supplied string headed for an LLM: strip markup and control characters,
// drop anything that is a URL or reads like an instruction to the model, cap
// the length. Applied at import AND at the prompt boundary (belt and braces —
// specs already in the DB predate this).

export interface SpecLike {
  label: string
  value: string
}

export const MAX_SPEC_LABEL = 60
export const MAX_SPEC_VALUE = 200

// Narrow on purpose: these are the shapes of a prompt injection, not ordinary
// spec vocabulary ("Voice assistant: Alexa" must survive).
const INSTRUCTION_SHAPED = [
  /\b(ignore|disregard|forget|override)\b[^.]{0,40}\b(previous|prior|above|earlier|all|these|your)\b[^.]{0,20}\b(instructions?|rules?|prompts?|guidance)\b/i,
  /\bsystem\s+prompt\b/i,
  /\byou\s+(are|must|should|will)\s+(now\s+)?(a|an|the|act|respond|write|output|return|pretend|ignore)\b/i,
  // A chat-role prefix at the START of the value ("Assistant: sure, …"). Not
  // mid-string — "Voice assistant: Alexa" is a spec, not an injection.
  /^\s*(assistant|system|user|human|ai)\s*:/i,
]

function cleanText(s: string, max: number): string {
  return s
    .replace(/<[^>]*>/g, ' ')                 // markup
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '') // control chars
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

/** A single spec value made safe for a prompt, or null if it should be dropped. */
export function sanitizeSpecValue(raw: string, max: number = MAX_SPEC_VALUE): string | null {
  const v = cleanText(raw ?? '', max)
  if (!v) return null
  if (/https?:\/\/|www\./i.test(v)) return null
  if (INSTRUCTION_SHAPED.some((re) => re.test(v))) return null
  return v
}

/** Clean label + value; drop pairs that lose either half. */
export function sanitizeSpecs<T extends SpecLike>(specs: readonly T[] | null | undefined): SpecLike[] {
  const out: SpecLike[] = []
  for (const s of specs ?? []) {
    const label = cleanText(s?.label ?? '', MAX_SPEC_LABEL)
    const value = sanitizeSpecValue(s?.value ?? '')
    if (!label || !value) continue
    if (INSTRUCTION_SHAPED.some((re) => re.test(label))) continue
    out.push({ label, value })
  }
  return out
}

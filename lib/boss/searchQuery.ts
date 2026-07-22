// Shared query helper for the Boss's grounded-retrieval tools (search_gear,
// search_guides).
//
// Postgres full-text search via `websearch_to_tsquery` ANDs every term, so a
// natural-language query silently misses a real match when one word isn't in the
// document — e.g. "how do I PREVENT razor rash" became `prevent & razor & rash`
// and dropped a guide that says "razor rash" but never "prevent". The tools try
// the strict (AND) search first for precision, then fall back to this OR-of-terms
// query only when strict finds nothing — broadening recall without losing the
// precise result when the exact phrase is present.

// Grammatical filler only — NOT topical words. We keep content words like
// "prevent"/"toddler" in the OR query (harmless: OR still matches on the words
// that ARE present); we only strip words that would match noise on their own.
const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'at', 'with', 'my',
  'your', 'me', 'i', 'is', 'are', 'be', 'do', 'does', 'how', 'what', 'which', 'when',
  'should', 'can', 'you', 'it', 'this', 'that', 'have', 'has', 'please', 'help',
  'any', 'some', 'best', 'good', 'great', 'get', 'got', 'need', 'want', 'find',
  'looking', 'recommend', 'recommendation',
])

/**
 * Build an OR-of-significant-terms `to_tsquery` string from a raw user query,
 * e.g. "how do i prevent razor rash" -> "prevent | razor | rash". Returns null
 * when nothing significant remains (caller should then skip the fallback).
 * Tokens are sanitized to `[a-z0-9]` so the result is always valid tsquery input.
 */
export function orTsQuery(raw: string): string | null {
  const tokens = [
    ...new Set(
      raw
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 1 && !STOP.has(t)),
    ),
  ]
  return tokens.length ? tokens.join(' | ') : null
}

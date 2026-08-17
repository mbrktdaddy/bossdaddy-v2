// Find the URLs in a plain-text string and hand back tokens a renderer can turn
// into anchors.
//
// ── WHY A TOKENIZER AND NOT A STRING OF HTML ─────────────────────────────────
// Message bodies are stored plain (sanitizePlainText strips every tag on write)
// and rendered as escaped JSX text, so there is no XSS surface anywhere in the
// path today. The tempting way to add links is to build an HTML string and
// dangerouslySetInnerHTML it — which trades that property away for a convenience
// feature and reintroduces the exact hole the plain-text posture closed. Returning
// tokens keeps the renderer building React elements, so the text stays escaped by
// construction and a message containing `<script>` is still just characters.
//
// Deliberately NOT a markdown parser. A DM is prose, not a document; people paste
// links, they don't write reference syntax, and every additional construct is
// another thing to escape.

/** A run of plain text, or a URL to make clickable. */
export type TextToken =
  | { type: 'text'; value: string }
  | { type: 'link'; href: string; label: string }

// `www.` is included because people write it constantly and expect it to work; it
// gets an https:// scheme bolted on below. `[^\s<]` rather than a character class
// of "legal URL characters" — that list is long, keeps growing, and getting it
// wrong truncates real links; anything not whitespace runs to the end and the
// trailing-punctuation pass fixes the tail.
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<]+/gi

/** Absurdly long tokens are almost never a real link and cost real time to parse. */
const MAX_URL_LENGTH = 2048

/** Display cap. The href stays whole — this is only what the reader sees. */
const MAX_LABEL_LENGTH = 60

function occurrences(haystack: string, needle: string): number {
  let n = 0
  for (const ch of haystack) if (ch === needle) n++
  return n
}

/**
 * Give back the trailing characters that belong to the SENTENCE, not the URL.
 *
 * "Have a look at https://example.com." must not link the full stop, or the link
 * 404s and the sentence loses its punctuation. But brackets can't just be stripped:
 * a Wikipedia URL genuinely ends in one — /wiki/Boss_(disambiguation) — so a
 * closing bracket is kept when the URL opened it and dropped when the writer did
 * ("see (https://example.com)").
 */
function trimTrailingPunctuation(raw: string): string {
  let url = raw
  for (;;) {
    const last = url.at(-1)
    if (!last) break
    if ('.,;:!?"\'’”'.includes(last)) { url = url.slice(0, -1); continue }
    if (last === ')' && occurrences(url, '(') < occurrences(url, ')')) { url = url.slice(0, -1); continue }
    if (last === ']' && occurrences(url, '[') < occurrences(url, ']')) { url = url.slice(0, -1); continue }
    if (last === '}' && occurrences(url, '{') < occurrences(url, '}')) { url = url.slice(0, -1); continue }
    break
  }
  return url
}

/**
 * ⚠️ HTTP AND HTTPS ONLY. The regex can't match `javascript:` or `data:` on its
 * own, but this is the gate that has to hold if it is ever loosened — an anchor
 * whose href is a `javascript:` URI is script execution on click, and it would
 * arrive from another member's message. Parsing with `new URL` rather than
 * string-matching the prefix, so a payload like `htTps:/\/` can't slip past a
 * `startsWith` check.
 */
function safeHref(candidate: string): string | null {
  const withScheme = /^www\./i.test(candidate) ? `https://${candidate}` : candidate
  try {
    const parsed = new URL(withScheme)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch {
    return null
  }
}

/** Shorten a long URL for display, keeping the part that tells you where it goes. */
function labelFor(url: string): string {
  if (url.length <= MAX_LABEL_LENGTH) return url
  // The host is the part a reader actually checks before tapping, so it survives;
  // the path is what gets cut.
  return `${url.slice(0, MAX_LABEL_LENGTH - 1)}…`
}

/**
 * The first linkable URL in a body, or null.
 *
 * ONE PREVIEW PER MESSAGE, which is the convention everywhere — a message pasting
 * five links would otherwise turn into five cards and bury whatever was said around
 * them. Reuses the tokenizer so "what counts as a link" has exactly one definition:
 * if it renders as an anchor, it's the thing we'd unfurl.
 */
export function firstLink(input: string): string | null {
  for (const token of tokenizeLinks(input)) {
    if (token.type === 'link') return token.href
  }
  return null
}

export function tokenizeLinks(input: string): TextToken[] {
  if (!input) return []

  const tokens: TextToken[] = []
  let cursor = 0

  for (const match of input.matchAll(URL_RE)) {
    const raw = match[0]
    const start = match.index
    if (start === undefined) continue

    const url = trimTrailingPunctuation(raw)
    const href = url.length <= MAX_URL_LENGTH ? safeHref(url) : null

    // Not a usable link — leave the run as text and carry on. `cursor` is not
    // advanced past it, so the following text token still contains it verbatim.
    if (!href) continue

    if (start > cursor) tokens.push({ type: 'text', value: input.slice(cursor, start) })
    tokens.push({ type: 'link', href, label: labelFor(url) })
    cursor = start + url.length
  }

  if (cursor < input.length) tokens.push({ type: 'text', value: input.slice(cursor) })
  return tokens
}

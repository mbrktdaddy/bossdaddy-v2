// Pull title / description / image / site name out of a fetched HTML document.
//
// ── WHY REGEX AND NOT A DOM PARSER ───────────────────────────────────────────
// A deliberate, narrow trade. We need four values out of `<meta>` tags and
// `<title>`, from a document we have already capped at 512KB, and the output is
// rendered by React as escaped text — so a mis-parse produces a wrong preview, not
// an injection. Adding cheerio or jsdom to the bundle to read four attributes is a
// worse trade than a tight matcher with tests on the cases that actually vary
// (attribute order, quote style, entities).
//
// The thing that WOULD justify a real parser is anything requiring tree structure
// or correct handling of malformed nesting. If this file ever grows that
// requirement, add the dependency rather than making the patterns cleverer.

/** Cap everything: these strings end up in a card, not an article. */
const MAX_TITLE = 200
const MAX_DESCRIPTION = 300
const MAX_SITE_NAME = 80

export interface ParsedMetadata {
  title:       string | null
  description: string | null
  siteName:    string | null
  /** Raw, still relative-or-absolute and NOT yet validated. The caller resolves it. */
  imageUrl:    string | null
}

/**
 * Decode the entities that actually appear in meta content.
 *
 * Not a full entity table on purpose — the named set is enormous and the payoff is
 * a handful of characters in a title. The five below plus numeric refs cover
 * everything a real og:title contains, and an undecoded `&hellip;` renders as
 * literal text rather than as anything dangerous.
 */
function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    // &amp; LAST, so `&amp;lt;` decodes to the literal text `&lt;` and not to `<`.
    // Doing it first would let one layer of encoding unwrap into markup.
    .replace(/&amp;/gi, '&')
}

function safeFromCodePoint(code: number): string {
  // Surrogates and out-of-range values throw; a bad numeric entity shouldn't take
  // the whole parse down.
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ''
  if (code >= 0xd800 && code <= 0xdfff) return ''
  try { return String.fromCodePoint(code) } catch { return '' }
}

function clean(value: string | null, max: number): string | null {
  if (!value) return null
  // Collapse all whitespace: a title split across lines in the source should not
  // arrive with newlines in it.
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

/**
 * Find one meta tag's content by its property/name key.
 *
 * ⚠️ HANDLES EITHER ATTRIBUTE ORDER. `<meta property="og:title" content="x">` and
 * `<meta content="x" property="og:title">` are both common in the wild — plenty of
 * naive implementations only match the first and quietly return nothing for a
 * chunk of the internet.
 */
function metaContent(html: string, key: string): string | null {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Quoted values (the overwhelming majority), key-then-content and content-then-key.
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)\\s*=\\s*["']${escapedKey}["'][^>]*?content\\s*=\\s*["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]*?(?:property|name)\\s*=\\s*["']${escapedKey}["']`, 'i'),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

export function parseMetadata(html: string): ParsedMetadata {
  // Only the head can carry these, and stopping there avoids matching a `<meta>`
  // that appears inside body content (or inside an escaped example in a code
  // block, which is a real thing on developer sites).
  const headEnd = html.search(/<\/head\s*>/i)
  const head = headEnd === -1 ? html : html.slice(0, headEnd)

  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null

  return {
    // Preference order is the convention every unfurler follows: Open Graph is
    // written FOR this, Twitter's is the common fallback, and <title> is what
    // exists on a page nobody prepared.
    title: clean(
      metaContent(head, 'og:title') ?? metaContent(head, 'twitter:title') ?? titleTag,
      MAX_TITLE,
    ),
    description: clean(
      metaContent(head, 'og:description')
        ?? metaContent(head, 'twitter:description')
        ?? metaContent(head, 'description'),
      MAX_DESCRIPTION,
    ),
    siteName: clean(metaContent(head, 'og:site_name'), MAX_SITE_NAME),
    imageUrl: cleanUrl(
      metaContent(head, 'og:image:secure_url')
        ?? metaContent(head, 'og:image')
        ?? metaContent(head, 'twitter:image'),
    ),
  }
}

/**
 * A URL is not display text, so it goes through a different cleaner: decoded and
 * trimmed, never truncated. `clean()` would ellipsize an over-long value, and a URL
 * with `…` on the end is silently unfetchable — the preview would just lose its
 * image with no indication why. Too long is a null instead.
 */
function cleanUrl(value: string | null): string | null {
  if (!value) return null
  const text = decodeEntities(value).trim()
  if (!text || text.length > 2048) return null
  return text
}

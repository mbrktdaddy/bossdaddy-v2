import sanitize from 'sanitize-html'

// ─────────────────────────────────────────────────────────────────────────────
// X-safe HTML serializer
//
// X Articles accept long-form HTML but support only a NARROW rich-text subset.
// Anything outside it is stripped SILENTLY by X on paste/import — the author
// pastes a richly-formatted draft and finds tables, code blocks, captions, and
// embeds gone, with no warning. So we strip the same subset here, but RECORD
// what was lost (`dropped`) so the Article workspace can surface it BEFORE the
// author publishes. The X-specific knowledge lives here (the serializer); the
// storage layer (`social_articles.body_html` / `dropped_tags`) stays generic.
//
// The whitelist + maps below are intentionally conservative. Tune them as X's
// editor evolves — keep `X_ALLOWED_TAGS`, `RENAME`, and the note maps in sync.
// ─────────────────────────────────────────────────────────────────────────────

export type DroppedAction = 'removed' | 'converted'

export interface DroppedTag {
  /** The original source tag that was changed. */
  tag: string
  /** How many times it appeared in the source. */
  count: number
  /** `removed` = tag stripped, text kept. `converted` = renamed to an X tag. */
  action: DroppedAction
  /** For `converted`: the X tag it became. */
  to?: string
  /** Human-readable explanation for the workspace warning. */
  note: string
}

export interface XSerializeResult {
  /** X-safe HTML, ready to paste into the X Article editor. */
  html: string
  /** Everything that was stripped or converted, for an author-facing warning. */
  dropped: DroppedTag[]
}

/**
 * The tag subset X Articles render. Rename targets (`strong`, `em`, `del`,
 * `h2`) MUST appear here or they'd be discarded right after conversion.
 */
export const X_ALLOWED_TAGS = [
  'p', 'br',
  'strong', 'em', 'del', // bold / italic / strikethrough
  'a',
  'ul', 'ol', 'li',
  'h1', 'h2', // X "Heading" + "Subheading"
  'blockquote',
  'img',
  'hr',
] as const

/**
 * Source tags that map cleanly onto an X tag. `silent: true` = visually
 * identical (no author-facing warning); `silent: false` = a real change worth
 * flagging (e.g. a heading level collapsing).
 */
const RENAME: Record<string, { to: string; silent: boolean }> = {
  b:      { to: 'strong', silent: true },
  i:      { to: 'em',     silent: true },
  strike: { to: 'del',    silent: true },
  s:      { to: 'del',    silent: true },
  h3:     { to: 'h2',     silent: true },  // sub-subheading → subheading (expected)
  h4:     { to: 'h2',     silent: false }, // a heading level is collapsed — flag it
}

/** Friendlier explanations for stripped tags shown in the workspace warning. */
const REMOVE_NOTES: Record<string, string> = {
  table:      'Tables are not supported on X — cells become plain text.',
  pre:        'Code blocks are not supported on X — kept as plain text.',
  code:       'Inline code styling is removed.',
  figure:     'Image wrapper removed (the image itself is kept).',
  figcaption: 'Image captions are not supported — the caption becomes plain text.',
  div:        'Embedded blocks (e.g. collection embeds) are not supported on X.',
  span:       'Inline styling is removed.',
}

/** Table-internal tags — implied by `table`, not reported individually. */
const TABLE_FAMILY = new Set([
  'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'colgroup', 'col', 'caption',
])

const ALLOWED = new Set<string>(X_ALLOWED_TAGS)

/**
 * Serialize arbitrary (already app-sanitized) article HTML into the X-safe
 * subset, recording everything that was stripped or converted.
 */
export function serializeForX(sourceHtml: string | null | undefined): XSerializeResult {
  const input = (sourceHtml ?? '').trim()
  if (!input) return { html: '', dropped: [] }

  // Count every tag the parser sees (the `*` transform runs before the
  // allowlist filter, so it sees discarded tags too) and apply renames inline.
  const counts: Record<string, number> = {}

  const html = sanitize(input, {
    allowedTags: [...X_ALLOWED_TAGS],
    allowedAttributes: {
      a:   ['href'],
      img: ['src', 'alt'],
    },
    allowedSchemes:      ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    allowProtocolRelative: false,
    // Default 'discard' keeps the text inside a stripped tag — matches X, which
    // drops the tag but preserves the words.
    disallowedTagsMode: 'discard',
    transformTags: {
      '*': (tagName, attribs) => {
        counts[tagName] = (counts[tagName] ?? 0) + 1
        const rename = RENAME[tagName]
        // Pass attribs through untouched — `allowedAttributes` filters them
        // per the FINAL tag name. Wiping them here would strip href/src/alt.
        return { tagName: rename ? rename.to : tagName, attribs }
      },
    },
  })

  // Derive the author-facing report from what the parser saw.
  const dropped: DroppedTag[] = []
  let tableCount = 0

  for (const [tag, count] of Object.entries(counts)) {
    if (ALLOWED.has(tag)) continue // survived unchanged

    if (tag === 'table') { tableCount += count; continue }
    if (TABLE_FAMILY.has(tag)) { tableCount += 1; continue } // implied by table

    const rename = RENAME[tag]
    if (rename) {
      if (!rename.silent) {
        dropped.push({
          tag,
          count,
          action: 'converted',
          to: rename.to,
          note: `Converted to <${rename.to}>.`,
        })
      }
      continue
    }

    dropped.push({
      tag,
      count,
      action: 'removed',
      note: REMOVE_NOTES[tag] ?? 'Formatting removed; text is kept.',
    })
  }

  if (tableCount > 0) {
    dropped.push({
      tag: 'table',
      count: counts.table ?? 0,
      action: 'removed',
      note: REMOVE_NOTES.table,
    })
  }

  dropped.sort((a, b) => a.tag.localeCompare(b.tag))

  return { html, dropped }
}

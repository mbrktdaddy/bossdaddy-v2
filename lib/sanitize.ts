import sanitize from 'sanitize-html'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'a',
  'ul', 'ol', 'li',
  'h2', 'h3', 'h4',
  'blockquote', 'pre', 'code',
  'img', 'figure', 'figcaption',
  'div',
]

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a:      ['href', 'rel', 'target', 'class', 'id', 'data-product-slug'],
  img:    ['src', 'alt', 'width', 'height', 'class', 'id', 'data-slot-id'],
  // data-slot-id / data-prompt / data-alt / data-caption carry the metadata
  // that Claude attaches to inline-image placeholder stubs in generated drafts,
  // and that the InlineMediaPanel uses to manage every inline image.
  figure: ['class', 'id', 'data-slot-id', 'data-prompt', 'data-alt', 'data-caption'],
  div:    ['class', 'id', 'data-slot-id', 'data-collection-slug', 'data-content-type', 'data-content-slug'],
  '*':    ['class', 'id'],
}

// `div` is allowed only when it carries one of our known content-component
// classes — keeps user-pasted layout junk out. Other tags (figure, etc.) are
// left unrestricted.
const ALLOWED_CLASSES: Record<string, string[]> = {
  div: ['bd-image-grid', 'bd-collection-embed', 'bd-content-link'],
}

/**
 * Strip all script/style/event-handler content, allow a specific tag/attr
 * allowlist. sanitize-html is pure JS (no jsdom) so it works on Vercel
 * serverless without the html-encoding-sniffer / @exodus/bytes ESM break.
 */
export function sanitizeHtml(dirty: string): string {
  return sanitize(dirty, {
    allowedTags:       ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedClasses:    ALLOWED_CLASSES,
    // Only allow http(s) hrefs and relative paths in <a href>
    allowedSchemes:          ['http', 'https', 'mailto'],
    allowedSchemesByTag:     { img: ['http', 'https', 'data'] },
    allowProtocolRelative:   false,
    disallowedTagsMode:      'discard',
    // Merge incoming rel tokens with noopener/noreferrer so affiliate anchors
    // can carry sponsored/nofollow without being stripped.
    transformTags: {
      a: (tagName, attribs) => {
        const incoming = (attribs.rel ?? '').split(/\s+/).filter(Boolean)
        const merged = Array.from(new Set([...incoming, 'noopener', 'noreferrer']))
        return { tagName, attribs: { ...attribs, rel: merged.join(' ') } }
      },
    },
  })
}

/**
 * Neutralize user-supplied PLAIN TEXT before persisting (DM bodies, captions).
 * These fields are rendered as escaped text by React today, so there is no live
 * XSS — this is defense-in-depth so no HTML markup is ever stored, in case a
 * future render path switches to dangerouslySetInnerHTML.
 *
 * Unlike sanitizeHtml() (for rich content), this strips ALL tags — including
 * <script>/<style> content — and returns readable plain text. Crucially it does
 * NOT leave the survivors HTML-encoded: sanitize-html escapes stray characters
 * (& < > " '), which would otherwise render as visible "5 &lt; 10" once React
 * re-escapes the value, so we decode those five back. Decode &amp; LAST so a
 * literal "&lt;" the user typed round-trips as "&lt;", not "<".
 */
export function sanitizePlainText(dirty: string): string {
  const stripped = sanitize(dirty, {
    allowedTags:        [],
    allowedAttributes:  {},
    disallowedTagsMode: 'discard',
  })
  return stripped
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}

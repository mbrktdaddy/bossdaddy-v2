import sanitize from 'sanitize-html'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'a',
  'ul', 'ol', 'li',
  'h2', 'h3', 'h4',
  'blockquote', 'pre', 'code',
  'img', 'figure', 'figcaption',
]

const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a:      ['href', 'rel', 'target', 'class', 'id'],
  img:    ['src', 'alt', 'width', 'height', 'class', 'id'],
  figure: ['class', 'id'],
  '*':    ['class', 'id'],
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

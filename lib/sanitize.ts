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
    // Restrict target/rel to only-safe values on <a>
    transformTags: {
      a: sanitize.simpleTransform('a', { rel: 'noopener noreferrer' }, false),
    },
  })
}

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
  div:    ['class', 'id', 'data-slot-id'],
  '*':    ['class', 'id'],
}

// `div` is allowed only when it carries one of our gallery classes — keeps
// user-pasted layout junk out. Other tags (figure, etc.) are left unrestricted.
const ALLOWED_CLASSES: Record<string, string[]> = {
  div: ['bd-image-grid'],
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

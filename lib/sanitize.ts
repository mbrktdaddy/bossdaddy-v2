import DOMPurify from 'isomorphic-dompurify'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'a',
  'ul', 'ol', 'li',
  'h2', 'h3', 'h4',
  'blockquote', 'pre', 'code',
]

const ALLOWED_ATTR = ['href', 'rel', 'target', 'class', 'id']

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
  })
}

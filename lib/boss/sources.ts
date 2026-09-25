import type { SourceBlock } from './types'

// Block lists for the Boss's live search. Empty on purpose: the operator chose
// light-touch sourcing — add an entry only when a specific bad actor shows up.
// xAI caps excludedDomains at 5, so the long-term list belongs in the X handles.
export const EXCLUDED_X_HANDLES: string[] = []
export const EXCLUDED_WEB_DOMAINS: string[] = []

export const MAX_SOURCES = 6

const X_HOSTS = new Set(['x.com', 'twitter.com', 'mobile.twitter.com'])

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

// Normalizes a provider `source` part into a card. The URL comes from a third
// party, so only http(s) passes — a javascript:/data: URL never reaches an href.
export function toSourceBlock(rawUrl: string, rawTitle?: string | null): SourceBlock | null {
  let u: URL
  try {
    u = new URL(decodeEntities(rawUrl.trim()))
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null

  const host = u.hostname.replace(/^www\./, '')
  const isX = X_HOSTS.has(host)
  // `x.com/i/status/…` carries no handle — label it generically, not "@i".
  const handle = isX ? u.pathname.split('/')[1] : ''
  const label = isX ? (/^\w{1,15}$/.test(handle) && handle !== 'i' ? `@${handle}` : 'Post on X') : host
  const title = decodeEntities(rawTitle?.trim() || label).slice(0, 160)

  return { kind: 'source', origin: isX ? 'x' : 'web', slug: u.href, url: u.href, title, label }
}

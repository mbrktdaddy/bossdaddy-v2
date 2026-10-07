// Media provenance (migration 160). Pure + client-safe.
// origin is recorded only when known; a plain file upload stays null.

export const MEDIA_ORIGINS = ['own', 'web', 'amazon', 'ai'] as const
export type MediaOrigin = typeof MEDIA_ORIGINS[number]

const MAX_ORIGIN_URL = 2048

/**
 * Sanitise the origin fields of a client upload. Only 'own' and 'web' are
 * accepted from clients — 'amazon' / 'ai' are set server-side by their own routes.
 * origin_url is kept only for 'web' and only when it is a valid http(s) URL.
 */
export function parseUploadOrigin(
  origin: unknown,
  originUrl: unknown,
): { origin: 'own' | 'web' | null; origin_url: string | null } {
  if (origin === 'own') return { origin: 'own', origin_url: null }
  if (origin !== 'web') return { origin: null, origin_url: null }

  if (typeof originUrl !== 'string') return { origin: 'web', origin_url: null }
  const trimmed = originUrl.trim()
  if (!trimmed || trimmed.length > MAX_ORIGIN_URL) return { origin: 'web', origin_url: null }
  try {
    const u = new URL(trimmed)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return { origin: 'web', origin_url: null }
  } catch {
    return { origin: 'web', origin_url: null }
  }
  return { origin: 'web', origin_url: trimmed }
}

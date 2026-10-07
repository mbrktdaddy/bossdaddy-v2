// Pure helpers for the product-import image picker. Client-safe: no server imports.

const SIZE_TOKEN = /[_-](\d{2,4})(?:x(\d{2,4}))?(?=\.[a-z0-9]+$)/i

function splitQuery(url: string): { base: string; query: string } {
  const i = url.indexOf('?')
  return i === -1 ? { base: url, query: '' } : { base: url.slice(0, i), query: url.slice(i + 1) }
}

/** The size a URL advertises: its filename size token, else a w=/width= param, else 0. */
function advertisedSize(url: string): number {
  const { base, query } = splitQuery(url)
  const token = SIZE_TOKEN.exec(base)
  if (token) return Math.max(Number(token[1]), token[2] ? Number(token[2]) : 0)
  const param = /(?:^|&)(?:w|width)=(\d+)/i.exec(query)
  return param ? Number(param[1]) : 0
}

/**
 * Collapse URLs that differ only by a size token (…_1_800.webp vs …_1_1680.webp)
 * to the largest one. First-seen order of images is preserved; with no size
 * information on either, the first URL wins.
 */
export function dedupeSizeVariants(urls: string[]): string[] {
  const kept = new Map<string, { url: string; size: number }>()
  for (const url of urls) {
    const key = splitQuery(url).base.replace(SIZE_TOKEN, '')
    const size = advertisedSize(url)
    const existing = kept.get(key)
    if (!existing) kept.set(key, { url, size })
    else if (size > existing.size) kept.set(key, { url, size })
  }
  return [...kept.values()].map((v) => v.url)
}

/** Heuristic: the URL looks like a logo, banner or other non-product graphic. */
export function isLikelyGraphic(url: string): boolean {
  return /(graphic|infographic|banner|logo|icon|badge|swatch|sprite|placeholder)/i.test(splitQuery(url).base)
}

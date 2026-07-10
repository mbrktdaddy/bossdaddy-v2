/**
 * Pre-warm the OG preview image right after content goes live.
 *
 * When a link is first shared, X/Facebook/LinkedIn/etc. scrape the page and then
 * fetch its `og:image`. For photo cards that image is `/api/og?...&img=<hero>`,
 * whose FIRST hit is a cold Vercel cache MISS (~2s: fetch hero → sharp resize →
 * Satori render → sharp JPEG). If a scraper lands during that window it can time
 * out and cache a "no image" card — and X no longer offers a manual re-scrape,
 * so that broken card can stick for ~7 days.
 *
 * Warming closes the gap: immediately after publish we fetch the public page
 * (which also warms its ISR render) and read the EXACT `og:image` URL the page
 * emits — same `v=` cache-buster, hero, cta, category — then fetch that URL so
 * Vercel's CDN caches the image (`x-vercel-cache: HIT`) before any scraper runs.
 *
 * Reading the real emitted URL (rather than rebuilding it here) guarantees we
 * warm the same cache key the page will advertise, no matter how the metadata is
 * assembled — see `buildSocialMetadata` in `lib/og.ts`.
 *
 * Best-effort: every failure is swallowed. A missed warm just means the scraper
 * pays the cold cost it always did. Call inside `after()` so it never blocks the
 * publish response.
 */

const PAGE_TIMEOUT_MS = 15_000
const IMAGE_TIMEOUT_MS = 25_000
const MAX_CONCURRENCY = 4

/** Warm the OG image (and page render) for each public content path. */
export async function prewarmOgForPaths(paths: string[]): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const clean = [...new Set(paths.filter(Boolean))]
  await runPooled(clean, MAX_CONCURRENCY, (path) => prewarmOne(siteUrl, path))
}

async function prewarmOne(siteUrl: string, path: string): Promise<void> {
  try {
    const pageUrl = `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`
    const res = await fetchWithTimeout(pageUrl, PAGE_TIMEOUT_MS)
    if (!res.ok) return
    const html = await res.text()
    // Pull the exact image URL the page advertises so we warm the right key.
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
    if (!match) return
    const imageUrl = decodeHtmlEntities(match[1])
    // Only warm our own generated cards; skip any externally-hosted image.
    if (!imageUrl.includes('/api/og')) return
    await fetchWithTimeout(imageUrl, IMAGE_TIMEOUT_MS)
  } catch {
    // best-effort — warming is never allowed to throw
  }
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'BossDaddyPrewarm/1.0' },
    })
  } finally {
    clearTimeout(timer)
  }
}

/** Run `task` over `items` with a bounded number of concurrent workers. */
async function runPooled<T>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<void>,
): Promise<void> {
  let i = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++]
      await task(item)
    }
  })
  await Promise.all(workers)
}

/**
 * Link-preview crawler detection — DIAGNOSTIC INSTRUMENTATION.
 *
 * Vercel's runtime logs record method/path/status/cache but NOT the user agent,
 * so there is no way to answer "did X actually fetch our OG image?" from the
 * platform alone. That question is the fork in the whole missing-card-image
 * investigation: no request at all means robots.txt or a network block, while a
 * request that succeeds means the problem is on X's side (stale card cache).
 *
 * These helpers emit one greppable line per crawler request. Search the runtime
 * logs for the `[crawler]` prefix.
 *
 * Volume is intentionally tiny: page logging is gated on a crawler UA match, and
 * /api/og only invokes on a CDN miss. Safe to leave in — but it exists to answer
 * one question, so delete it once that question is settled.
 */

/**
 * Preview/scraper agents worth logging. Deliberately NOT a general bot list —
 * we only care about the agents that render link cards.
 */
const CRAWLER_UA =
  /(Twitterbot|facebookexternalhit|facebookcatalog|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Pinterest|redditbot|Applebot|SkypeUriPreview|iMessage)/i

export function isCrawlerUa(ua: string | null | undefined): boolean {
  return !!ua && CRAWLER_UA.test(ua)
}

/**
 * One structured, greppable line. Keep the `[crawler]` prefix stable — it's the
 * search key used to pull these out of the runtime logs.
 */
export function logCrawlerHit(kind: 'page' | 'og-image', ua: string | null, url: string): void {
  console.log(`[crawler] ${kind} ua=${JSON.stringify(ua ?? '')} url=${url}`)
}

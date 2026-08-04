import type { MetadataRoute } from 'next'

/**
 * Paths that must never be crawled by anyone: private app surfaces, auth flows,
 * and affiliate redirects. Shared by every user-agent group below so a group can
 * never accidentally open one of these up.
 *
 * NOTE: `/api/` is deliberately NOT in here — see the crawler groups below.
 */
const PRIVATE_PATHS = [
  '/dashboard/',
  '/studio/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/reset-callback',
  '/callback',
  '/bench/*',
  '/go/',
  '/feed.xml',
  '/feed/',
]

/**
 * Link-preview crawlers get their OWN groups, with no `/api/` disallow at all.
 *
 * Why this exists: the social card image is served from `/api/og`, which sat under
 * a broad `Disallow: /api/`. The `*` group works around that with a longer, more
 * specific `Allow: /api/og` — correct per RFC 9309 and Google's parser, where the
 * most specific match wins. But specificity precedence is NOT universal (the
 * original 1994 robots.txt spec had no `Allow` directive at all), and a crawler
 * that ignores `Allow` or matches the first rule in file order will block the
 * image while still rendering the card from the page HTML — which is exactly the
 * "card renders, image missing" symptom, and exactly why it never reproduced over
 * SMS (iMessage/Android link previewers don't read robots.txt).
 *
 * Rather than bet on any crawler's precedence rules, give these agents a group
 * with nothing to misparse. Per the spec a named group fully REPLACES `*` for that
 * agent, so each one must re-declare the private paths — hence PRIVATE_PATHS.
 */
const PREVIEW_CRAWLERS = ['Twitterbot', 'facebookexternalhit']

export default function robots(): MetadataRoute.Robots {
  const base = 'https://www.bossdaddylife.com'
  return {
    rules: [
      ...PREVIEW_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: PRIVATE_PATHS,
      })),
      {
        userAgent: '*',
        // Allow the image endpoints explicitly — they live under /api/ but must
        // be crawlable: /api/og for link-preview scrapers and /api/img for the
        // JSON-LD structured-data image crops Googlebot fetches. Longer match
        // wins over the broad /api/ disallow below for compliant parsers; the
        // preview crawlers above don't have to rely on that.
        allow: ['/', '/api/og', '/api/img'],
        disallow: ['/api/', ...PRIVATE_PATHS],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}

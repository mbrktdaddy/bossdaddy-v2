import type { MetadataRoute } from 'next'

/**
 * ONE group, deliberately.
 *
 * There were briefly per-crawler groups for Twitterbot and facebookexternalhit,
 * added because the social card lived at `/api/og` under a broad `Disallow: /api/`
 * and Twitterbot does NOT honour the more-specific `Allow: /api/og` meant to
 * override it (proven from runtime logs 2026-08-04: it fetched the page HTML three
 * times and never once requested the image). That workaround is obsolete — the card
 * moved to `/og-card` and the crops to `/img-crop`, both outside every Disallow, and
 * `npm run check:og` now fails the build if any card URL creeps back under `/api/`.
 *
 * Named groups are worth removing rather than leaving as belt-and-braces: per spec a
 * named group fully REPLACES `*` for that agent, so any Disallow added here later
 * would silently not apply to those two crawlers. A silent robots divergence is a
 * worse failure than the build error that now guards the original problem.
 *
 * THE INVARIANT: any URL that appears in a meta tag, JSON-LD block, <link>, or the
 * sitemap must live outside every Disallow below. Don't add a rule without checking
 * it against that.
 */

/**
 * AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, …) are
 * intentionally ALLOWED, via `*`. This is a deliberate decision, not an oversight:
 * being cited in AI answers is a discovery channel we want. No named group is needed
 * — adding one would only re-create the divergence trap described above. If that
 * stance ever changes, add the Disallow to the `*` group rather than a new group.
 *
 * Note robots.txt is not the only lever: Vercel's Firewall has a "Block AI Bots"
 * toggle that overrides this at the edge. It must stay OFF for this to hold.
 */
const DISALLOW = [
  // Application surfaces. Every one of these is also auth-gated — robots.txt is a
  // politeness protocol, not a security boundary — so this is crawl-budget hygiene.
  '/api/',
  '/dashboard/',
  '/studio/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/reset-callback',
  '/callback',
  // Affiliate redirects: kept out of the index so paid links aren't crawled as
  // ordinary destinations.
  '/go/',
]

/*
 * Two paths were REMOVED from the list above on 2026-08-04:
 *
 * `/bench/*` — bench detail pages already send `robots: noindex, follow` and
 *   deliberately carry a share card ("out of search but still a rich share
 *   preview", bench/[slug]). Disallowing them defeated both halves: Twitterbot
 *   couldn't fetch the page so there was no card at all, and Googlebot couldn't
 *   read the noindex it was supposed to obey — a disallowed URL can still get
 *   indexed from external links, just without a snippet. noindex is the right
 *   tool here; Disallow is not.
 *
 * `/feed.xml` + `/feed/` — the layout advertises all three feeds via
 *   <link rel="alternate" type="application/rss+xml"> while robots.txt forbade
 *   fetching them. Feeds are a legitimate discovery surface for search and AI
 *   crawlers. To keep the raw XML from surfacing AS a search result, the feeds
 *   now send `X-Robots-Tag: noindex, follow` (lib/rss.ts) — crawlable and
 *   followable, but not itself indexable.
 */

export default function robots(): MetadataRoute.Robots {
  const base = 'https://www.bossdaddylife.com'
  return {
    rules: [
      {
        userAgent: '*',
        // /api/og and /api/img are LEGACY-only: nothing advertises them since the
        // move to /og-card and /img-crop, but the routes still resolve, so these
        // keep any URL cached elsewhere before the move working for crawlers that
        // do honour Allow precedence. Harmless to keep, and not load-bearing.
        allow: ['/', '/api/og', '/api/img'],
        disallow: DISALLOW,
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}

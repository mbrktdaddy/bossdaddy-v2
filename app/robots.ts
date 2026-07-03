import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = 'https://www.bossdaddylife.com'
  return {
    rules: [
      {
        userAgent: '*',
        // Allow the image endpoints explicitly — they live under /api/ but must
        // be crawlable: /api/og for link-preview scrapers (facebookexternalhit /
        // Twitterbot) and /api/img for the JSON-LD structured-data image crops
        // Googlebot fetches. Longer match wins over the broad /api/ disallow
        // below for compliant parsers.
        allow: ['/', '/api/og', '/api/img'],
        disallow: [
          '/dashboard/',
          '/api/',
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
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}

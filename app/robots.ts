import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = 'https://www.bossdaddylife.com'
  return {
    rules: [
      {
        userAgent: '*',
        // Allow the OG image endpoint explicitly — it lives under /api/ but must
        // be crawlable so facebookexternalhit / Twitterbot (which respect
        // robots.txt) can fetch link-preview images. Longer match wins over the
        // broad /api/ disallow below for compliant parsers.
        allow: ['/', '/api/og'],
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

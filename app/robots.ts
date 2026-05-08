import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = 'https://www.bossdaddylife.com'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
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

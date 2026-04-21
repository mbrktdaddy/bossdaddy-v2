import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = 'https://www.bossdaddylife.com'
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/studio/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}

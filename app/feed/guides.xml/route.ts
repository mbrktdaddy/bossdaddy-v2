import { fetchFeedItems, buildRssXml, rssResponse } from '@/lib/rss'

export const revalidate = 3600

export async function GET() {
  const items = await fetchFeedItems({ type: 'guide', limit: 30 })
  const xml = buildRssXml(
    {
      title: 'Boss Daddy Life — Guides',
      description: 'Honest takes on dad life, family, and the good stuff that supports it.',
      selfPath: '/feed/guides.xml',
    },
    items,
  )
  return rssResponse(xml)
}

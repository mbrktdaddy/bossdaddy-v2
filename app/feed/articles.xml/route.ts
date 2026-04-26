import { fetchFeedItems, buildRssXml, rssResponse } from '@/lib/rss'

export const revalidate = 3600

export async function GET() {
  const items = await fetchFeedItems({ type: 'article', limit: 30 })
  const xml = buildRssXml(
    {
      title: 'Boss Daddy Life — Articles',
      description: 'Honest takes on dad life, family, and the gear that supports it.',
      selfPath: '/feed/articles.xml',
    },
    items,
  )
  return rssResponse(xml)
}

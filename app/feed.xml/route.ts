import { fetchFeedItems, buildRssXml, rssResponse } from '@/lib/rss'

export const revalidate = 3600

export async function GET() {
  const items = await fetchFeedItems({ limit: 50 })
  const xml = buildRssXml(
    {
      title: 'Boss Daddy Life',
      description: 'Dad-tested product reviews, guides, and honest advice.',
      selfPath: '/feed.xml',
    },
    items,
  )
  return rssResponse(xml)
}

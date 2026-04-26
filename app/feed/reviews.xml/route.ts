import { fetchFeedItems, buildRssXml, rssResponse } from '@/lib/rss'

export const revalidate = 3600

export async function GET() {
  const items = await fetchFeedItems({ type: 'review', limit: 30 })
  const xml = buildRssXml(
    {
      title: 'Boss Daddy Life — Reviews',
      description: 'Dad-tested product reviews. Every pick earned, never sponsored.',
      selfPath: '/feed/reviews.xml',
    },
    items,
  )
  return rssResponse(xml)
}

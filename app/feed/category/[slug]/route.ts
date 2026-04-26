import { NextResponse, type NextRequest } from 'next/server'
import { fetchFeedItems, buildRssXml, rssResponse } from '@/lib/rss'
import { getCategoryBySlug } from '@/lib/categories'

export const revalidate = 3600

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const category = getCategoryBySlug(slug)
  if (!category) {
    return NextResponse.json({ error: 'Unknown category' }, { status: 404 })
  }

  const items = await fetchFeedItems({ category: slug, limit: 30 })
  const xml = buildRssXml(
    {
      title: `Boss Daddy Life — ${category.label}`,
      description: category.description,
      selfPath: `/feed/category/${slug}`,
    },
    items,
  )
  return rssResponse(xml)
}

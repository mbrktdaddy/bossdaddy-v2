import { createClient } from '@/lib/supabase/server'
import { getCategoryLabel } from '@/lib/categories'

export interface FeedItem {
  type: 'review' | 'guide'
  slug: string
  title: string
  excerpt: string | null
  content: string | null
  category: string
  image_url: string | null
  rating: number | null
  published_at: string | null
  author: string
}

interface FeedOptions {
  /** ISO of category to filter by, or null/undefined for all categories. */
  category?: string | null
  /** Limit how many items to include in the feed. */
  limit?: number
  /** Filter to only this content type, or undefined for both. */
  type?: 'review' | 'guide'
  /** Include the full article body as content:encoded. Defaults to true. */
  fullContent?: boolean
}

interface FeedMeta {
  title: string
  description: string
  selfPath: string
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

function escapeCdata(s: string): string {
  // Prevent the `]]>` close sequence from terminating our CDATA early
  return s.replace(/]]>/g, ']]]]><![CDATA[>')
}

function rssDate(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toUTCString()
}

export async function fetchFeedItems(opts: FeedOptions = {}): Promise<FeedItem[]> {
  const supabase = await createClient()
  const limit = opts.limit ?? 30

  const reviewsQuery = supabase
    .from('reviews')
    .select('slug, title, excerpt, content, category, image_url, rating, published_at, profiles(username)')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(limit)

  const articlesQuery = supabase
    .from('guides')
    .select('slug, title, excerpt, content, category, image_url, published_at, profiles(username)')
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (opts.category) {
    reviewsQuery.eq('category', opts.category)
    articlesQuery.eq('category', opts.category)
  }

  type ReviewRow = {
    slug: string
    title: string
    excerpt: string | null
    content: string | null
    category: string
    image_url: string | null
    rating: number | null
    published_at: string | null
    profiles: { username: string } | { username: string }[] | null
  }
  type ArticleRow = Omit<ReviewRow, 'rating'>

  function authorOf(row: { profiles: ReviewRow['profiles'] }): string {
    const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return p?.username ?? 'bossdaddy'
  }

  const [{ data: reviews }, { data: articles }] = await Promise.all([
    opts.type === 'guide' ? Promise.resolve({ data: [] as ReviewRow[] })  : reviewsQuery,
    opts.type === 'review'  ? Promise.resolve({ data: [] as ArticleRow[] }) : articlesQuery,
  ])

  const items: FeedItem[] = [
    ...((reviews as ReviewRow[]) ?? []).map((r) => ({
      type: 'review' as const,
      slug: r.slug,
      title: r.title,
      excerpt: r.excerpt,
      content: r.content,
      category: r.category,
      image_url: r.image_url,
      rating: r.rating,
      published_at: r.published_at,
      author: authorOf(r),
    })),
    ...((articles as ArticleRow[]) ?? []).map((a) => ({
      type: 'guide' as const,
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      content: a.content,
      category: a.category,
      image_url: a.image_url,
      rating: null,
      published_at: a.published_at,
      author: authorOf(a),
    })),
  ]
    .filter((i) => !!i.slug)
    .sort((a, b) => {
      const ad = a.published_at ? new Date(a.published_at).getTime() : 0
      const bd = b.published_at ? new Date(b.published_at).getTime() : 0
      return bd - ad
    })
    .slice(0, limit)

  return items
}

export function buildRssXml(meta: FeedMeta, items: FeedItem[], opts: FeedOptions = {}): string {
  const fullContent = opts.fullContent !== false

  const rssItems = items
    .map((item) => {
      const path = item.type === 'review' ? `/reviews/${item.slug}` : `/guides/${item.slug}`
      const url = `${SITE_URL}${path}`
      const cat = getCategoryLabel(item.category)
      const titleSuffix = item.type === 'review' && item.rating != null ? ` — ${item.rating}/10` : ''

      const description = item.excerpt ?? ''
      const fullBody = fullContent && item.content ? item.content : ''

      const enclosure = item.image_url
        ? `<enclosure url="${escapeXml(item.image_url)}" type="image/jpeg" length="0" />`
        : ''

      const contentEncoded = fullBody
        ? `<content:encoded><![CDATA[${escapeCdata(fullBody)}]]></content:encoded>`
        : ''

      return `
    <item>
      <title><![CDATA[${escapeCdata(item.title + titleSuffix)}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description><![CDATA[${escapeCdata(description)}]]></description>
      ${contentEncoded}
      <category>${escapeXml(cat)}</category>
      <dc:creator><![CDATA[${escapeCdata(item.author)}]]></dc:creator>
      <pubDate>${rssDate(item.published_at)}</pubDate>
      ${enclosure}
    </item>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(meta.title)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(meta.description)}</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}${meta.selfPath}" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${rssItems}
  </channel>
</rss>`
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function rssResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}

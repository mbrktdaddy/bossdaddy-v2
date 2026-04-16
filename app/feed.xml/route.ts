import { createClient } from '@/lib/supabase/server'

export const revalidate = 3600

export async function GET() {
  const supabase = await createClient()
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bossdaddylife.com'

  const [{ data: reviews }, { data: articles }] = await Promise.all([
    supabase
      .from('reviews')
      .select('slug, title, excerpt, category, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(30),
    supabase
      .from('articles')
      .select('slug, title, excerpt, category, published_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(20),
  ])

  type Item = { slug: string; title: string; excerpt: string | null; category: string; published_at: string | null; type: 'review' | 'article' }

  const items: Item[] = [
    ...(reviews ?? []).map(r => ({ ...r, type: 'review' as const })),
    ...(articles ?? []).map(a => ({ ...a, type: 'article' as const })),
  ].sort((a, b) => {
    if (!a.published_at) return 1
    if (!b.published_at) return -1
    return new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  }).slice(0, 50)

  const rssItems = items.map((item) => {
    const url = item.type === 'review'
      ? `${base}/reviews/${item.slug}`
      : `${base}/articles/${item.slug}`
    const pubDate = item.published_at
      ? new Date(item.published_at).toUTCString()
      : ''
    const cat = item.category.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

    return `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description><![CDATA[${item.excerpt ?? ''}]]></description>
      <category>${cat}</category>
      <pubDate>${pubDate}</pubDate>
    </item>`
  }).join('')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Boss Daddy Life</title>
    <link>${base}</link>
    <description>Dad-tested product reviews, guides, and honest advice.</description>
    <language>en-us</language>
    <atom:link href="${base}/feed.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${rssItems}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

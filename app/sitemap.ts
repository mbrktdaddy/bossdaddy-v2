import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://www.bossdaddylife.com'
  const supabase = await createClient()

  const [{ data: reviews }, { data: articles }] = await Promise.all([
    supabase
      .from('reviews')
      .select('slug, published_at, updated_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false }),
    supabase
      .from('articles')
      .select('slug, published_at, updated_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false }),
  ])

  const reviewUrls: MetadataRoute.Sitemap = (reviews ?? []).map((r) => ({
    url: `${base}/reviews/${r.slug}`,
    lastModified: r.updated_at ?? r.published_at,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const articleUrls: MetadataRoute.Sitemap = (articles ?? []).map((a) => ({
    url: `${base}/articles/${a.slug}`,
    lastModified: a.updated_at ?? a.published_at,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${base}/reviews`,  lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/articles`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/gear`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/shop`,     lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${base}/about`,    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    ...reviewUrls,
    ...articleUrls,
  ]
}

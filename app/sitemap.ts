import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORY_SLUGS } from '@/lib/categories'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://www.bossdaddylife.com'
  const supabase = await createClient()
  const admin = createAdminClient()

  const [{ data: reviews }, { data: articles }, { data: tags }] = await Promise.all([
    supabase
      .from('reviews')
      .select('slug, published_at, updated_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false }),
    supabase
      .from('guides')
      .select('slug, published_at, updated_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false }),
    admin.from('tags').select('slug'),
  ])

  const reviewUrls: MetadataRoute.Sitemap = (reviews ?? []).map((r) => ({
    url: `${base}/reviews/${r.slug}`,
    lastModified: r.updated_at ?? r.published_at ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const articleUrls: MetadataRoute.Sitemap = (articles ?? []).map((a) => ({
    url: `${base}/guides/${a.slug}`,
    lastModified: a.updated_at ?? a.published_at ?? undefined,
    changeFrequency: 'monthly',
    priority: 0.7,
  }))

  const categoryUrls: MetadataRoute.Sitemap = CATEGORY_SLUGS.map((slug) => ({
    url: `${base}/reviews/category/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const tagUrls: MetadataRoute.Sitemap = (tags ?? []).map((t) => ({
    url: `${base}/reviews/tag/${t.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [
    { url: base,              lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${base}/reviews`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/guides`,  lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/gear`,    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/shop`,    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.6 },
    { url: `${base}/about`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/feed.xml`,lastModified: new Date(), changeFrequency: 'daily',   priority: 0.4 },
    ...categoryUrls,
    ...tagUrls,
    ...reviewUrls,
    ...articleUrls,
  ]
}

import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bossdaddylife.com'
  const supabase = await createClient()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('slug, published_at, updated_at')
    .eq('status', 'approved')
    .order('published_at', { ascending: false })

  const reviewUrls: MetadataRoute.Sitemap = (reviews ?? []).map((r) => ({
    url: `${base}/reviews/${r.slug}`,
    lastModified: r.updated_at ?? r.published_at,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  return [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    ...reviewUrls,
  ]
}

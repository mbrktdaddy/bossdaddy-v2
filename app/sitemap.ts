import type { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { CATEGORY_SLUGS } from '@/lib/categories'
import { OCCASIONS } from '@/lib/gift-occasions'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://www.bossdaddylife.com'
  const supabase = await createClient()
  const admin = createAdminClient()

  const [
    { data: reviews },
    { data: articles },
    { data: reviewTagRows },
    { data: guideTagRows },
    { data: picks },
  ] = await Promise.all([
    supabase
      .from('reviews')
      .select('slug, category, published_at, updated_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false }),
    supabase
      .from('guides')
      .select('slug, category, published_at, updated_at')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false }),
    // Only tags actually attached to a published, visible review/guide
    admin.from('review_tags').select('tag_slug, reviews!inner(status, is_visible)')
      .eq('reviews.status', 'approved')
      .eq('reviews.is_visible', true),
    admin.from('guide_tags').select('tag_slug, guides!inner(status, is_visible)')
      .eq('guides.status', 'approved')
      .eq('guides.is_visible', true),
    admin.from('pick_lists').select('slug, updated_at').eq('is_visible', true),
  ])

  const reviewTagSlugs = Array.from(new Set((reviewTagRows ?? []).map((r) => r.tag_slug)))
  const guideTagSlugs  = Array.from(new Set((guideTagRows  ?? []).map((g) => g.tag_slug)))

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

  // Only include category pages that have published, visible content
  const reviewCategoriesWithContent = new Set((reviews ?? []).map((r) => r.category).filter(Boolean) as string[])
  const guideCategoriesWithContent  = new Set((articles ?? []).map((a) => a.category).filter(Boolean) as string[])

  const categoryUrls: MetadataRoute.Sitemap = CATEGORY_SLUGS
    .filter((slug) => reviewCategoriesWithContent.has(slug))
    .map((slug) => ({
      url: `${base}/reviews/category/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

  const guideCategoryUrls: MetadataRoute.Sitemap = CATEGORY_SLUGS
    .filter((slug) => guideCategoriesWithContent.has(slug))
    .map((slug) => ({
      url: `${base}/guides/category/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    }))

  const tagUrls: MetadataRoute.Sitemap = reviewTagSlugs.map((slug) => ({
    url: `${base}/reviews/tag/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const guideTagUrls: MetadataRoute.Sitemap = guideTagSlugs.map((slug) => ({
    url: `${base}/guides/tag/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const pickUrls: MetadataRoute.Sitemap = (picks ?? []).map((p) => ({
    url: `${base}/picks/${p.slug}`,
    lastModified: p.updated_at ?? undefined,
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  // Every defined occasion — stable URLs that compound SEO whether content exists or not
  const giftUrls: MetadataRoute.Sitemap = OCCASIONS.map((occ) => ({
    url: `${base}/gifts/${occ.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.85,
  }))

  return [
    { url: base,              lastModified: new Date(), changeFrequency: 'daily',   priority: 1.0 },
    { url: `${base}/reviews`, lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/guides`,  lastModified: new Date(), changeFrequency: 'daily',   priority: 0.9 },
    { url: `${base}/gifts`,   lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${base}/picks`,   lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/gear`,    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${base}/bench`,   lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${base}/about`,   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    ...categoryUrls,
    ...guideCategoryUrls,
    ...tagUrls,
    ...guideTagUrls,
    ...reviewUrls,
    ...articleUrls,
    ...pickUrls,
    ...giftUrls,
  ]
}

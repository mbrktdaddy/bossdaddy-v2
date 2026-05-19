import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import { SpotlightsClient, type Candidate, type SiteSettings } from './_components/SpotlightsClient'

export const dynamic = 'force-dynamic'

export default async function SpotlightsPage() {
  await requireAdmin()

  const admin = createAdminClient()
  const [{ data: reviews }, { data: guides }, { data: settings }] = await Promise.all([
    admin
      .from('reviews')
      .select('id, slug, title, product_name, category, rating, image_url, featured, is_top_pick')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('rating', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(100),
    admin
      .from('guides')
      .select('id, slug, title, category, image_url, featured')
      .eq('status', 'approved')
      .eq('is_visible', true)
      .order('published_at', { ascending: false })
      .limit(100),
    admin.from('site_settings').select('homepage_hero_type, homepage_hero_id').eq('id', 1).single(),
  ])

  const reviewCandidates: Candidate[] = (reviews ?? []).map((r) => ({
    id:        r.id,
    slug:      r.slug,
    title:     r.title,
    subtitle:  r.product_name,
    category:  r.category,
    rating:    r.rating,
    image_url: r.image_url,
    featured:  r.featured ?? false,
    top_pick:  r.is_top_pick ?? false,
  }))

  const guideCandidates: Candidate[] = (guides ?? []).map((g) => ({
    id:        g.id,
    slug:      g.slug,
    title:     g.title,
    subtitle:  null,
    category:  g.category,
    rating:    null,
    image_url: g.image_url,
    featured:  g.featured ?? false,
    top_pick:  false,
  }))

  const siteSettings: SiteSettings = {
    homepage_hero_type: (settings?.homepage_hero_type ?? null) as 'review' | 'guide' | null,
    homepage_hero_id:   settings?.homepage_hero_id ?? null,
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black">Editorial Spotlights</h1>
        <p className="text-prose-faint text-sm mt-1 max-w-2xl">
          One page for every site-wide editorial decision. Each zone is independent — pick the homepage marquee,
          the featured review, the featured guide, and the all-time top pick. Changes hit the public site immediately.
        </p>
      </div>

      <SpotlightsClient
        reviews={reviewCandidates}
        guides={guideCandidates}
        settings={siteSettings}
      />
    </div>
  )
}

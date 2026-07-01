import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/search?q=term — admin-only cross-content search
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const scope = url.searchParams.get('scope')

  const admin = createAdminClient()

  // Scoped mode — collections-only picker for the TiptapEditor "Insert
  // Collection" embed dialog. Visible-only (never embed a draft into published
  // prose), empty query → 12 most-recently-published collections. Returns the
  // same shape the old bespoke /api/admin/collections/search route did.
  if (scope === 'collections') {
    let query = admin
      .from('collections')
      .select('id, slug, title, collection_type')
      .eq('is_visible', true)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(12)
    if (q.length >= 2) {
      const like = `%${q}%`
      query = query.or(`title.ilike.${like},slug.ilike.${like},description.ilike.${like}`)
    }
    const { data } = await query
    return NextResponse.json({ collections: data ?? [] })
  }

  if (q.length < 2) return NextResponse.json({ articles: [], reviews: [], media: [], products: [], collections: [] })

  const like = `%${q}%`

  const [{ data: articles }, { data: reviews }, { data: media }, { data: products }, { data: collections }] = await Promise.all([
    admin
      .from('guides')
      .select('id, title, slug, status, category')
      .or(`title.ilike.${like},excerpt.ilike.${like}`)
      .order('updated_at', { ascending: false })
      .limit(8),
    admin
      .from('reviews')
      .select('id, title, slug, status, category, product_name, rating, image_url')
      .or(`title.ilike.${like},product_name.ilike.${like},excerpt.ilike.${like}`)
      .order('updated_at', { ascending: false })
      .limit(8),
    admin
      .from('media_assets')
      .select('id, url, filename, alt_text')
      .or(`filename.ilike.${like},alt_text.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(8),
    // Products channel powers the collection builder's "add an un-reviewed
    // product" path (mig 110). Archived gear is dead weight — exclude it.
    admin
      .from('products')
      .select('slug, name, brand, image_url, affiliate_url, status, category, review_id')
      .or(`name.ilike.${like},slug.ilike.${like},brand.ilike.${like}`)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(8),
    // Collections channel — cross-content nav (jump to the editor). Includes
    // drafts (admin is editing), unlike the visible-only embed-picker scope.
    admin
      .from('collections')
      .select('id, slug, title, collection_type, is_visible')
      .or(`title.ilike.${like},slug.ilike.${like},description.ilike.${like}`)
      .order('updated_at', { ascending: false })
      .limit(8),
  ])

  // Tag each product with whether it already has an approved, visible review.
  // Such products should be added to a collection AS that review (full card),
  // not as a bare product — the builder uses this flag to steer the editor.
  const productRows = products ?? []
  const slugs = productRows.map((p) => p.slug)
  let reviewedSlugs = new Set<string>()
  if (slugs.length > 0) {
    const { data: reviewed } = await admin
      .from('reviews')
      .select('product_slug')
      .in('product_slug', slugs)
      .eq('status', 'approved')
      .eq('is_visible', true)
    reviewedSlugs = new Set((reviewed ?? []).map((r) => r.product_slug).filter(Boolean) as string[])
  }

  const productResults = productRows.map((p) => ({
    source:          'product' as const,
    slug:            p.slug,
    name:            p.name,
    brand:           p.brand,
    image_url:       p.image_url,
    affiliate_url:   p.affiliate_url,
    status:          p.status,
    category:        p.category,
    already_reviewed: reviewedSlugs.has(p.slug),
  }))

  return NextResponse.json({
    articles:    articles    ?? [],
    reviews:     reviews     ?? [],
    media:       media       ?? [],
    products:    productResults,
    collections: collections ?? [],
  })
}

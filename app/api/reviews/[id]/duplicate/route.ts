import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/reviews/[id]/duplicate — clone a review as a new draft
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: source } = await admin
    .from('reviews')
    .select('title, product_name, category, excerpt, content, image_url, pros, cons, has_affiliate_links, disclosure_acknowledged, reading_time_minutes, score_quality, score_value, score_ease, score_daily_use, would_rebuy')
    .eq('id', id)
    .single()

  if (!source) return NextResponse.json({ error: 'Source review not found' }, { status: 404 })

  const baseTitle = `${source.title} (copy)`.slice(0, 120)
  const { generateUniqueSlug } = await import('@/lib/slug')
  const slug = await generateUniqueSlug(admin, 'reviews', baseTitle)

  const { data: newReview, error } = await admin
    .from('reviews')
    .insert({
      author_id:                user.id,
      slug,
      title:                    baseTitle,
      product_name:             source.product_name,
      category:                 source.category,
      excerpt:                  source.excerpt,
      content:                  source.content,
      image_url:                source.image_url,
      score_quality:            source.score_quality,
      score_value:              source.score_value,
      score_ease:               source.score_ease,
      score_daily_use:          source.score_daily_use,
      would_rebuy:              source.would_rebuy,
      pros:                     source.pros,
      cons:                     source.cons,
      has_affiliate_links:      source.has_affiliate_links,
      disclosure_acknowledged:  source.disclosure_acknowledged,
      reading_time_minutes:     source.reading_time_minutes,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Review duplicate failed:', error)
    return NextResponse.json({ error: `Duplicate failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ review: newReview }, { status: 201 })
}

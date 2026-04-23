import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/reviews/[id]/duplicate — clone a review as a new draft
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: source } = await admin
    .from('reviews')
    .select('title, product_name, category, excerpt, content, image_url, rating, pros, cons, has_affiliate_links, disclosure_acknowledged, reading_time_minutes')
    .eq('id', id)
    .single()

  if (!source) return NextResponse.json({ error: 'Source review not found' }, { status: 404 })

  const baseTitle = `${source.title} (copy)`.slice(0, 120)
  const slug = baseTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
    + '-' + crypto.randomUUID().replace(/-/g, '').slice(0, 8)

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
      rating:                   source.rating,
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

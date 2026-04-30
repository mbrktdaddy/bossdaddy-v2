import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/wishlist/[id]/promote — create a review draft from a wishlist item (admin only)
// Sets wishlist_items.review_id and status='reviewed'.
// Does NOT notify subscribers — that fires when the review actually publishes.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const { data: item } = await admin
    .from('wishlist_items')
    .select('*')
    .eq('id', id)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (item.review_id) return NextResponse.json({ error: 'Already promoted', review_id: item.review_id }, { status: 409 })

  // Resolve product_slug if a matching products row exists
  let product_slug: string | null = null
  if (item.slug) {
    const { data: product } = await admin.from('products').select('slug').eq('slug', item.slug).maybeSingle()
    if (product) product_slug = product.slug
  }

  // Generate slug for the review draft
  const baseSlug = `${item.title} Review`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  const reviewSlug = `${baseSlug}-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`

  // Create review draft
  const { data: review, error: reviewError } = await admin
    .from('reviews')
    .insert({
      slug:                    reviewSlug,
      title:                   `${item.title} — Review`,
      product_name:            item.title,
      status:                  'draft',
      author_id:               user.id,
      image_url:               item.image_url ?? null,
      product_slug:            product_slug,
      disclosure_acknowledged: false,
      content:                 '',
      rating:                  5,
      pros:                    [],
      cons:                    [],
    })
    .select('id, slug')
    .single()

  if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 })

  // Link wishlist item to the new review
  await admin
    .from('wishlist_items')
    .update({ review_id: review.id, status: 'reviewed' })
    .eq('id', id)

  revalidatePath('/wishlist')
  revalidatePath('/')

  return NextResponse.json({ review_id: review.id, review_slug: review.slug }, { status: 201 })
}

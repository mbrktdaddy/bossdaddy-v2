import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/wishlist/[id]/promote — create a review draft from a wishlist item (admin only)
// Sets products.review_id and status='reviewed'.
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
    .from('products')
    .select('*')
    .eq('id', id)
    .single()

  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (item.review_id) return NextResponse.json({ error: 'Already promoted', review_id: item.review_id }, { status: 409 })

  // The bench item is itself a products row now — link the review to its slug.
  const product_slug: string | null = item.slug ?? null

  const { generateUniqueSlug } = await import('@/lib/slug')
  const reviewSlug = await generateUniqueSlug(admin, 'reviews', `${item.name} Review`)

  // Create review draft — category defaults to 'other' (admin can update in workspace)
  const { data: review, error: reviewError } = await admin
    .from('reviews')
    .insert({
      slug:                    reviewSlug,
      title:                   `${item.name} — Review`,
      product_name:            item.name,
      category:                'other',
      status:                  'draft',
      author_id:               user.id,
      image_url:               item.image_url ?? null,
      product_slug:            product_slug,
      disclosure_acknowledged: false,
      content:                 '',
      pros:                    [],
      cons:                    [],
    })
    .select('id, slug')
    .single()

  if (reviewError) return NextResponse.json({ error: reviewError.message }, { status: 500 })

  // Link the product to the new review and advance it to 'reviewed'.
  await admin
    .from('products')
    .update({ review_id: review.id, status: 'reviewed' })
    .eq('id', id)

  revalidatePath('/bench')
  revalidatePath('/reviews')
  revalidatePath('/gear')
  revalidatePath('/')

  return NextResponse.json({ review_id: review.id, review_slug: review.slug }, { status: 201 })
}

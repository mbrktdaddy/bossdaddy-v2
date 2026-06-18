import { NextResponse, type NextRequest, after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyWishlistSubscribers } from '@/lib/wishlist-emails'
import type { Database } from '@/lib/supabase/database.types'
import { z } from 'zod'

type ProductUpdate = Database['public']['Tables']['products']['Update']

const UpdateSchema = z.object({
  slug:                   z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  title:                  z.string().min(2).max(160).optional(),
  description:            z.string().max(1000).optional().nullable(),
  image_url:              z.string().url().max(2048).optional().nullable(),
  gallery_images:         z.array(z.string().url().max(2048)).max(12).optional(),
  affiliate_url:          z.string().url().max(2048).optional().nullable(),
  store:                  z.string().max(40).optional().nullable(),
  custom_store_name:      z.string().max(80).optional().nullable(),
  asin:                   z.string().max(20).optional().nullable(),
  status:                 z.enum(['considering','queued','testing','reviewed','passed']).optional(),
  skip_reason:            z.string().max(500).optional().nullable(),
  estimated_review_date:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  priority:               z.number().int().optional(),
})

// Products-spine columns that make up a bench item (name aliased to title).
const BENCH_COLS =
  'id, slug, title:name, description, image_url, gallery_images, affiliate_url, store, custom_store_name, asin, status, skip_reason, estimated_review_date, review_id, priority, created_at, updated_at'

// GET /api/wishlist/[id] — single item with vote counts + user state
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: item, error } = await admin
    .from('products')
    .select(`${BENCH_COLS}, vote_count:wishlist_votes(count)`)
    .eq('id', id)
    .single()

  if (error || !item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  let user_has_voted = false
  let user_subscribed = false

  if (user) {
    const [{ data: vote }, { data: sub }] = await Promise.all([
      admin.from('wishlist_votes').select('id').eq('wishlist_item_id', id).eq('user_id', user.id).maybeSingle(),
      admin.from('wishlist_subscriptions').select('id').eq('wishlist_item_id', id).eq('user_id', user.id).maybeSingle(),
    ])
    user_has_voted = !!vote
    user_subscribed = !!sub
  }

  return NextResponse.json({
    item: {
      ...item,
      vote_count: (item.vote_count as { count: number }[])?.[0]?.count ?? 0,
      user_has_voted,
      user_subscribed,
    },
  })
}

// PATCH /api/wishlist/[id] — admin update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()

  // Capture old status before the update so we can detect transitions
  const { data: existing } = await admin
    .from('products')
    .select('status')
    .eq('id', id)
    .single()
  const oldStatus = existing?.status as string | undefined

  // Map the bench `title` field onto the spine's `name` column.
  const { title, ...rest } = parsed.data
  const updatePayload = { ...rest } as ProductUpdate
  if (title !== undefined) updatePayload.name = title

  const { data, error } = await admin
    .from('products')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePath('/bench')
  revalidatePath('/reviews')
  revalidatePath('/gear')
  revalidatePath('/')

  // Notify subscribers on forward status transitions to 'queued' or 'testing'.
  // The 'reviewed' transition is handled separately when a review is approved
  // (in app/api/reviews/[id]/route.ts) since that path also has the review slug.
  const newStatus = (data?.status as string | undefined)
  const transitioned = oldStatus && newStatus && oldStatus !== newStatus
  if (transitioned && (newStatus === 'queued' || newStatus === 'testing')) {
    after(async () => {
      try {
        await notifyWishlistSubscribers({ itemId: id, status: newStatus })
      } catch (err) {
        console.error('Wishlist status notification failed:', err)
      }
    })
  }

  return NextResponse.json({ item: data })
}

// DELETE /api/wishlist/[id] — admin delete
export async function DELETE(
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
  const { error } = await admin.from('products').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/bench')
  revalidatePath('/reviews')
  revalidatePath('/gear')
  revalidatePath('/')

  return NextResponse.json({ success: true })
}

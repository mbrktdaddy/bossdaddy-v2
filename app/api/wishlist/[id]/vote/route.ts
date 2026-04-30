import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/wishlist/[id]/vote — toggle vote on/off (members only)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Check if vote exists
  const { data: existing } = await admin
    .from('wishlist_votes')
    .select('id')
    .eq('wishlist_item_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // Remove vote
    await admin.from('wishlist_votes').delete().eq('id', existing.id)
    const { count } = await admin
      .from('wishlist_votes')
      .select('*', { count: 'exact', head: true })
      .eq('wishlist_item_id', id)
    revalidatePath('/wishlist')
    return NextResponse.json({ voted: false, vote_count: count ?? 0 })
  } else {
    // Add vote — verify item exists first
    const { data: item } = await admin
      .from('wishlist_items')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await admin.from('wishlist_votes').insert({ wishlist_item_id: id, user_id: user.id })
    const { count } = await admin
      .from('wishlist_votes')
      .select('*', { count: 'exact', head: true })
      .eq('wishlist_item_id', id)
    revalidatePath('/wishlist')
    return NextResponse.json({ voted: true, vote_count: count ?? 0 })
  }
}

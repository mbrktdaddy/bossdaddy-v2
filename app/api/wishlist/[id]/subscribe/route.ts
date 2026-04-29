import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/wishlist/[id]/subscribe — toggle subscription on/off (members only)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('wishlist_subscriptions')
    .select('id')
    .eq('wishlist_item_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    await admin.from('wishlist_subscriptions').delete().eq('id', existing.id)
    return NextResponse.json({ subscribed: false })
  } else {
    const { data: item } = await admin
      .from('wishlist_items')
      .select('id')
      .eq('id', id)
      .maybeSingle()
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await admin.from('wishlist_subscriptions').insert({ wishlist_item_id: id, user_id: user.id })
    return NextResponse.json({ subscribed: true })
  }
}

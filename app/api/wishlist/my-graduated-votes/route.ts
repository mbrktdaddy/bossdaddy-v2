import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/wishlist/my-graduated-votes — bench items the current user voted on
// that have since graduated into a PUBLISHED review. Powers the personalized
// "a review you voted for just dropped" payoff (VotePayoffBanner). Returns
// { items: [] } for logged-out users so the client can call it unconditionally.
export async function GET() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ items: [] })

  const admin = createAdminClient()

  const { data: votes } = await admin
    .from('wishlist_votes')
    .select('wishlist_item_id')
    .eq('user_id', user.id)
  if (!votes || votes.length === 0) return NextResponse.json({ items: [] })

  const itemIds = votes.map((v) => v.wishlist_item_id)
  const { data: grad } = await admin
    .from('wishlist_items')
    .select('id, title, review_id')
    .in('id', itemIds)
    .eq('status', 'reviewed')
    .not('review_id', 'is', null)
  if (!grad || grad.length === 0) return NextResponse.json({ items: [] })

  const reviewIds = grad.map((g) => g.review_id as string)
  const { data: reviews } = await admin
    .from('reviews')
    .select('id, slug, title, published_at')
    .in('id', reviewIds)
    .eq('status', 'approved')
    .eq('is_visible', true)
    .order('published_at', { ascending: false })
  if (!reviews || reviews.length === 0) return NextResponse.json({ items: [] })

  const benchTitleById = new Map(grad.map((g) => [g.review_id, g.title]))
  const items = reviews.map((r) => ({
    reviewSlug: r.slug,
    reviewTitle: r.title,
    title: benchTitleById.get(r.id) ?? r.title,
  }))

  return NextResponse.json({ items })
}

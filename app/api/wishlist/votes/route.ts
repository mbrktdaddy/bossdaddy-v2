import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseVoteIds } from '@/lib/wishlist'

// GET /api/wishlist/votes?ids=a,b,c — live vote counts plus the current user's
// votes for a page's worth of products, in one round-trip. RadarVote batches its
// per-card reads into this (components/wishlist/vote-state.ts), so a grid of
// Radar cards costs one request instead of one per card, and the pages
// themselves stay statically cached (same split as LikeButton + GET /api/likes).
export async function GET(request: NextRequest) {
  const ids = parseVoteIds(request.nextUrl.searchParams.get('ids'))
  if (ids.length === 0) return NextResponse.json({ items: {} })

  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  const admin = createAdminClient()

  // Counts come back aggregated per product (one row each), so a popular item
  // can't push the batch past PostgREST's row cap the way raw vote rows could.
  // `following` matters because a vote also follows (followChangeForVote): the
  // card promises an email only while the follow is really there, e.g. not
  // after the reader used an email's unsubscribe link.
  const none = Promise.resolve({ data: [] as { wishlist_item_id: string }[] })
  const [{ data: counts, error }, { data: myVotes }, { data: myFollows }] = await Promise.all([
    admin.from('products').select('id, vote_count:wishlist_votes(count)').in('id', ids),
    user
      ? admin.from('wishlist_votes').select('wishlist_item_id').in('wishlist_item_id', ids).eq('user_id', user.id)
      : none,
    user
      ? admin.from('wishlist_subscriptions').select('wishlist_item_id').in('wishlist_item_id', ids).eq('user_id', user.id)
      : none,
  ])
  if (error) return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })

  const votedIds    = new Set((myVotes ?? []).map((v) => v.wishlist_item_id))
  const followedIds = new Set((myFollows ?? []).map((f) => f.wishlist_item_id))
  const items: Record<string, { voted: boolean; vote_count: number; following: boolean }> = {}
  for (const row of (counts ?? []) as unknown as { id: string; vote_count: { count: number }[] }[]) {
    items[row.id] = {
      voted: votedIds.has(row.id),
      vote_count: row.vote_count?.[0]?.count ?? 0,
      following: followedIds.has(row.id),
    }
  }

  return NextResponse.json(
    { items, authenticated: !!user },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

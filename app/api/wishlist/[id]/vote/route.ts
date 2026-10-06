import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isRadarLive } from '@/lib/products'
import { followChangeForVote } from '@/lib/wishlist'
import { revalidateVotePaths } from '@/lib/revalidate'

// The vote is how a reader asks for a Radar item to be tested ("Want me to test
// it?"), and it also follows the item so the voter hears how it turned out
// (followChangeForVote has the rules). Per-user vote + follow state is read in
// batches by GET /api/wishlist/votes, so the pages that show the vote stay
// statically cached.

type Admin = ReturnType<typeof createAdminClient>

async function countVotes(admin: Admin, id: string) {
  const { count } = await admin
    .from('wishlist_votes')
    .select('*', { count: 'exact', head: true })
    .eq('wishlist_item_id', id)
  return count ?? 0
}

// POST /api/wishlist/[id]/vote — toggle vote on/off (members only).
// Responds { voted, vote_count, following }. `following` is what the card may
// promise ("I'll email you when I test it"), so it's only true when the follow
// row is really there.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const [{ data: existing }, { data: item }] = await Promise.all([
    admin
      .from('wishlist_votes')
      .select('id')
      .eq('wishlist_item_id', id)
      .eq('user_id', user.id)
      .maybeSingle(),
    admin
      .from('products')
      .select('id, status, spotted_at')
      .eq('id', id)
      .maybeSingle(),
  ])

  if (existing) {
    // Taking a vote back is always allowed, wherever the item is now.
    const { error } = await admin.from('wishlist_votes').delete().eq('id', existing.id)
    if (error) return NextResponse.json({ error: 'Could not remove your vote' }, { status: 500 })

    // Still on the Radar = the request is withdrawn, so its follow goes too.
    if (followChangeForVote(false, item?.status ?? null) === 'unfollow') {
      const { error: unfollowError } = await admin
        .from('wishlist_subscriptions')
        .delete()
        .eq('wishlist_item_id', id)
        .eq('user_id', user.id)
      if (unfollowError) console.error('Vote unfollow failed:', unfollowError)
    }

    revalidateVotePaths()
    return NextResponse.json({ voted: false, vote_count: await countVotes(admin, id), following: false })
  }

  // A NEW vote only lands on a live Radar item. The Bench's one job is follow,
  // and catalog / scheduled items aren't public. Votes already cast carry over
  // when the item moves on (the Bench shows them as "Requested by N dads").
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!isRadarLive(item)) {
    return NextResponse.json({ error: "Voting's closed on this one." }, { status: 409 })
  }

  const { error } = await admin.from('wishlist_votes').insert({ wishlist_item_id: id, user_id: user.id })
  if (error) return NextResponse.json({ error: 'Could not save your vote' }, { status: 500 })

  // The vote also follows. An existing follow is kept as-is (unique per
  // person + item). If this fails the vote still stands; the card just won't
  // promise an email it can't keep.
  const { error: followError } = await admin
    .from('wishlist_subscriptions')
    .upsert(
      { wishlist_item_id: id, user_id: user.id },
      { onConflict: 'wishlist_item_id,user_id', ignoreDuplicates: true },
    )
  if (followError) console.error('Vote follow failed:', followError)

  revalidateVotePaths()
  return NextResponse.json({ voted: true, vote_count: await countVotes(admin, id), following: !followError })
}

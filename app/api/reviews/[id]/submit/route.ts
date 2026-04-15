import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/reviews/[id]/submit — transition draft → pending, trigger moderation
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership and current status
  const { data: review, error: fetchError } = await supabase
    .from('reviews')
    .select('id, has_affiliate_links, disclosure_acknowledged, status')
    .eq('id', id)
    .eq('author_id', user.id)
    .single()

  if (fetchError || !review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  if (!['draft', 'rejected'].includes(review.status)) {
    return NextResponse.json({ error: 'Only drafts or rejected reviews can be submitted' }, { status: 422 })
  }

  if (review.has_affiliate_links && !review.disclosure_acknowledged) {
    return NextResponse.json(
      { error: 'Affiliate disclosure must be acknowledged before submitting' },
      { status: 422 }
    )
  }

  // Transition to pending
  const { error: updateError } = await supabase
    .from('reviews')
    .update({ status: 'pending' })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Trigger Claude moderation asynchronously (fire and forget)
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  fetch(`${baseUrl}/api/claude/moderate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': process.env.INTERNAL_API_SECRET ?? '',
    },
    body: JSON.stringify({ reviewId: id }),
  }).catch((err) => console.error('Moderation trigger failed:', err))

  return NextResponse.json({ success: true, status: 'pending' })
}

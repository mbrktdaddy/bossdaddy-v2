import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { safeAfter } from '@/lib/server/safeAfter'

// POST /api/reviews/[id]/submit — transition draft → pending, trigger moderation
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await checkRateLimit(`submit:${user.id}`, 'submit')
  if (!success) {
    return NextResponse.json({ error: 'Too many submissions. Try again in an hour.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const { data: review } = await admin
    .from('reviews')
    .select('id, author_id, has_affiliate_links, disclosure_acknowledged, status')
    .eq('id', id)
    .single()

  if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  if (review.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['draft', 'rejected'].includes(review.status)) {
    return NextResponse.json({ error: 'Only drafts or rejected reviews can be submitted' }, { status: 422 })
  }
  if (review.has_affiliate_links && !review.disclosure_acknowledged) {
    return NextResponse.json({ error: 'Affiliate disclosure must be acknowledged before submitting' }, { status: 422 })
  }

  const { error: updateError } = await admin
    .from('reviews')
    .update({ status: 'pending', rejection_reason: null })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: 'Submission failed' }, { status: 500 })

  revalidatePath('/dashboard/reviews')
  revalidatePath('/dashboard/moderation')

  // Trigger moderation after response so Vercel doesn't kill it
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) console.error('INTERNAL_API_SECRET not set — moderation will not run')
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  safeAfter('review-moderation', async () => {
    await fetch(`${baseUrl}/api/claude/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret ?? '' },
      body: JSON.stringify({ reviewId: id }),
    }).catch((err) => console.error('Review moderation trigger failed:', err))
  })

  return NextResponse.json({ success: true, status: 'pending' })
}

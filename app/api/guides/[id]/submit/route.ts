import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { safeAfter } from '@/lib/server/safeAfter'
import { isDisclosureBlocked } from '@/lib/reviews'

// POST /api/guides/[id]/submit — transition draft → pending, trigger moderation
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
  const { data: article } = await admin
    .from('guides')
    .select('id, status, author_id, has_affiliate_links, disclosure_acknowledged')
    .eq('id', id)
    .single()

  if (!article) return NextResponse.json({ error: 'Guide not found' }, { status: 404 })
  if (article.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['draft', 'rejected'].includes(article.status)) {
    return NextResponse.json({ error: 'Only drafts or rejected guides can be submitted' }, { status: 422 })
  }
  // FTC gate — mirrors api/reviews/[id]/submit. Guides gained the
  // acknowledgement column in migration 148; before that a guide could carry
  // affiliate links all the way to publication with nothing recording that the
  // author had acknowledged the disclosure.
  if (isDisclosureBlocked(article)) {
    return NextResponse.json({ error: 'Affiliate disclosure must be acknowledged before submitting' }, { status: 422 })
  }

  const { error: updateError } = await admin
    .from('guides')
    .update({ status: 'pending', rejection_reason: null })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: 'Submission failed' }, { status: 500 })

  revalidatePath('/dashboard/guides')
  revalidatePath('/dashboard/moderation')

  // Trigger moderation after response so Vercel doesn't kill it
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) console.error('INTERNAL_API_SECRET not set — moderation will not run')
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  safeAfter('guide-moderation', async () => {
    await fetch(`${baseUrl}/api/claude/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret ?? '' },
      body: JSON.stringify({ guideId: id }),
    }).catch((err) => console.error('Guide moderation trigger failed:', err))
  })

  return NextResponse.json({ success: true, status: 'pending' })
}

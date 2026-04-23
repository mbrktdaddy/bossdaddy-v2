import { NextResponse, type NextRequest, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'

// POST /api/articles/[id]/submit — transition draft → pending, trigger moderation
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = await checkRateLimit(`submit:${user.id}`, 'submit')
  if (!success) {
    return NextResponse.json({ error: 'Too many submissions. Try again in an hour.' }, { status: 429 })
  }

  const admin = createAdminClient()
  const { data: article } = await admin
    .from('articles')
    .select('id, status, author_id')
    .eq('id', id)
    .single()

  if (!article) return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  if (article.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['draft', 'rejected'].includes(article.status)) {
    return NextResponse.json({ error: 'Only drafts or rejected articles can be submitted' }, { status: 422 })
  }

  const { error: updateError } = await admin
    .from('articles')
    .update({ status: 'pending', rejection_reason: null })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: 'Submission failed' }, { status: 500 })

  // Trigger moderation after response so Vercel doesn't kill it
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) console.error('INTERNAL_API_SECRET not set — moderation will not run')
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  after(async () => {
    await fetch(`${baseUrl}/api/claude/moderate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-secret': secret ?? '' },
      body: JSON.stringify({ articleId: id }),
    }).catch((err) => console.error('Article moderation trigger failed:', err))
  })

  return NextResponse.json({ success: true, status: 'pending' })
}

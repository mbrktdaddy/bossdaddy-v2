import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

// POST /api/articles/[id]/submit — transition draft → pending
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

  const { data: article, error: fetchError } = await supabase
    .from('articles')
    .select('id, status')
    .eq('id', id)
    .eq('author_id', user.id)
    .single()

  if (fetchError || !article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  if (!['draft', 'rejected'].includes(article.status)) {
    return NextResponse.json(
      { error: 'Only drafts or rejected articles can be submitted' },
      { status: 422 }
    )
  }

  const { error: updateError } = await supabase
    .from('articles')
    .update({ status: 'pending' })
    .eq('id', id)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ success: true, status: 'pending' })
}

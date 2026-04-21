import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeHtml } from '@/lib/sanitize'
import { z } from 'zod'

const CreateCommentSchema = z.object({
  content_type: z.enum(['review', 'article']),
  content_id:   z.string().uuid(),
  body:         z.string().min(5).max(2000),
})

// POST /api/comments — submit a comment (lands in pending)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to leave a comment.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = CreateCommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      author_id:    user.id,
      content_type: parsed.data.content_type,
      content_id:   parsed.data.content_id,
      body:         sanitizeHtml(parsed.data.body.trim()),
      status:       'pending',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to post comment' }, { status: 500 })
  return NextResponse.json({ comment: data }, { status: 201 })
}

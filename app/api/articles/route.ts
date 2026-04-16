import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeHtml } from '@/lib/sanitize'
import { computeReadingTime } from '@/lib/reading-time'
import { z } from 'zod'

const CreateArticleSchema = z.object({
  title: z.string().min(10).max(120),
  category: z.string().default('other'),
  excerpt: z.string().max(200).optional(),
  content: z.string().min(100),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Role check — only authors and admins can create articles
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['author', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Only authors and admins can create articles.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = CreateArticleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { title, category, excerpt, content } = parsed.data
  const sanitizedContent = sanitizeHtml(content)

  const slug =
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) +
    '-' + Math.random().toString(36).slice(2, 7)

  const { data, error } = await supabase
    .from('articles')
    .insert({
      author_id: user.id,
      slug,
      title,
      category,
      excerpt: excerpt ?? null,
      content: sanitizedContent,
      reading_time_minutes: computeReadingTime(sanitizedContent),
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ article: data }, { status: 201 })
}

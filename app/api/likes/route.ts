import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const LikeSchema = z.object({
  content_type: z.enum(['review', 'article', 'comment']),
  content_id:   z.string().uuid(),
})

const GetSchema = z.object({
  type: z.enum(['review', 'article', 'comment']),
  id:   z.string().uuid(),
})

// GET /api/likes?type=review&id=uuid — count + current user's like status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const parsed = GetSchema.safeParse({ type: searchParams.get('type'), id: searchParams.get('id') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid type or id' }, { status: 400 })
  }
  const { type: content_type, id: content_id } = parsed.data

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { count } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('content_type', content_type)
    .eq('content_id', content_id)

  let liked = false
  if (user) {
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('content_type', content_type)
      .eq('content_id', content_id)
      .eq('user_id', user.id)
      .single()
    liked = !!data
  }

  return NextResponse.json({ count: count ?? 0, liked })
}

// POST /api/likes — toggle like (insert or delete)
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'
  const { success } = await checkRateLimit(`like:${ip}`, 'submit')
  if (!success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to like.' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = LikeSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const { content_type, content_id } = parsed.data

  // Check if already liked
  const { data: existing } = await supabase
    .from('likes')
    .select('id')
    .eq('user_id', user.id)
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .single()

  if (existing) {
    // Unlike
    await supabase.from('likes').delete().eq('id', existing.id)
  } else {
    // Like
    await supabase.from('likes').insert({ user_id: user.id, content_type, content_id })
  }

  // Return updated count
  const { count } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('content_type', content_type)
    .eq('content_id', content_id)

  return NextResponse.json({ liked: !existing, count: count ?? 0 })
}

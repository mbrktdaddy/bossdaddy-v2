import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const contentType = searchParams.get('content_type')
  const contentId   = searchParams.get('content_id')
  if (!contentType || !contentId) {
    return NextResponse.json({ error: 'Missing content_type or content_id' }, { status: 400 })
  }
  if (!['article', 'review'].includes(contentType)) {
    return NextResponse.json({ error: 'Invalid content_type' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('social_posts')
    .select('platform, body, hashtags, generated_at')
    .eq('content_type', contentType)
    .eq('content_id', contentId)
    .order('platform', { ascending: true })

  if (error) {
    console.error('social-posts list error:', error)
    return NextResponse.json({ error: 'Load failed' }, { status: 500 })
  }

  return NextResponse.json({ posts: data ?? [] })
}

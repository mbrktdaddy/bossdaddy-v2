import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const Platform = z.enum(['twitter', 'instagram', 'facebook', 'linkedin', 'threads'])
const ContentType = z.enum(['article', 'review'])

async function gateRole(): Promise<{ user: { id: string } } | NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return { user }
}

export async function GET(request: NextRequest) {
  const auth = await gateRole()
  if (auth instanceof NextResponse) return auth

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

const PatchSchema = z.object({
  content_type: ContentType,
  content_id:   z.string().uuid(),
  platform:     Platform,
  body:         z.string().min(1).max(4000).optional(),
  hashtags:     z.array(z.string().min(1).max(60)).max(30).optional(),
}).refine((d) => d.body !== undefined || d.hashtags !== undefined, {
  message: 'Provide body or hashtags to update',
})

export async function PATCH(request: NextRequest) {
  const auth = await gateRole()
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { content_type, content_id, platform, body: nextBody, hashtags } = parsed.data
  const update: Record<string, unknown> = {}
  if (nextBody !== undefined) update.body = nextBody
  if (hashtags !== undefined) update.hashtags = hashtags.map((t) => t.replace(/^#/, ''))

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('social_posts')
    .update(update)
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .eq('platform', platform)
    .select('platform, body, hashtags, generated_at')
    .maybeSingle()

  if (error) {
    console.error('social-posts patch error:', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }
  return NextResponse.json({ post: data })
}

const DeleteSchema = z.object({
  content_type: ContentType,
  content_id:   z.string().uuid(),
  platform:     Platform,
})

export async function DELETE(request: NextRequest) {
  const auth = await gateRole()
  if (auth instanceof NextResponse) return auth

  const body = await request.json().catch(() => null)
  const parsed = DeleteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const { content_type, content_id, platform } = parsed.data
  const admin = createAdminClient()
  const { error } = await admin
    .from('social_posts')
    .delete()
    .eq('content_type', content_type)
    .eq('content_id', content_id)
    .eq('platform', platform)

  if (error) {
    console.error('social-posts delete error:', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}

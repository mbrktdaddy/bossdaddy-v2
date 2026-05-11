import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLATFORM_IDS } from '@/lib/social-platforms'
import { z } from 'zod'

async function requireAuth() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { user, error: null }
}

// GET /api/social-posts?platform=x&status=draft
export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(request.url)
  const platform = searchParams.get('platform')
  const status   = searchParams.get('status')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('social_posts')
    .select('id, platform, content, status, source_type, source_title, link_url, image_url, notes, posted_at, created_at, updated_at')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  if (platform) query = query.eq('platform', platform)
  if (status)   query = query.eq('status', status)

  const { data, error: dbErr } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}

const CreateSchema = z.object({
  platform:     z.enum(PLATFORM_IDS as [string, ...string[]]),
  content:      z.string().min(1).max(5000),
  status:       z.enum(['draft', 'ready', 'posted']).optional().default('draft'),
  source_type:  z.enum(['review', 'guide', 'original']).optional(),
  source_id:    z.string().uuid().optional(),
  source_title: z.string().max(300).optional(),
  link_url:     z.string().url().optional().nullable(),
  image_url:    z.string().url().optional().nullable(),
  notes:        z.string().max(500).optional(),
})

// POST /api/social-posts — save a generated post
export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbErr } = await (admin as any)
    .from('social_posts')
    .insert({ ...parsed.data, user_id: user!.id })
    .select('id, platform, content, status, source_type, source_title, link_url, image_url, notes, posted_at, created_at, updated_at')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ post: data }, { status: 201 })
}

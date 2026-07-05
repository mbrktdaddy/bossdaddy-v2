import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLATFORM_IDS, overCharLimit } from '@/lib/social-platforms'
import { requireSocialActor } from '@/lib/social/generate'
import { z } from 'zod'

const SELECT = 'id, platform, content, status, source_type, source_id, source_title, link_url, image_url, notes, scheduled_at, posted_at, created_at, updated_at'

// GET /api/social-posts?platform=x&status=draft&source_type=review&source_id=…
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const actor = await requireSocialActor(supabase)
  if (actor.error) return actor.error
  const user = actor.user

  const { searchParams } = new URL(request.url)
  const platform    = searchParams.get('platform')
  const status      = searchParams.get('status')
  const source_type = searchParams.get('source_type')
  const source_id   = searchParams.get('source_id')

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (admin as any)
    .from('social_posts')
    .select(SELECT)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (platform)    query = query.eq('platform', platform)
  if (status)      query = query.eq('status', status)
  if (source_type) query = query.eq('source_type', source_type)
  if (source_id)   query = query.eq('source_id', source_id)

  const { data, error: dbErr } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ posts: data ?? [] })
}

const CreateSchema = z.object({
  platform:     z.enum(PLATFORM_IDS as [string, ...string[]]),
  content:      z.string().min(1).max(5000),
  status:       z.enum(['draft', 'ready', 'posted']).optional().default('draft'),
  source_type:  z.enum(['review', 'guide', 'original', 'collection']).optional(),
  source_id:    z.string().uuid().optional(),
  source_title: z.string().max(300).optional(),
  link_url:     z.string().url().optional().nullable(),
  image_url:    z.string().url().optional().nullable(),
  notes:        z.string().max(500).optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional().nullable(),
})

// POST /api/social-posts — save a generated post
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const actor = await requireSocialActor(supabase)
  if (actor.error) return actor.error
  const user = actor.user

  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const tooLong = overCharLimit(parsed.data.platform, parsed.data.content, !!parsed.data.link_url)
  if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbErr } = await (admin as any)
    .from('social_posts')
    .insert({ ...parsed.data, user_id: user.id })
    .select(SELECT)
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ post: data }, { status: 201 })
}

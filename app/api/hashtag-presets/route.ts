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

// GET /api/hashtag-presets?platform=x
export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const platform = new URL(request.url).searchParams.get('platform') ?? 'x'
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('hashtag_presets')
    .select('id, name, platform, tags, created_at')
    .eq('user_id', user!.id)
    .eq('platform', platform)
    .order('created_at', { ascending: true })

  return NextResponse.json({ presets: data ?? [] })
}

const CreateSchema = z.object({
  platform: z.enum(PLATFORM_IDS as [string, ...string[]]),
  name:     z.string().min(1).max(60),
  tags:     z.array(z.string().min(1).max(60).transform((t) => t.replace(/^#/, ''))).min(1).max(30),
})

// POST /api/hashtag-presets
export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth()
  if (error) return error

  const body = await request.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbErr } = await (admin as any)
    .from('hashtag_presets')
    .insert({ ...parsed.data, user_id: user!.id })
    .select('id, name, platform, tags, created_at')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ preset: data }, { status: 201 })
}

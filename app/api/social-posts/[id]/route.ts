import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

async function requireAuth() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  return { user, error: null }
}

const PatchSchema = z.object({
  content:   z.string().min(1).max(5000).optional(),
  status:    z.enum(['draft', 'ready', 'posted']).optional(),
  notes:     z.string().max(500).optional().nullable(),
  link_url:  z.string().url().optional().nullable(),
  image_url: z.string().url().optional().nullable(),
})

// PATCH /api/social-posts/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const update: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() }
  if (parsed.data.status === 'posted') update.posted_at = new Date().toISOString()

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbErr } = await (admin as any)
    .from('social_posts')
    .update(update)
    .eq('id', id)
    .eq('user_id', user!.id)
    .select('id, platform, content, status, source_type, source_title, link_url, image_url, notes, posted_at, created_at, updated_at')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ post: data })
}

// DELETE /api/social-posts/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireAuth()
  if (error) return error

  const { id } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbErr } = await (admin as any)
    .from('social_posts')
    .delete()
    .eq('id', id)
    .eq('user_id', user!.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

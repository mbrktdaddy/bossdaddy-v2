import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const Schema = z.object({
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(20),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const admin = createAdminClient()

  const { data: guide } = await admin
    .from('guides').select('author_id').eq('id', id).single()
  if (!guide) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  if (!isAdmin && guide.author_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await admin.from('guide_tags').delete().eq('guide_id', id)

  if (parsed.data.tags.length > 0) {
    await admin.from('guide_tags').insert(
      parsed.data.tags.map((tag_slug) => ({ guide_id: id, tag_slug }))
    )
  }

  return NextResponse.json({ ok: true })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = createAdminClient()
  const { data } = await admin
    .from('guide_tags').select('tag_slug').eq('guide_id', id)
  return NextResponse.json({ tags: (data ?? []).map((r) => r.tag_slug) })
}

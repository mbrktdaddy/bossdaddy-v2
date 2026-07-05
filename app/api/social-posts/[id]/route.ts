import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireSocialActor } from '@/lib/social/generate'
import { overCharLimit } from '@/lib/social-platforms'
import { z } from 'zod'

const SELECT = 'id, platform, content, status, source_type, source_id, source_title, link_url, image_url, notes, scheduled_at, posted_at, created_at, updated_at'

const PatchSchema = z.object({
  content:      z.string().min(1).max(5000).optional(),
  status:       z.enum(['draft', 'ready', 'posted']).optional(),
  notes:        z.string().max(500).optional().nullable(),
  link_url:     z.string().url().optional().nullable(),
  image_url:    z.string().url().optional().nullable(),
  scheduled_at: z.string().datetime({ offset: true }).optional().nullable(),
})

// PATCH /api/social-posts/[id]
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const actor = await requireSocialActor(supabase)
  if (actor.error) return actor.error
  const user = actor.user

  const { id } = await params
  const body = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const update: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() }
  if (parsed.data.status === 'posted') update.posted_at = new Date().toISOString()

  const admin = createAdminClient()

  // Enforce the platform char limit whenever the content changes. PatchSchema
  // has no `platform` (it isn't editable), so read it from the row; use the
  // payload's link_url if the client sent one, else the stored value.
  if (parsed.data.content !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin as any)
      .from('social_posts')
      .select('platform, link_url')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (existing) {
      const hasLink = 'link_url' in parsed.data ? !!parsed.data.link_url : !!existing.link_url
      const tooLong = overCharLimit(existing.platform, parsed.data.content, hasLink)
      if (tooLong) return NextResponse.json({ error: tooLong }, { status: 400 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbErr } = await (admin as any)
    .from('social_posts')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(SELECT)
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ post: data })
}

// DELETE /api/social-posts/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const actor = await requireSocialActor(supabase)
  if (actor.error) return actor.error
  const user = actor.user

  const { id } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbErr } = await (admin as any)
    .from('social_posts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

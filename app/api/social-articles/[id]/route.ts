import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { serializeForX } from '@/lib/x/serialize'
import { requireSocialActor } from '@/lib/social/generate'
import { z } from 'zod'

const FULL_SELECT = 'id, title, body_html, cover_image_url, source_type, source_id, source_title, status, dropped_tags, scheduled_at, external_id, external_url, posted_via, posted_at, created_at, updated_at'

// GET /api/social-articles/[id] — one article, with a fresh X-serialized preview.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const actor = await requireSocialActor(supabase)
  if (actor.error) return actor.error
  const user = actor.user

  const { id } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbErr } = await (admin as any)
    .from('social_articles')
    .select(FULL_SELECT)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { html: x_html, dropped } = serializeForX(data.body_html as string | null)
  return NextResponse.json({ article: data, x_html, dropped })
}

const PatchSchema = z.object({
  title:           z.string().min(1).max(300).optional(),
  body_html:       z.string().max(100_000).optional(),
  cover_image_url: z.string().url().optional().nullable(),
  status:          z.enum(['draft', 'ready', 'posted']).optional(),
  scheduled_at:    z.string().datetime({ offset: true }).optional().nullable(),
  source_title:    z.string().max(300).optional(),
  external_url:    z.string().url().optional().nullable(),
})

// PATCH /api/social-articles/[id]
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

  // Re-run the X serializer whenever the body changes so dropped_tags never drifts
  // from the stored HTML. Compute once; reuse for the response preview.
  let x_html: string | undefined
  let dropped: ReturnType<typeof serializeForX>['dropped'] | undefined
  if (parsed.data.body_html != null) {
    const res = serializeForX(parsed.data.body_html)
    x_html = res.html
    dropped = res.dropped
    update.dropped_tags = dropped
  }
  if (parsed.data.status === 'posted') update.posted_at = new Date().toISOString()

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbErr } = await (admin as any)
    .from('social_articles')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)
    .select(FULL_SELECT)
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  if (!data)  return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // If the body wasn't touched this PATCH, serialize the stored copy for preview.
  if (x_html == null) {
    const res = serializeForX(data.body_html as string | null)
    x_html = res.html
    dropped = res.dropped
  }
  return NextResponse.json({ article: data, x_html, dropped })
}

// DELETE /api/social-articles/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const actor = await requireSocialActor(supabase)
  if (actor.error) return actor.error
  const user = actor.user

  const { id } = await params
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbErr } = await (admin as any)
    .from('social_articles')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

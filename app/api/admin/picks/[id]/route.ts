import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OCCASIONS } from '@/lib/gift-occasions'
import { z } from 'zod'

const UpdateSchema = z.object({
  slug:                 z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  title:                z.string().min(2).max(160).optional(),
  description:          z.string().max(500).optional().nullable(),
  intro_html:           z.string().max(10000).optional().nullable(),
  hero_image_url:       z.string().url().max(2048).optional().nullable(),
  is_visible:           z.boolean().optional(),
  published_at:         z.string().optional().nullable(),
  collection_type:      z.enum(['general', 'gift_guide', 'best_of', 'comparison', 'stack']).optional(),
  occasion:             z.string().max(40).optional().nullable(),
  winner_summary:       z.string().max(500).optional().nullable(),
  bundle_total_cents:   z.number().int().min(0).optional().nullable(),
  items: z.array(z.object({
    review_id:     z.string().uuid(),
    position:      z.number().int(),
    blurb:         z.string().max(500).optional().nullable(),
    wins_category: z.string().max(80).optional().nullable(),
    role_label:    z.string().max(80).optional().nullable(),
  })).optional(),
})

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if ('error' in gate) return gate.error

  const admin = createAdminClient()
  const [{ data: pick }, { data: items }] = await Promise.all([
    admin.from('collections').select('*').eq('id', id).single(),
    admin.from('collection_items')
      .select('id, review_id, position, blurb, wins_category, role_label, reviews(id, slug, title, product_name, rating, image_url)')
      .eq('collection_id', id)
      .order('position'),
  ])

  if (!pick) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ pick, items: items ?? [] })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { items, ...meta } = parsed.data
  const admin = createAdminClient()

  if (Object.keys(meta).length > 0) {
    const payload: Record<string, unknown> = { ...meta }
    if (meta.is_visible && !meta.published_at) {
      const { data: existing } = await admin.from('collections').select('published_at').eq('id', id).single()
      if (!existing?.published_at) payload.published_at = new Date().toISOString()
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await admin.from('collections').update(payload as any).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (items !== undefined) {
    await admin.from('collection_items').delete().eq('collection_id', id)
    if (items.length > 0) {
      const rows = items.map((item) => ({ collection_id: id, ...item }))
      const { error } = await admin.from('collection_items').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  const { data: pick } = await admin.from('collections').select('*').eq('id', id).single()
  revalidatePath('/picks')
  revalidatePath('/gifts')
  revalidatePath('/comparisons')
  revalidatePath('/stacks')
  revalidatePath('/')
  if (pick?.slug) {
    if (pick.collection_type === 'comparison') revalidatePath(`/comparisons/${pick.slug}`)
    else if (pick.collection_type === 'stack') revalidatePath(`/stacks/${pick.slug}`)
    else revalidatePath(`/picks/${pick.slug}`)
  }
  if (pick?.occasion) {
    const occ = OCCASIONS.find((o) => o.value === pick.occasion)
    if (occ) revalidatePath(`/gifts/${occ.slug}`)
  }
  return NextResponse.json({ pick })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if ('error' in gate) return gate.error

  const admin = createAdminClient()
  const { error } = await admin.from('collections').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/picks')
  revalidatePath('/gifts')
  revalidatePath('/comparisons')
  revalidatePath('/stacks')
  revalidatePath('/')
  return NextResponse.json({ success: true })
}

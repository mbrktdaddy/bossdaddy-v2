import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const PickListSchema = z.object({
  slug:          z.string().min(2).max(80).regex(/^[a-z0-9-]+$/),
  title:         z.string().min(2).max(160),
  description:   z.string().max(500).optional().nullable(),
  intro_html:    z.string().max(10000).optional().nullable(),
  hero_image_url:z.string().url().max(2048).optional().nullable(),
  is_visible:    z.boolean().optional().default(false),
  published_at:  z.string().optional().nullable(),
  pick_type:     z.enum(['general', 'gift_guide', 'best_of']).optional().default('general'),
  occasion:      z.string().max(40).optional().nullable(),
})

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

export async function GET() {
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if ('error' in gate) return gate.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('pick_lists')
    .select('id, slug, title, description, hero_image_url, is_visible, published_at, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ picks: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => null)
  const parsed = PickListSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const insertPayload = { ...parsed.data, published_at: parsed.data.is_visible ? (parsed.data.published_at ?? new Date().toISOString()) : null }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await admin.from('pick_lists').insert(insertPayload as any).select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  revalidatePath('/picks')
  revalidatePath('/gifts')
  revalidatePath('/')
  if (parsed.data.occasion) {
    const { OCCASIONS } = await import('@/lib/gift-occasions')
    const occasionConfig = OCCASIONS.find((o) => o.value === parsed.data.occasion)
    if (occasionConfig) revalidatePath(`/gifts/${occasionConfig.slug}`)
  }
  return NextResponse.json({ pick: data }, { status: 201 })
}

import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const MerchSchema = z.object({
  slug:         z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only'),
  name:         z.string().min(2).max(160),
  description:  z.string().max(2000).optional().nullable(),
  price_cents:  z.number().int().nonnegative().nullable().optional(),
  image_url:    z.string().url().max(2048).optional().nullable(),
  category:     z.enum(['apparel', 'drinkware', 'accessories', 'stickers', 'other']).nullable().optional(),
  status:       z.enum(['concept', 'coming_soon', 'available', 'sold_out', 'discontinued']).default('coming_soon'),
  external_url: z.string().url().max(2048).optional().nullable(),
  position:     z.number().int().nonnegative().optional(),
})

async function requireAdmin() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('merch')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: `List failed: ${error.message}` }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  const parsed = MerchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('merch')
    .insert({
      slug:         parsed.data.slug,
      name:         parsed.data.name,
      description:  parsed.data.description ?? null,
      price_cents:  parsed.data.price_cents ?? null,
      image_url:    parsed.data.image_url ?? null,
      category:     parsed.data.category ?? null,
      status:       parsed.data.status,
      external_url: parsed.data.external_url ?? null,
      position:     parsed.data.position ?? 0,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    return NextResponse.json({ error: `Create failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ item: data }, { status: 201 })
}

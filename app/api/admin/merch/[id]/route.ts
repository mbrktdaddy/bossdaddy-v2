import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const MerchPatchSchema = z.object({
  slug:         z.string().min(2).max(80).regex(/^[a-z0-9-]+$/).optional(),
  name:         z.string().min(2).max(160).optional(),
  description:  z.string().max(2000).optional().nullable(),
  price_cents:  z.number().int().nonnegative().nullable().optional(),
  image_url:    z.string().url().max(2048).optional().nullable(),
  category:     z.enum(['apparel', 'drinkware', 'accessories', 'stickers', 'other']).nullable().optional(),
  status:       z.enum(['concept', 'coming_soon', 'available', 'sold_out', 'discontinued']).optional(),
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  const body = await request.json().catch(() => null)
  const parsed = MerchPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('merch')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ item: data })
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  const admin = createAdminClient()
  const { error } = await admin.from('merch').delete().eq('id', id)
  if (error) return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 })
  return NextResponse.json({ success: true })
}

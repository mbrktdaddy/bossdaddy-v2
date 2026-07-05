import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { updateMerchDesign, deleteMerchDesign } from '@/lib/merch/designs-store'

export const runtime = 'nodejs'

async function requireAdmin() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

const PatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(['draft', 'approved', 'published']).optional(),
  ip_flag: z.enum(['none', 'low', 'review']).optional(),
  ip_note: z.string().max(1000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  product_types: z.array(z.string().max(40)).optional(),
  template_key: z.enum(['statement', 'stacked', 'wordmark', 'logo']).optional(),
  template_config: z
    .object({
      colorway: z.enum(['dark', 'light']).optional(),
      blank: z.enum(['tee', 'hat', 'mug']).optional(),
    })
    .optional(),
  content: z
    .object({
      text: z.string().min(1).max(200),
      subline: z.string().max(200).optional().default(''),
      angle: z.string().max(500).optional().default(''),
      best_for: z.string().max(20).optional().default('any'),
    })
    .optional(),
})

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  const body = await request.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const item = await updateMerchDesign(id, parsed.data)
    return NextResponse.json({ item })
  } catch (err) {
    return NextResponse.json({ error: `Update failed: ${(err as Error).message}` }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  try {
    await deleteMerchDesign(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: `Delete failed: ${(err as Error).message}` }, { status: 500 })
  }
}

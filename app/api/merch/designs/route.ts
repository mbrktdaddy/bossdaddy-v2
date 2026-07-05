import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { listMerchDesigns, insertMerchDesign } from '@/lib/merch/designs-store'

export const runtime = 'nodejs'

async function requireAdmin() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

// Saving an operator-approved saying as a draft design candidate.
const SaveSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.object({
    text: z.string().min(1).max(200),
    subline: z.string().max(200).optional().default(''),
    angle: z.string().max(500).optional().default(''),
    best_for: z.string().max(20).optional().default('any'),
  }),
  theme: z.string().max(500).optional().nullable(),
  ip_flag: z.enum(['none', 'low', 'review']).optional().default('none'),
  ip_note: z.string().max(1000).optional().nullable(),
})

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  try {
    const items = await listMerchDesigns()
    return NextResponse.json({ items })
  } catch (err) {
    return NextResponse.json({ error: `List failed: ${(err as Error).message}` }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const body = await request.json().catch(() => null)
  const parsed = SaveSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const item = await insertMerchDesign({
      design_type: 'saying',
      title: parsed.data.title,
      content: parsed.data.content,
      theme: parsed.data.theme ?? null,
      ip_flag: parsed.data.ip_flag,
      ip_note: parsed.data.ip_note ?? null,
      status: 'approved', // operator explicitly approved it by saving
    })
    return NextResponse.json({ item }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: `Save failed: ${(err as Error).message}` }, { status: 500 })
  }
}

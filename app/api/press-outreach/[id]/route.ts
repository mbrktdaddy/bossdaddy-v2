import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/auth-cache'
import type { Database } from '@/lib/supabase/database.types'
import { z } from 'zod'

type PressOutreachUpdate = Database['public']['Tables']['press_outreach']['Update']

const Schema = z.object({
  status:       z.enum(['draft', 'sent', 'responded', 'no_response', 'follow_up']).optional(),
  notes:        z.string().optional(),
  responded_at: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin()
  const { id } = await params

  const raw = await request.json()
  const parsed = Schema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const update: PressOutreachUpdate = { ...parsed.data }
  if (parsed.data.status === 'responded' && !parsed.data.responded_at) {
    update.responded_at = new Date().toISOString()
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('press_outreach')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireAdmin()
  const { id } = await params

  const admin = createAdminClient()
  const { error } = await admin
    .from('press_outreach')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

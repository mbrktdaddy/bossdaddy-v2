import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/auth-cache'
import { z } from 'zod'

const Body = z.object({ is_top_pick: z.boolean() })

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()

  if (parsed.data.is_top_pick) {
    const { error: clearErr } = await admin
      .from('reviews')
      .update({ is_top_pick: false })
      .neq('id', id)
      .eq('is_top_pick', true)
    if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 })
  }

  const { error } = await admin.from('reviews').update({ is_top_pick: parsed.data.is_top_pick }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/gear')

  return NextResponse.json({ success: true, is_top_pick: parsed.data.is_top_pick })
}

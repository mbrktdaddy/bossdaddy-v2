import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

// POST /api/admin/reports — admin only, update an abuse_report's status.
//
// abuse_reports is admin-only (RLS keeps is_admin read), but the write goes
// through the service-role client so no policy-level admin write is required.
// Acting on the offender (suspend/ban) is handled by the existing
// /api/admin/users/moderate route, reused via <ModerationActions> on the page.

const Schema = z.object({
  reportId: z.string().uuid(),
  status:   z.enum(['open', 'reviewed', 'dismissed']),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('abuse_reports')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.reportId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

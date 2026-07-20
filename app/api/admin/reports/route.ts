import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/auth-cache'
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
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

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

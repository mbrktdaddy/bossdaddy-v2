import { NextResponse, type NextRequest, after } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { prewarmOgForPaths } from '@/lib/og/prewarm'
import { z } from 'zod'

const BulkSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'delete']),
  ids:    z.array(z.string().uuid()).min(1).max(100),
})

// POST /api/guides/bulk — admin-only batch action on multiple guides
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = BulkSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })

  const { action, ids } = parsed.data
  const admin = createAdminClient()

  let affected = 0
  const now = new Date().toISOString()

  if (action === 'publish') {
    const { data, count, error } = await admin
      .from('guides')
      .update({ status: 'approved', published_at: now }, { count: 'exact' })
      .in('id', ids)
      .select('slug')
    if (error) return NextResponse.json({ error: `Publish failed: ${error.message}` }, { status: 500 })
    affected = count ?? 0
    // Pre-warm each newly-live guide's OG image so the first social scrape hits
    // a warm CDN cache instead of a cold ~2s MISS (X can time out + cache blank).
    const paths = (data ?? []).map((g) => g.slug).filter(Boolean).map((s) => `/guides/${s}`)
    if (paths.length) after(() => prewarmOgForPaths(paths))
  } else if (action === 'unpublish') {
    const { count, error } = await admin
      .from('guides')
      .update({ status: 'draft', published_at: null }, { count: 'exact' })
      .in('id', ids)
    if (error) return NextResponse.json({ error: `Unpublish failed: ${error.message}` }, { status: 500 })
    affected = count ?? 0
  } else {
    const { count, error } = await admin
      .from('guides')
      .delete({ count: 'exact' })
      .in('id', ids)
    if (error) return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 })
    affected = count ?? 0
  }

  revalidatePath('/dashboard/guides')
  revalidatePath('/guides')
  revalidatePath('/')

  return NextResponse.json({ success: true, affected, action })
}

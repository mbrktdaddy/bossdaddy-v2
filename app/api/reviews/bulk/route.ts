import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const BulkSchema = z.object({
  action: z.enum(['publish', 'unpublish', 'delete']),
  ids:    z.array(z.string().uuid()).min(1).max(100),
})

// POST /api/reviews/bulk — admin-only batch action on multiple reviews
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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
    const { count, error } = await admin
      .from('reviews')
      .update({ status: 'approved', published_at: now }, { count: 'exact' })
      .in('id', ids)
    if (error) return NextResponse.json({ error: `Publish failed: ${error.message}` }, { status: 500 })
    affected = count ?? 0
  } else if (action === 'unpublish') {
    const { count, error } = await admin
      .from('reviews')
      .update({ status: 'draft', published_at: null }, { count: 'exact' })
      .in('id', ids)
    if (error) return NextResponse.json({ error: `Unpublish failed: ${error.message}` }, { status: 500 })
    affected = count ?? 0
  } else {
    const { count, error } = await admin
      .from('reviews')
      .delete({ count: 'exact' })
      .in('id', ids)
    if (error) return NextResponse.json({ error: `Delete failed: ${error.message}` }, { status: 500 })
    affected = count ?? 0
  }

  revalidatePath('/dashboard/reviews')
  revalidatePath('/reviews')
  revalidatePath('/')

  return NextResponse.json({ success: true, affected, action })
}

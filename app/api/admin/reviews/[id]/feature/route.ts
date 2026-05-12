import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/admin/reviews/[id]/feature
// Body: { featured: boolean }
// Admin-only. Toggles homepage-hero feature flag. When setting to true, also
// clears the flag on every other review so there is always at most one
// featured review at a time.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json().catch(() => null)
  const featured = typeof body?.featured === 'boolean' ? body.featured : null
  if (featured === null) {
    return NextResponse.json({ error: 'Missing or invalid `featured` boolean' }, { status: 400 })
  }

  const admin = createAdminClient()

  if (featured) {
    // Clear any other currently-featured reviews first so there's only one hero.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any)
      .from('reviews')
      .update({ featured: false })
      .eq('featured', true)
      .neq('id', id)
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('reviews')
    .update({ featured })
    .eq('id', id)

  if (error) {
    console.error('PATCH /api/admin/reviews/:id/feature failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ featured })
}

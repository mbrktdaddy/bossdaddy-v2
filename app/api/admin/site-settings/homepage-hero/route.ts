import { NextResponse, type NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

// Body shape: either explicit type+id, or both null to clear the override
// and let the homepage fall back to reviews.featured / algorithmic.
const Body = z.union([
  z.object({
    homepage_hero_type: z.enum(['review', 'guide']),
    homepage_hero_id:   z.string().uuid(),
  }),
  z.object({
    homepage_hero_type: z.null(),
    homepage_hero_id:   z.null(),
  }),
])

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const gate = await requireAdmin(supabase)
  if ('error' in gate) return gate.error

  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify the target content exists when setting (not clearing) so the
  // homepage doesn't end up pointing at a deleted/hidden row.
  if (parsed.data.homepage_hero_type !== null) {
    const table = parsed.data.homepage_hero_type === 'review' ? 'reviews' : 'guides'
    const { data: target } = await admin
      .from(table)
      .select('id, status, is_visible')
      .eq('id', parsed.data.homepage_hero_id)
      .single()
    if (!target) {
      return NextResponse.json({ error: 'Target content not found' }, { status: 404 })
    }
    if (target.status !== 'approved' || !target.is_visible) {
      return NextResponse.json(
        { error: 'Only approved + visible content can be set as the homepage hero' },
        { status: 422 }
      )
    }
  }

  const { error } = await admin
    .from('site_settings')
    .update({
      homepage_hero_type: parsed.data.homepage_hero_type,
      homepage_hero_id:   parsed.data.homepage_hero_id,
      updated_at:         new Date().toISOString(),
    })
    .eq('id', 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')

  return NextResponse.json({
    success: true,
    homepage_hero_type: parsed.data.homepage_hero_type,
    homepage_hero_id:   parsed.data.homepage_hero_id,
  })
}

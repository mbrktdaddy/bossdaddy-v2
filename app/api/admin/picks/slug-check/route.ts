import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/picks/slug-check?slug=foo[&exclude=<uuid>]
// Returns { exists: boolean, type?: string }. Used by PickForm for friendly
// pre-flight feedback before the editor saves and hits a 409. The `exclude`
// param skips the current collection's own id so editors can keep their slug
// when editing without seeing a false "taken" warning.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const url = new URL(request.url)
  const slug    = (url.searchParams.get('slug') ?? '').trim().toLowerCase()
  const exclude = url.searchParams.get('exclude')
  if (slug.length < 2) return NextResponse.json({ exists: false })

  const admin = createAdminClient()
  let q = admin.from('collections').select('id, collection_type').eq('slug', slug).limit(1)
  if (exclude) q = q.neq('id', exclude)
  const { data } = await q

  const hit = (data ?? [])[0]
  if (!hit) return NextResponse.json({ exists: false })
  return NextResponse.json({ exists: true, type: hit.collection_type ?? 'general' })
}

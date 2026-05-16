import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/collections/search?q=term
// Admin-only. Powers the TiptapEditor "Insert Collection" dialog. Returns up
// to 12 visible collections matching the query — slug, title, type — so the
// editor can pick by title instead of memorizing slugs.
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
  const admin = createAdminClient()

  // Empty query → return the 12 most-recently-published collections so the
  // dialog has something useful to show without typing first.
  let query = admin
    .from('collections')
    .select('id, slug, title, collection_type')
    .eq('is_visible', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(12)

  if (q.length >= 2) {
    const like = `%${q}%`
    query = query.or(`title.ilike.${like},slug.ilike.${like},description.ilike.${like}`)
  }

  const { data } = await query
  return NextResponse.json({ collections: data ?? [] })
}

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/admin/search?q=term — admin-only cross-content search
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const q = (new URL(request.url).searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ articles: [], reviews: [], media: [] })

  const admin = createAdminClient()
  const like = `%${q}%`

  const [{ data: articles }, { data: reviews }, { data: media }] = await Promise.all([
    admin
      .from('guides')
      .select('id, title, slug, status, category')
      .or(`title.ilike.${like},excerpt.ilike.${like}`)
      .order('updated_at', { ascending: false })
      .limit(8),
    admin
      .from('reviews')
      .select('id, title, slug, status, category, product_name')
      .or(`title.ilike.${like},product_name.ilike.${like},excerpt.ilike.${like}`)
      .order('updated_at', { ascending: false })
      .limit(8),
    admin
      .from('media_assets')
      .select('id, url, filename, alt_text')
      .or(`filename.ilike.${like},alt_text.ilike.${like}`)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  return NextResponse.json({
    articles: articles ?? [],
    reviews:  reviews  ?? [],
    media:    media    ?? [],
  })
}

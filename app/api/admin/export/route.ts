import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 60

// GET /api/admin/export — admin-only full content backup as JSON
export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  const [{ data: articles }, { data: reviews }, { data: media }, { data: comments }] = await Promise.all([
    admin.from('articles').select('*').order('created_at', { ascending: true }),
    admin.from('reviews').select('*').order('created_at', { ascending: true }),
    admin.from('media_assets').select('*').order('created_at', { ascending: true }),
    admin.from('comments').select('*').order('created_at', { ascending: true }),
  ])

  const bundle = {
    version:     1,
    exported_at: new Date().toISOString(),
    exported_by: user.email ?? user.id,
    counts: {
      articles: articles?.length ?? 0,
      reviews:  reviews?.length  ?? 0,
      media:    media?.length    ?? 0,
      comments: comments?.length ?? 0,
    },
    articles: articles ?? [],
    reviews:  reviews  ?? [],
    media:    media    ?? [],
    comments: comments ?? [],
  }

  const filename = `bossdaddy-backup-${new Date().toISOString().slice(0, 10)}.json`

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

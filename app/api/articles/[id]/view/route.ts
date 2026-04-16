import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST /api/articles/[id]/view — atomic view count increment
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const admin = createAdminClient()
  await admin.rpc('increment_article_views', { row_id: id })
  return NextResponse.json({ ok: true })
}

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

// POST /api/guides/[id]/view — atomic view count increment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon'
  const { id } = await params

  const { success } = await checkRateLimit(`view:${ip}:${id}`, 'view')
  if (!success) return NextResponse.json({ ok: true }) // silent — no error exposed

  const supabase = await createClient()
  await supabase.rpc('increment_article_views', { row_id: id })
  return NextResponse.json({ ok: true })
}

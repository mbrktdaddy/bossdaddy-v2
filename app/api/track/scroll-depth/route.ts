import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const Schema = z.object({
  content_type: z.enum(['article', 'review']),
  content_id:   z.string().uuid(),
  milestone:    z.union([z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
})

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.rpc('increment_scroll_depth', {
    p_content_type: parsed.data.content_type,
    p_content_id:   parsed.data.content_id,
    p_milestone:    parsed.data.milestone,
  })

  if (error) {
    console.error('scroll-depth RPC error:', error)
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

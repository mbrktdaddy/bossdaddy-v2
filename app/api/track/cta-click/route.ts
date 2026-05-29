import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const Schema = z.object({
  content_type:    z.enum(['guide', 'review']),
  content_id:      z.string().uuid(),
  product_slug:    z.string().max(80).optional().nullable(),
  destination_url: z.string().url().max(2048),
})

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip') || 'unknown'
  const { success } = await checkRateLimit(`cta:${ip}`, 'track')
  if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const body = await request.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // zod .url() can admit non-http schemes; only persist real https destinations.
  if (!parsed.data.destination_url.startsWith('https://')) {
    return NextResponse.json({ error: 'Invalid destination' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('affiliate_clicks').insert({
    content_type:    parsed.data.content_type,
    content_id:      parsed.data.content_id,
    product_slug:    parsed.data.product_slug ?? null,
    destination_url: parsed.data.destination_url,
  })

  if (error) {
    console.error('cta-click insert error:', error)
    return NextResponse.json({ error: 'Tracking failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

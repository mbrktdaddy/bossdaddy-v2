import { NextResponse, type NextRequest } from 'next/server'
import { createHmac } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

// Sanity → Supabase content sync webhook
// Triggered when a review is published/updated in Sanity Studio
export async function POST(request: NextRequest) {
  const secret = process.env.SANITY_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  // Verify HMAC-SHA256 signature
  const signature = request.headers.get('sanity-webhook-signature') ?? ''
  const rawBody = await request.text()
  const expectedSig = createHmac('sha256', secret).update(rawBody).digest('hex')

  if (signature !== `sha256=${expectedSig}`) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  let payload: { _id: string; _type: string; slug?: { current: string }; supabaseId?: string }
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (payload._type !== 'review' || !payload.supabaseId) {
    return NextResponse.json({ skipped: true })
  }

  // Update sanity_id on matching Supabase review
  const supabase = createAdminClient()
  await supabase
    .from('reviews')
    .update({ sanity_id: payload._id })
    .eq('id', payload.supabaseId)

  return NextResponse.json({ success: true })
}

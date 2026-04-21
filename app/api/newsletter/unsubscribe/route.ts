import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const Schema = z.object({ email: z.string().email() })

export async function POST(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bossdaddylife.com'

  let email = ''
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}))
    email = body.email ?? ''
  } else {
    const body = await request.formData().catch(() => null)
    email = body?.get('email')?.toString() ?? ''
  }

  const parsed = Schema.safeParse({ email })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const supabase = createAdminClient()
  await supabase
    .from('newsletter_subscribers')
    .delete()
    .eq('email', parsed.data.email)

  const isForm = !contentType.includes('application/json')
  return isForm
    ? NextResponse.redirect(new URL('/?newsletter=unsubscribed', siteUrl))
    : NextResponse.json({ success: true })
}

// GET /api/newsletter/unsubscribe?email=xxx — one-click from email links
export async function GET(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bossdaddylife.com'
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email') ?? ''

  const parsed = Schema.safeParse({ email })
  if (!parsed.success) {
    return NextResponse.redirect(new URL('/?newsletter=error', siteUrl))
  }

  const supabase = createAdminClient()
  await supabase
    .from('newsletter_subscribers')
    .delete()
    .eq('email', parsed.data.email)

  return NextResponse.redirect(new URL('/?newsletter=unsubscribed', siteUrl))
}

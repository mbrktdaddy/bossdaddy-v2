import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { WelcomeEmail } from '@/emails/WelcomeEmail'
import { z } from 'zod'
import * as React from 'react'

const Schema = z.object({ email: z.string().email() })

export async function POST(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://bossdaddylife.com'

  // Handle both JSON and form submissions
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
    const isForm = !contentType.includes('application/json')
    return isForm
      ? NextResponse.redirect(new URL('/?newsletter=error', request.url))
      : NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Upsert subscriber
  const { error: dbError } = await supabase
    .from('newsletter_subscribers')
    .upsert({ email: parsed.data.email, confirmed: true }, { onConflict: 'email' })

  if (dbError) {
    console.error('Newsletter DB error:', dbError)
  }

  // Send welcome email via Resend
  try {
    const resend = getResend()
    await resend.emails.send({
      from: FROM_EMAIL,
      to: parsed.data.email,
      subject: "You're in, Boss. Welcome to the crew. 🔥",
      react: React.createElement(WelcomeEmail, { email: parsed.data.email }),
    })
  } catch (err) {
    // Don't fail the signup if email sending fails — subscriber is already saved
    console.error('Resend error:', err)
  }

  const isForm = !contentType.includes('application/json')
  return isForm
    ? NextResponse.redirect(new URL('/?newsletter=success', siteUrl))
    : NextResponse.json({ success: true })
}

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { WelcomeEmail } from '@/emails/WelcomeEmail'
import { checkRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import * as React from 'react'

const Schema = z.object({
  email: z.string().email(),
  interests: z.array(z.string().max(40)).max(10).optional(),
})

export async function POST(request: NextRequest) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous'

  const { success } = await checkRateLimit(`newsletter:${ip}`, 'newsletter')
  if (!success) {
    const contentType = request.headers.get('content-type') ?? ''
    return contentType.includes('application/json')
      ? NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 })
      : NextResponse.redirect(new URL('/?newsletter=error', siteUrl))
  }

  // Handle both JSON and form submissions
  let email = ''
  let interests: string[] = []
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}))
    email = body.email ?? ''
    if (Array.isArray(body.interests)) interests = body.interests
  } else {
    const body = await request.formData().catch(() => null)
    email = body?.get('email')?.toString() ?? ''
    const intRaw = body?.get('interests')?.toString()
    if (intRaw) interests = intRaw.split(',').map((s) => s.trim()).filter(Boolean)
  }

  const parsed = Schema.safeParse({ email, interests })
  if (!parsed.success) {
    const isForm = !contentType.includes('application/json')
    return isForm
      ? NextResponse.redirect(new URL('/?newsletter=error', request.url))
      : NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Upsert subscriber. Interests are merged with the existing array
  // server-side (via a Postgres array union) so re-signing up doesn't
  // overwrite previous opt-ins. We also fetch `confirmed` so we know
  // whether to suppress the welcome email on repeat signups.
  const newInterests = parsed.data.interests ?? []
  const { data: existing } = await supabase
    .from('newsletter_subscribers')
    .select('interests, confirmed')
    .eq('email', parsed.data.email)
    .maybeSingle()

  const alreadySubscribed = existing?.confirmed === true

  const mergedInterests = Array.from(
    new Set([...(existing?.interests ?? []), ...newInterests]),
  )

  const { error: dbError } = await supabase
    .from('newsletter_subscribers')
    .upsert(
      { email: parsed.data.email, confirmed: true, interests: mergedInterests },
      { onConflict: 'email' },
    )

  if (dbError) {
    console.error('Newsletter DB error:', dbError)
  }

  // Skip welcome email on repeat signups — see app/actions/newsletter.ts
  // for the same gate and the "why" comment.
  if (!alreadySubscribed) {
    try {
      const resend = getResend()
      await resend.emails.send({
        from: FROM_EMAIL,
        to: parsed.data.email,
        subject: "You're in, Boss. Welcome to the crew. 🔥",
        react: React.createElement(WelcomeEmail, { email: parsed.data.email, siteUrl }),
      })
    } catch (err) {
      // Don't fail the signup if email sending fails — subscriber is already saved
      console.error('Resend error:', err)
    }
  }

  const isForm = !contentType.includes('application/json')
  const successQuery = alreadySubscribed ? 'already-subscribed' : 'success'
  return isForm
    ? NextResponse.redirect(new URL(`/?newsletter=${successQuery}`, siteUrl))
    : NextResponse.json({ success: true, alreadySubscribed })
}

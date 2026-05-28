import { NextResponse, type NextRequest } from 'next/server'
import * as React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { SundayMomentsEmail } from '@/emails/SundayMomentsEmail'

export const maxDuration = 60

type SubRow = {
  id:                string
  email:             string
  kid_profile_id:    string | null
  unsubscribe_token: string
  kid_profiles: { name: string | null } | null
}

// Weekly Sunday-night nudge. Sends one quiet email per opt-in subscriber
// with a link back to the dashboard to capture a moment.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — sunday-moments refusing to run')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 })
  }
  const authHeader = request.headers.get('authorization')
  const qSecret    = new URL(request.url).searchParams.get('secret')
  const isVercel   = authHeader === `Bearer ${secret}`
  const isManual   = qSecret === secret
  if (!isVercel && !isManual) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'

  const { data: subsRaw, error } = await admin.from('tool_email_subscriptions')
    .select('id, email, kid_profile_id, unsubscribe_token, kid_profiles ( name )')
    .eq('kind', 'sunday_moments')

  if (error) {
    console.error('sunday-moments: failed to load subs:', error.message)
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  const subs: SubRow[] = (subsRaw ?? []) as SubRow[]

  let sent = 0
  let skipped = 0

  if (subs.length > 0 && process.env.RESEND_API_KEY) {
    const resend = getResend()
    for (const sub of subs) {
      const kidName = sub.kid_profiles?.name ?? null
      const captureUrl = `${siteUrl}/dashboard`
      const unsubscribeUrl = `${siteUrl}/tools/email-unsubscribe?token=${sub.unsubscribe_token}`

      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to:   sub.email,
          subject: kidName
            ? `How was this weekend with ${kidName}?`
            : 'How was this weekend?',
          react: React.createElement(SundayMomentsEmail, {
            kidName,
            captureUrl,
            unsubscribeUrl,
            email: sub.email,
            siteUrl,
          }),
        })
        sent++
      } catch (err) {
        console.error('sunday-moments: send failed', sub.email, err)
        skipped++
      }
    }
  }

  return NextResponse.json({
    success: true,
    total:   subs.length,
    sent,
    skipped,
    sentAt:  new Date().toISOString(),
  })
}

import { NextResponse, type NextRequest } from 'next/server'
import * as React from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getResend, FROM_EMAIL } from '@/lib/resend'
import { WeekendsCheckinEmail } from '@/emails/WeekendsCheckinEmail'
import { milestoneDate, weeksUntil } from '@/lib/dad-tools/calc'

export const maxDuration = 30

type SubRow = {
  id:                 string
  email:              string
  anchor_date:        string | null
  kid_profile_id:     string | null
  unsubscribe_token:  string
  kid_profiles: { birthdate: string; name: string | null } | null
}

// Daily cron — finds yearly_weekends_checkin opt-ins whose anniversary lands
// today and sends each one a one-email update with the new number.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — yearly-weekends-checkin refusing to run')
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

  const today = new Date()
  const todayMMDD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  // 364-day window — covers leap-year edge cases without missing a year.
  const oneYearAgo = new Date(today.getTime() - 364 * 86_400_000).toISOString().slice(0, 10)

  const { data: subsRaw, error } = await admin.from('tool_email_subscriptions')
    .select('id, email, anchor_date, kid_profile_id, unsubscribe_token, kid_profiles ( birthdate, name )')
    .eq('kind', 'yearly_weekends_checkin')
    .lte('anchor_date', oneYearAgo)
    .not('kid_profile_id', 'is', null)

  if (error) {
    console.error('yearly-weekends-checkin: failed to load subs:', error.message)
    return NextResponse.json({ error: 'load_failed' }, { status: 500 })
  }

  const subs: SubRow[] = (subsRaw ?? []) as SubRow[]
  const due = subs.filter((s) => {
    if (!s.anchor_date) return false
    // anchor_date is a stable 'YYYY-MM-DD' string. Parsing through Date()
    // would treat it as UTC midnight and then .getMonth/.getDate return
    // LOCAL time of that UTC moment — a real off-by-one around midnight in
    // any non-UTC region. Split the string directly to keep the comparison
    // pure MM-DD with no timezone in the loop.
    const parts = s.anchor_date.split('-')
    if (parts.length !== 3) return false
    const mmdd = `${parts[1]}-${parts[2]}`
    return mmdd === todayMMDD
  })

  let sent = 0
  let skipped = 0

  if (due.length > 0 && process.env.RESEND_API_KEY) {
    const resend = getResend()
    for (const sub of due) {
      const kid = sub.kid_profiles
      if (!kid) { skipped++; continue }
      const target = milestoneDate('until_18', kid.birthdate)
      if (!target) { skipped++; continue }
      const N = weeksUntil(target)

      // Approximate previous weekends — 52 more than now, since one year passed.
      // This will be exact within ~1 week.
      const previousWeekends = N + 52

      const shareUrl = `${siteUrl}/tools/weekends-until`
      const unsubscribeUrl = `${siteUrl}/tools/email-unsubscribe?token=${sub.unsubscribe_token}`

      try {
        await resend.emails.send({
          from: FROM_EMAIL,
          to:   sub.email,
          subject: `${N.toLocaleString()} weekends. Your yearly check-in.`,
          react: React.createElement(WeekendsCheckinEmail, {
            kidName:           kid.name,
            weekendsRemaining: N,
            previousWeekends,
            shareUrl,
            unsubscribeUrl,
            email:             sub.email,
            siteUrl,
          }),
        })
        sent++
      } catch (err) {
        console.error('yearly-weekends-checkin: send failed', sub.email, err)
        skipped++
      }
    }
  }

  return NextResponse.json({
    success: true,
    due:     due.length,
    sent,
    skipped,
    checkedAt: today.toISOString(),
  })
}

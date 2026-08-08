import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runGoalsSweep } from '@/lib/goals/sweep'

// Every 15 minutes: materialize the rolling occurrence window, send what's due
// through the idempotent outbox, age out what lapsed. All logic lives in
// lib/goals/sweep.ts — this file is the gate and the JSON envelope.
//
// */15 rather than hourly because hourly cannot express an 8:30 am reminder.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — goals-sweep refusing to run')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 })
  }
  // Vercel Cron sends the Bearer header; the query form is for manual testing.
  // A 403 here means the secret IS set and the value didn't match — usually a
  // URL-mangled character, so prefer the header when testing by hand.
  const authHeader = request.headers.get('authorization')
  const qSecret = new URL(request.url).searchParams.get('secret')
  if (authHeader !== `Bearer ${secret}` && qSecret !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.bossdaddylife.com'
  const now = new Date()

  try {
    const report = await runGoalsSweep(admin, now, siteUrl)
    // Errors are reported, not thrown: one malformed schedule must not stop the
    // tick for everyone else, but it also must not disappear.
    if (report.errors.length) {
      console.error('goals-sweep completed with errors', report.errors.slice(0, 10))
    }
    return NextResponse.json({ success: true, ranAt: now.toISOString(), ...report })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('goals-sweep threw', message)
    return NextResponse.json({ error: 'sweep_failed', message }, { status: 500 })
  }
}

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { runRadar, pickRadarUserId } from '@/lib/social/radar'

// X Studio Phase 4 — daily radar cron (SENSE layer).
// web_search + Reddit + Google autocomplete → social_signals.
//
// BUDGET GUARD (non-negotiable): two layers bound autonomous spend so the cron
// can't blow the Anthropic $200 cap —
//   1. daily run cap via lib/rate-limit.ts `radar` (here), and
//   2. per-run web_search `max_uses` + signal caps (RADAR_CAPS, in the engine).

// web_search can run several rounds; keep full headroom under the Pro cap.
export const maxDuration = 300

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — radar refusing to run')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 })
  }
  const authHeader = request.headers.get('authorization')
  const qSecret    = new URL(request.url).searchParams.get('secret')
  const isVercel   = authHeader === `Bearer ${secret}`
  const isManual   = qSecret === secret
  if (!isVercel && !isManual) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Budget guard layer 1: hard daily run cap. Even a misfiring schedule or a
  // burst of manual triggers can't run the (paid) web_search radar more than
  // twice in 24h.
  const { success } = await checkRateLimit('radar:global', 'radar')
  if (!success) {
    return NextResponse.json({ skipped: true, reason: 'daily radar budget reached' }, { status: 200 })
  }

  const admin = createAdminClient()
  const userId = await pickRadarUserId(admin)
  if (!userId) {
    console.error('radar: no admin user to attribute signals to')
    return NextResponse.json({ error: 'no_admin' }, { status: 500 })
  }

  const result = await runRadar(admin, userId)
  if (result.errors.length) console.warn('radar partial errors:', result.errors)

  return NextResponse.json({
    success: true,
    inserted: result.inserted,
    bySource: result.bySource,
    errors: result.errors,
    ranAt: new Date().toISOString(),
  })
}

import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { refreshStaleEmbeddings } from '@/lib/boss/embedContent'

export const maxDuration = 60

// Keeps the Boss's hybrid search fresh: embeds every approved+visible review/guide
// whose embedding is null — new rows, or rows the migration-125 staleness trigger
// nulled on a content edit. Also serves as the one-time backfill: on the first run
// after the migration, every approved row has a null embedding, so a single hit
// embeds the whole catalog.
//
// Secured by CRON_SECRET — Vercel Cron sends `Authorization: Bearer $CRON_SECRET`;
// a manual/backfill hit can pass `?secret=$CRON_SECRET`. Fails closed if unset.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('CRON_SECRET is not set — embed-content cron refusing to run')
    return NextResponse.json({ error: 'Misconfigured' }, { status: 503 })
  }

  const authHeader = request.headers.get('authorization')
  const qSecret = new URL(request.url).searchParams.get('secret')
  if (authHeader !== `Bearer ${secret}` && qSecret !== secret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const admin = createAdminClient()
    const result = await refreshStaleEmbeddings(admin)
    return NextResponse.json({ success: true, ...result, at: new Date().toISOString() })
  } catch (err) {
    console.error('embed-content cron failed:', err)
    return NextResponse.json({ error: 'Embedding refresh failed' }, { status: 500 })
  }
}

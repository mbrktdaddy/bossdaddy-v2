import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { syncPrintfulToMerch } from '@/lib/merch/sync'

export const runtime = 'nodejs'
export const maxDuration = 60

async function requireAdmin() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

export async function POST() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const rl = await checkRateLimit(auth.user.id, 'merch-publish')
  if (!rl.success) return NextResponse.json({ error: 'Rate limit reached. Try again shortly.' }, { status: 429 })

  try {
    const result = await syncPrintfulToMerch()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[merch/sync] failed', err)
    return NextResponse.json({ error: `Sync failed: ${(err as Error).message}` }, { status: 502 })
  }
}

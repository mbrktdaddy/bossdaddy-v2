import { NextResponse, type NextRequest } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'

export const maxDuration = 60

// Admin trigger that proxies to the cron route with the secret.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const secret = process.env.CRON_SECRET
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 503 })

  const url = new URL(request.url)
  const dry = url.searchParams.get('dry') === '1'

  const target = new URL('/api/cron/newsletter-digest', request.url)
  target.searchParams.set('secret', secret)
  if (dry) target.searchParams.set('dry', '1')

  const res = await fetch(target, { method: 'GET' })
  const json = await res.json().catch(() => ({}))
  return NextResponse.json(json, { status: res.status })
}

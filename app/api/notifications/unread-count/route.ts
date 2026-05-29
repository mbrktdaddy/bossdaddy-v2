// Lightweight unread count for badges (mobile nav, polling fallback).

import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ count: 0 })

  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null)
  return NextResponse.json({ count: count ?? 0 })
}

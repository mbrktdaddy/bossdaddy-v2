import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 3600

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tags')
    .select('slug, label, tag_group, display_order')
    .order('tag_group')
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tags: data })
}

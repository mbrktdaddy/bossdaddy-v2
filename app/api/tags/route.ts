import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 3600

export async function GET() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tags')
    // parent_slug + category_slug (mig 127) drive the pillar -> group -> leaf tree
    // that TagPicker renders via buildTagTree(). Dropping them collapses every
    // topic tag into the cross-cutting bucket.
    .select('slug, label, tag_group, display_order, parent_slug, category_slug')
    .order('tag_group')
    .order('display_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ tags: data })
}

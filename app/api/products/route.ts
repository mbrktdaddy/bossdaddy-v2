import { NextResponse } from 'next/server'
import { createClient, getUserSafe } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Product } from '@/lib/products'

// GET /api/products — list products for use in the dashboard review/article
// editor. Authors and admins can read; the admin CRUD endpoint remains at
// /api/admin/products.
export async function GET() {
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'author'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .select('id, slug, name, asin, store, custom_store_name, affiliate_url, non_affiliate_url, image_url')
    .order('name', { ascending: true })

  if (error) return NextResponse.json({ error: `List failed: ${error.message}` }, { status: 500 })
  return NextResponse.json({ products: (data ?? []) as Pick<Product, 'id' | 'slug' | 'name' | 'asin' | 'store' | 'custom_store_name' | 'affiliate_url' | 'non_affiliate_url' | 'image_url'>[] })
}

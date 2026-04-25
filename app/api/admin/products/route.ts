import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod'

const ProductSchema = z.object({
  slug:              z.string().min(2).max(80).regex(/^[a-z0-9-]+$/, 'lowercase letters, numbers, and hyphens only'),
  name:              z.string().min(2).max(160),
  asin:              z.string().max(20).optional().nullable(),
  store:             z.string().max(40).optional().default('amazon'),
  custom_store_name: z.string().max(80).optional().nullable(),
  affiliate_url:     z.string().url().max(2048).optional().nullable(),
  non_affiliate_url: z.string().url().max(2048).optional().nullable(),
  image_url:         z.string().url().max(2048).optional().nullable(),
})

// GET /api/admin/products — list all products (admin only)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: `List failed: ${error.message}` }, { status: 500 })
  return NextResponse.json({ products: data ?? [] })
}

// POST /api/admin/products — create a product (admin only)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const parsed = ProductSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .insert({
      slug:              parsed.data.slug,
      name:              parsed.data.name,
      asin:              parsed.data.asin ?? null,
      store:             parsed.data.store ?? 'amazon',
      custom_store_name: parsed.data.custom_store_name ?? null,
      affiliate_url:     parsed.data.affiliate_url ?? null,
      non_affiliate_url: parsed.data.non_affiliate_url ?? null,
      image_url:         parsed.data.image_url ?? null,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    return NextResponse.json({ error: `Create failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ product: data }, { status: 201 })
}

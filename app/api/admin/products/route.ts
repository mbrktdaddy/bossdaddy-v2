import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminApi } from '@/lib/auth-cache'
import { ProductCreateSchema } from '@/lib/products/schema'

// GET /api/admin/products — list all products (admin only)
export async function GET() {
  const supabase = await createClient()
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

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
  const gate = await requireAdminApi(supabase)
  if ('error' in gate) return gate.error

  const body = await request.json().catch(() => null)
  const parsed = ProductCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('products')
    .insert({
      slug:              parsed.data.slug,
      name:              parsed.data.name,
      brand:             parsed.data.brand ?? null,
      specs:             parsed.data.specs ?? [],
      asin:              parsed.data.asin ?? null,
      store:             parsed.data.store ?? 'amazon',
      custom_store_name: parsed.data.custom_store_name ?? null,
      affiliate_url:     parsed.data.affiliate_url ?? null,
      non_affiliate_url: parsed.data.non_affiliate_url ?? null,
      image_url:         parsed.data.image_url ?? null,
      description:       parsed.data.description ?? null,
      category:          parsed.data.category ?? null,
      price_cents:       parsed.data.price_cents ?? null,
      status:            parsed.data.status ?? 'considering',
      priority:              parsed.data.priority ?? 0,
      estimated_review_date: parsed.data.estimated_review_date ?? null,
      skip_reason:           parsed.data.skip_reason ?? null,
      source:                'hand',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Slug already in use' }, { status: 409 })
    return NextResponse.json({ error: `Create failed: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ product: data }, { status: 201 })
}

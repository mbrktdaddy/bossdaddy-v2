import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { resolveCart, buildCartCookie } from '@/lib/cart'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  variant_id: z.string().uuid(),
  qty: z.number().int().min(1).max(10).default(1),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { variant_id, qty } = parsed.data
  const admin = createAdminClient()

  const { data: variant } = await admin
    .from('merch_variants').select('id, merch_id, in_stock').eq('id', variant_id).maybeSingle()

  if (!variant) return NextResponse.json({ error: 'Variant not found' }, { status: 404 })
  if (!variant.in_stock) return NextResponse.json({ error: 'Out of stock' }, { status: 409 })

  const cart = await resolveCart()
  if (!cart) return NextResponse.json({ error: 'Could not create cart' }, { status: 500 })

  const { data: existing } = await admin
    .from('cart_items').select('id, qty')
    .eq('cart_id', cart.cartId).eq('variant_id', variant_id).maybeSingle()

  if (existing) {
    await admin.from('cart_items')
      .update({ qty: Math.min(existing.qty + qty, 10) }).eq('id', existing.id)
  } else {
    await admin.from('cart_items').insert({
      cart_id: cart.cartId,
      merch_id: variant.merch_id,
      variant_id,
      qty,
    })
  }

  if (cart.newSessionId) {
    const cookieStore = await cookies()
    cookieStore.set(buildCartCookie(cart.newSessionId))
  }

  return NextResponse.json({ ok: true })
}

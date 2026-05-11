import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { resolveCart } from '@/lib/cart'
import { createAdminClient } from '@/lib/supabase/admin'

const schema = z.object({
  item_id: z.string().uuid(),
  qty: z.number().int().min(0).max(10),
})

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const { item_id, qty } = parsed.data
  const admin = createAdminClient()
  const cart = await resolveCart()
  if (!cart) return NextResponse.json({ error: 'No cart' }, { status: 404 })

  const { data: item } = await admin
    .from('cart_items').select('id').eq('id', item_id).eq('cart_id', cart.cartId).maybeSingle()
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

  if (qty === 0) {
    await admin.from('cart_items').delete().eq('id', item_id)
  } else {
    await admin.from('cart_items').update({ qty }).eq('id', item_id)
  }

  return NextResponse.json({ ok: true })
}

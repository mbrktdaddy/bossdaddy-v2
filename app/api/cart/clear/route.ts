import { NextResponse } from 'next/server'
import { resolveCart } from '@/lib/cart'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE /api/cart/clear
// Removes every item from the current cart. Used by the "Empty cart" button
// on /cart so users can recover from stuck states (e.g., a webhook failed to
// clear the cart after a completed purchase).
export async function DELETE() {
  const cart = await resolveCart()
  if (!cart) return NextResponse.json({ error: 'No cart' }, { status: 404 })

  const admin = createAdminClient()
  await admin.from('cart_items').delete().eq('cart_id', cart.cartId)

  return NextResponse.json({ ok: true })
}

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { resolveCart, getCartItems, buildCartCookie } from '@/lib/cart'

export async function GET() {
  const cart = await resolveCart()
  if (!cart) return NextResponse.json({ items: [], total: 0, count: 0 })

  if (cart.newSessionId) {
    const cookieStore = await cookies()
    cookieStore.set(buildCartCookie(cart.newSessionId))
  }

  const items = await getCartItems(cart.cartId)
  const count = items.reduce((sum, i) => sum + i.qty, 0)
  const total = items.reduce((sum, i) => sum + i.variant.retail_price_cents * i.qty, 0)

  return NextResponse.json({ items, total, count })
}

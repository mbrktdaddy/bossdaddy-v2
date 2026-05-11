import { NextResponse } from 'next/server'
import { resolveCart, getCartItems } from '@/lib/cart'
import { stripe } from '@/lib/stripe'
import { createClient, getUserSafe } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const origin = new URL(request.url).origin

  const cart = await resolveCart()
  if (!cart) return NextResponse.json({ error: 'No cart found' }, { status: 400 })

  const items = await getCartItems(cart.cartId)
  if (items.length === 0) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })

  // Pre-fill customer email if signed in
  const supabase = await createClient()
  const { user } = await getUserSafe(supabase)

  const lineItems = items.map((item) => {
    const variantLabel = [item.variant.color, item.variant.size].filter(Boolean).join(' / ')
    const images: string[] = []
    const imgUrl = item.variant.image_url ?? item.merch.default_image_url ?? (item.merch as { image_url?: string | null }).image_url
    if (imgUrl) images.push(imgUrl)

    return {
      price_data: {
        currency: 'usd',
        unit_amount: item.variant.retail_price_cents,
        product_data: {
          name: item.merch.name,
          ...(variantLabel ? { description: variantLabel } : {}),
          ...(images.length ? { images } : {}),
        },
      },
      quantity: item.qty,
    }
  })

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: lineItems,
    shipping_address_collection: { allowed_countries: ['US'] },
    automatic_tax: { enabled: true },
    ...(user?.email ? { customer_email: user.email } : {}),
    success_url: `${origin}/order/{CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cart`,
    metadata: { cart_id: cart.cartId },
  })

  return NextResponse.json({ url: session.url })
}

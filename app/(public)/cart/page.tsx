import Link from 'next/link'
import { resolveCart, getCartItems } from '@/lib/cart'
import { formatPrice } from '@/lib/merch'
import CartItems from './_components/CartItems'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Your Cart — Boss Daddy Life',
  robots: { index: false },
}

export default async function CartPage() {
  const cart = await resolveCart()
  const items = cart ? await getCartItems(cart.cartId) : []
  const count = items.reduce((s, i) => s + i.qty, 0)
  const subtotal = items.reduce((s, i) => s + i.variant.retail_price_cents * i.qty, 0)

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-8">
        <p className="text-[11px] text-accent-text uppercase tracking-[0.2em] font-bold mb-2">— Boss Daddy Merch</p>
        <h1 className="text-3xl font-black text-prose">Your Cart</h1>
        {count > 0 && (
          <p className="text-prose-faint text-sm mt-1">{count} item{count !== 1 ? 's' : ''} · {formatPrice(subtotal)} subtotal</p>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-surface rounded-2xl p-12 text-center">
          <p className="text-5xl mb-4 opacity-30">🛒</p>
          <p className="text-prose-muted text-lg font-semibold mb-2">Your cart is empty.</p>
          <p className="text-prose-faint text-sm mb-8">Add some gear and come back.</p>
          <Link
            href="/gear"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl transition-colors"
          >
            Browse Gear
          </Link>
        </div>
      ) : (
        <CartItems initialItems={items} initialSubtotal={subtotal} />
      )}
    </div>
  )
}

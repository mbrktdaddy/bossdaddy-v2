import Link from 'next/link'
import { resolveCart, getCartItems } from '@/lib/cart'
import { formatPrice } from '@/lib/merch'
import CartItems from './_components/CartItems'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Metadata } from 'next'
import { buttonVariants } from '@/components/ui/Button'

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
        <EmptyState
          title="Your cart is empty."
          body="Add some gear and come back."
          action={
            <Link
              href="/gear"
              className={buttonVariants({ size: 'lg' })}
            >
              Browse Gear
            </Link>
          }
        />
      ) : (
        <CartItems initialItems={items} initialSubtotal={subtotal} />
      )}
    </div>
  )
}

import Link from 'next/link'
import { resolveCart, getCartItems } from '@/lib/cart'
import { formatPrice } from '@/lib/merch'
import CartItems from './_components/CartItems'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Metadata } from 'next'
import { buttonVariants } from '@/components/ui/Button'
import PageHeader from '@/components/PageHeader'
import { LABELS } from '@/lib/labels'

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
    <div className="max-w-6xl mx-auto px-6 py-10 sm:py-12">
      <PageHeader
        size="compact"
        back={{ href: '/shop', label: LABELS.shop.short }}
        eyebrow="Boss Daddy Merch"
        title="Your Cart"
        deck={count > 0 ? `${count} item${count !== 1 ? 's' : ''} · ${formatPrice(subtotal)} subtotal` : undefined}
        className="mb-8"
      />

      {items.length === 0 ? (
        <EmptyState
          title="Your cart is empty."
          body="Add something from the shop and come back."
          action={
            <Link
              href="/shop"
              className={buttonVariants({ size: 'lg' })}
            >
              Browse the Shop
            </Link>
          }
        />
      ) : (
        <CartItems initialItems={items} initialSubtotal={subtotal} />
      )}
    </div>
  )
}

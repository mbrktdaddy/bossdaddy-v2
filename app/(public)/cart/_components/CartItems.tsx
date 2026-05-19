'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatPrice, getMerchDisplayImage } from '@/lib/merch'
import type { CartItemWithDetails } from '@/lib/merch'
import { dispatchCartUpdated } from '@/lib/cart-events'

interface Props {
  initialItems: CartItemWithDetails[]
  initialSubtotal: number
}

export default function CartItems({ initialItems, initialSubtotal }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initialItems)
  const [subtotal, setSubtotal] = useState(initialSubtotal)
  const [busy, setBusy] = useState<string | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  function recalc(updated: CartItemWithDetails[]) {
    setItems(updated)
    setSubtotal(updated.reduce((s, i) => s + i.variant.retail_price_cents * i.qty, 0))
  }

  async function updateQty(itemId: string, qty: number) {
    setBusy(itemId)
    try {
      const res = await fetch('/api/cart/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, qty }),
      })
      if (res.ok) {
        recalc(qty === 0
          ? items.filter(i => i.id !== itemId)
          : items.map(i => i.id === itemId ? { ...i, qty } : i))
        dispatchCartUpdated()
        router.refresh()
      }
    } finally {
      setBusy(null)
    }
  }

  async function handleCheckout() {
    setCheckingOut(true)
    setCheckoutError(null)
    try {
      const res = await fetch('/api/checkout', { method: 'POST' })
      const json = await res.json()
      if (json.url) {
        window.location.href = json.url
      } else {
        setCheckoutError(json.error ?? 'Checkout failed. Please try again.')
      }
    } catch {
      setCheckoutError('Network error. Please try again.')
    } finally {
      setCheckingOut(false)
    }
  }

  async function emptyCart() {
    if (!confirm('Remove all items from your cart?')) return
    setBusy('__all__')
    try {
      const res = await fetch('/api/cart/clear', { method: 'DELETE' })
      if (res.ok) {
        recalc([])
        dispatchCartUpdated()
        router.refresh()
      }
    } finally {
      setBusy(null)
    }
  }

  async function removeItem(itemId: string) {
    setBusy(itemId)
    try {
      const res = await fetch('/api/cart/remove', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId }),
      })
      if (res.ok) {
        recalc(items.filter(i => i.id !== itemId))
        dispatchCartUpdated()
        router.refresh()
      }
    } finally {
      setBusy(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-surface rounded-2xl p-12 text-center">
        <p className="text-prose-muted text-lg font-semibold mb-6">Your cart is empty.</p>
        <Link href="/gear" className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-hover text-white font-bold rounded-xl transition-colors">
          Browse Gear
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Line items */}
      <div className="flex flex-col gap-4">
        {items.map(item => {
          const imageUrl = item.variant.image_url
            ?? getMerchDisplayImage(item.merch as Parameters<typeof getMerchDisplayImage>[0])
          const variantLabel = [item.variant.color, item.variant.size].filter(Boolean).join(' / ')
          const isBusy = busy === item.id

          return (
            <div
              key={item.id}
              className={`flex gap-4 bg-surface rounded-2xl p-4 transition-opacity ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Link href={`/gear/${item.merch.slug}`} className="shrink-0">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-surface-raised">
                  {imageUrl ? (
                    <Image src={imageUrl} alt={item.merch.name} fill className="object-cover" sizes="80px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl opacity-20">👕</div>
                  )}
                </div>
              </Link>

              <div className="flex-1 min-w-0">
                <Link href={`/gear/${item.merch.slug}`} className="font-semibold text-white hover:text-accent-text-soft transition-colors line-clamp-2 leading-snug">
                  {item.merch.name}
                </Link>
                {variantLabel && <p className="text-xs text-prose-faint mt-0.5">{variantLabel}</p>}
                <p className="text-accent-text-soft font-bold text-sm mt-1.5">{formatPrice(item.variant.retail_price_cents)}</p>
              </div>

              <div className="flex flex-col items-end justify-between shrink-0">
                <div className="flex items-center gap-1 bg-surface-raised rounded-xl px-2 py-1">
                  <button
                    onClick={() => updateQty(item.id, item.qty - 1)}
                    className="w-7 h-7 flex items-center justify-center text-prose-muted hover:text-white transition-colors"
                    aria-label="Decrease quantity"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-sm font-bold text-white tabular-nums">{item.qty}</span>
                  <button
                    onClick={() => updateQty(item.id, item.qty + 1)}
                    disabled={item.qty >= 10}
                    className="w-7 h-7 flex items-center justify-center text-prose-muted hover:text-white disabled:opacity-30 transition-colors"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </div>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-xs text-prose-faint hover:text-red-400 transition-colors mt-2"
                >
                  Remove
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Order summary */}
      <div className="bg-surface/60 rounded-2xl p-6 flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-prose-muted">Subtotal</span>
          <span className="text-white font-semibold">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-prose-muted">Shipping</span>
          <span className="text-green-400 font-semibold">Free</span>
        </div>
        <div className="flex items-center justify-between text-sm text-prose-faint">
          <span>Tax</span>
          <span>Calculated at checkout</span>
        </div>
        <div className="border-t border-soft pt-4 mt-1 flex items-center justify-between">
          <span className="font-black text-white">Total</span>
          <span className="text-2xl font-black text-accent-text-soft">{formatPrice(subtotal)}</span>
        </div>

        {checkoutError && (
          <p className="text-red-400 text-xs text-center">{checkoutError}</p>
        )}
        <button
          onClick={handleCheckout}
          disabled={checkingOut}
          className="w-full py-3.5 mt-1 bg-accent hover:bg-accent-hover disabled:bg-accent/40 disabled:text-white/40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors text-sm"
        >
          {checkingOut ? 'Redirecting to Stripe...' : 'Proceed to Checkout'}
        </button>
        <p className="text-center text-xs text-prose-faint">Secure checkout via Stripe · Free US shipping</p>
      </div>

      <div className="flex items-center justify-between text-sm">
        <Link href="/gear" className="text-prose-faint hover:text-accent-text-soft transition-colors">
          ← Continue Shopping
        </Link>
        <button
          type="button"
          onClick={emptyCart}
          disabled={busy === '__all__'}
          className="text-prose-faint hover:text-red-400 disabled:opacity-50 transition-colors text-xs"
        >
          {busy === '__all__' ? 'Emptying…' : 'Empty cart'}
        </button>
      </div>
    </div>
  )
}

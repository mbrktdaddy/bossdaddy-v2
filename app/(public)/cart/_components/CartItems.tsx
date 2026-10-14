'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatPrice, getMerchDisplayImage } from '@/lib/merch'
import type { CartItemWithDetails } from '@/lib/merch'
import { dispatchCartUpdated } from '@/lib/cart-events'
import { EmptyState } from '@/components/ui/EmptyState'
import { buttonVariants } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { QtyStepper } from '@/components/ui/QtyStepper'
import { useConfirm } from '@/components/ui/useConfirm'
import { BagIcon } from '@/components/icons'
import { FREE_SHIPPING_LABEL } from '../../shop/_lib/shipping'

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
  const [lineError, setLineError] = useState<{ id: string; message: string } | null>(null)
  const { confirm, dialog } = useConfirm()

  // The checkout success path never resets `checkingOut` (we're navigating to
  // Stripe). If the dad taps Back, the browser can restore this page from the
  // back/forward cache with the button still stuck on "Redirecting" — clear it.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) setCheckingOut(false)
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  function recalc(updated: CartItemWithDetails[]) {
    setItems(updated)
    setSubtotal(updated.reduce((s, i) => s + i.variant.retail_price_cents * i.qty, 0))
  }

  // Throws on failure so <QtyStepper> shows its own danger line under the control.
  // "−" stops at 1 (min) — removal is the labelled Remove button, never a side effect.
  async function updateQty(itemId: string, qty: number) {
    setBusy(itemId)
    try {
      const res = await fetch('/api/cart/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item_id: itemId, qty }),
      })
      if (!res.ok) throw new Error("Couldn't update the quantity. Try again.")
      recalc(items.map(i => i.id === itemId ? { ...i, qty } : i))
      dispatchCartUpdated()
      router.refresh()
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
        // Success = the browser is leaving for Stripe. Leave `checkingOut` set so
        // the button stays disabled + "Redirecting…" until the page unloads —
        // resetting it here flashes the button back to "Proceed to Checkout"
        // (and re-clickable) during the navigation.
        window.location.href = json.url
        return
      }
      setCheckoutError(json.error ?? 'Checkout failed. Please try again.')
    } catch {
      setCheckoutError('Network error. Please try again.')
    }
    // Only the error paths reach here.
    setCheckingOut(false)
  }

  async function emptyCart() {
    const ok = await confirm({
      title: 'Empty your cart?',
      body: 'This removes every item from your cart.',
      confirmLabel: 'Empty cart',
      danger: true,
    })
    if (!ok) return
    setBusy('__all__')
    setCheckoutError(null)
    try {
      const res = await fetch('/api/cart/clear', { method: 'DELETE' })
      if (res.ok) {
        recalc([])
        dispatchCartUpdated()
        router.refresh()
      } else {
        setCheckoutError("Couldn't empty the cart. Try again.")
      }
    } catch {
      setCheckoutError("Couldn't empty the cart. Try again.")
    } finally {
      setBusy(null)
    }
  }

  async function removeItem(itemId: string) {
    setBusy(itemId)
    setLineError(null)
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
      } else {
        setLineError({ id: itemId, message: "Couldn't remove that item. Try again." })
      }
    } catch {
      setLineError({ id: itemId, message: "Couldn't remove that item. Try again." })
    } finally {
      setBusy(null)
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="Your cart is empty."
        action={
          <Link href="/shop" className={buttonVariants({ size: 'lg' })}>
            Browse the Shop
          </Link>
        }
      />
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-10">
      {dialog}

      {/* Line items — ONE chrome box, hairline rows */}
      <div>
        <Card tone="chrome" as="section" className="overflow-hidden">
          <ul className="divide-y divide-soft">
            {items.map(item => {
              const imageUrl = item.variant.image_url
                ?? getMerchDisplayImage(item.merch as Parameters<typeof getMerchDisplayImage>[0])
              const variantLabel = [item.variant.color, item.variant.size].filter(Boolean).join(' / ')
              const isBusy = busy === item.id

              return (
                <li key={item.id} className={`p-4 sm:p-5 transition-opacity ${isBusy ? 'opacity-50 pointer-events-none' : ''}`}>
                  <div className="flex gap-4">
                    <Link href={`/shop/${item.merch.slug}`} className="shrink-0">
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-surface-sunken border-b-[3px] border-chrome">
                        {imageUrl ? (
                          <Image src={imageUrl} alt={item.merch.name} fill className="object-cover" sizes="80px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BagIcon className="w-7 h-7 text-prose-faint" strokeWidth={1} aria-hidden />
                          </div>
                        )}
                      </div>
                    </Link>

                    <div className="flex-1 min-w-0">
                      <Link href={`/shop/${item.merch.slug}`} className="font-extrabold text-prose hover:text-accent transition-colors line-clamp-2 leading-snug">
                        {item.merch.name}
                      </Link>
                      {variantLabel && <p className="text-xs text-prose-faint mt-0.5">{variantLabel}</p>}
                      <p className="text-prose font-bold text-sm mt-1.5 tabular-nums">{formatPrice(item.variant.retail_price_cents)}</p>
                    </div>
                  </div>

                  {/* Second row — stepper + Remove at 44px so the name keeps its width */}
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <QtyStepper
                      value={item.qty}
                      onChange={q => updateQty(item.id, q)}
                      min={1}
                      max={10}
                      itemLabel={item.merch.name}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="inline-flex items-center min-h-11 px-2 text-sm font-medium text-prose-muted hover:text-danger-ink transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                  {lineError?.id === item.id && (
                    <p role="alert" className="mt-1.5 text-sm font-medium text-danger-ink">{lineError.message}</p>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>

        <div className="mt-4">
          <button
            type="button"
            onClick={emptyCart}
            disabled={busy === '__all__'}
            className="inline-flex items-center min-h-11 text-sm font-medium text-prose-muted hover:text-danger-ink disabled:opacity-50 transition-colors"
          >
            {busy === '__all__' ? 'Emptying…' : 'Empty cart'}
          </button>
        </div>
      </div>

      {/* Order summary — sticky beside the items on lg */}
      <Card tone="chrome" as="aside" className="p-5 sm:p-6 flex flex-col gap-3 lg:sticky lg:top-24">
        <div className="flex items-center justify-between text-sm">
          <span className="text-prose-muted">Subtotal</span>
          <span className="text-prose font-semibold tabular-nums">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-prose-muted">Shipping</span>
          <span className="text-success-ink font-semibold">{FREE_SHIPPING_LABEL}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-prose-faint">
          <span>Tax</span>
          <span>Calculated at checkout</span>
        </div>
        <div className="border-t border-soft pt-4 mt-1 flex items-center justify-between">
          <span className="font-black text-prose">Total</span>
          <span className="text-2xl font-black text-prose tabular-nums">{formatPrice(subtotal)}</span>
        </div>

        {checkoutError && (
          <p role="alert" className="rounded-md border border-danger-line bg-danger-bg px-3 py-2 text-sm font-medium text-danger-ink">
            {checkoutError}
          </p>
        )}
        <button
          onClick={handleCheckout}
          disabled={checkingOut}
          className={buttonVariants({ size: 'lg', className: 'w-full mt-1' })}
        >
          {checkingOut ? 'Redirecting to Stripe...' : 'Proceed to Checkout'}
        </button>
        <p className="text-center text-xs text-prose-faint">Secure checkout via Stripe</p>
      </Card>
    </div>
  )
}

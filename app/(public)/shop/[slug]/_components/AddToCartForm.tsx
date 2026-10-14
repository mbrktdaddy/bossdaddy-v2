'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/merch'
import { dispatchCartUpdated } from '@/lib/cart-events'
import { QtyStepper } from '@/components/ui/QtyStepper'
import { buttonVariants } from '@/components/ui/Button'
import { PILL_BASE, PILL_ACTIVE, PILL_INACTIVE } from '@/components/ui/PillFilterStrip'

interface Variant {
  id: string
  size: string | null
  color: string | null
  retail_price_cents: number
  in_stock: boolean
  image_url?: string | null
}

// Canonical size order so XS…5XL render left-to-right regardless of DB order.
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', 'ONE SIZE', 'OS']
function sizeRank(s: string) {
  const i = SIZE_ORDER.indexOf(s.toUpperCase())
  return i === -1 ? 500 : i
}

export default function AddToCartForm({
  variants,
  onVariantChange,
}: {
  variants: Variant[]
  onVariantChange?: (v: Variant | undefined) => void
}) {
  const router = useRouter()

  const colors = [...new Set(variants.map(v => v.color).filter((c): c is string => Boolean(c)))]
  const sizes = [...new Set(variants.map(v => v.size).filter((s): s is string => Boolean(s)))]
    .sort((a, b) => sizeRank(a) - sizeRank(b))
  const hasColors = colors.length > 1
  const hasSizes = sizes.length > 1

  const firstInStock = variants.find(v => v.in_stock) ?? variants[0]
  const [color, setColor] = useState<string | null>(firstInStock?.color ?? null)
  const [size, setSize] = useState<string | null>(firstInStock?.size ?? null)
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [added, setAdded] = useState(false)
  // Once anything has been added, "View cart" stays put (the 3s `added` window
  // used to take the only way to the cart with it).
  const [everAdded, setEverAdded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selected = variants.find(
    v => (v.color ?? null) === (color ?? null) && (v.size ?? null) === (size ?? null),
  )

  // Let the parent (e.g. the gallery) react to the active variant — used to
  // swap the main product image to the selected color's mockup.
  useEffect(() => {
    onVariantChange?.(selected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  // A size is offered if some variant in the selected color carries it in stock.
  const sizeInStock = (s: string) =>
    variants.some(v => v.size === s && (!hasColors || v.color === color) && v.in_stock)
  const colorInStock = (c: string) => variants.some(v => v.color === c && v.in_stock)

  // Switching color: keep the current size if that color has it, else jump to
  // the first available size for the new color so the selection never dangles.
  function selectColor(c: string) {
    setColor(c)
    if (size && !variants.some(v => v.color === c && v.size === size)) {
      const next =
        sizes.find(s => variants.some(v => v.color === c && v.size === s && v.in_stock)) ??
        sizes.find(s => variants.some(v => v.color === c && v.size === s)) ??
        null
      setSize(next)
    }
  }

  async function handleAddToCart() {
    // `added` is a 3s confirmation window — the button stays enabled so it can
    // show the success look at full opacity, so guard the double-add here.
    if (!selected?.in_stock || added) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/cart/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_id: selected.id, qty }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Could not add to cart')
        return
      }
      setAdded(true)
      setEverAdded(true)
      dispatchCartUpdated()
      router.refresh()
      setTimeout(() => setAdded(false), 3000)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Color selector — only when the product has more than one color */}
      {hasColors && (
        <div>
          <p className="text-xs text-prose-faint uppercase tracking-widest mb-2.5">
            Color{color ? <span className="text-prose-muted normal-case tracking-normal"> · {color}</span> : null}
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map(c => {
              const avail = colorInStock(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => selectColor(c)}
                  disabled={!avail}
                  className={`${PILL_BASE} ${
                    color === c
                      ? PILL_ACTIVE
                      : avail
                      ? PILL_INACTIVE
                      : 'bg-transparent text-prose-faint border-soft cursor-not-allowed line-through'
                  }`}
                >
                  {c}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Size selector */}
      {hasSizes && (
        <div>
          <p className="text-xs text-prose-faint uppercase tracking-widest mb-2.5">Size</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map(s => {
              const avail = sizeInStock(s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSize(s)}
                  disabled={!avail}
                  className={`${PILL_BASE} min-w-[52px] justify-center ${
                    size === s
                      ? PILL_ACTIVE
                      : avail
                      ? PILL_INACTIVE
                      : 'bg-transparent text-prose-faint border-soft cursor-not-allowed line-through'
                  }`}
                >
                  {s}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Single-variant info (e.g. a hat / one-size) */}
      {!hasColors && !hasSizes && selected && (selected.color || selected.size) && (
        <div className="flex gap-3 text-sm text-prose-faint">
          {selected.color && <span>Color: <span className="text-prose-muted">{selected.color}</span></span>}
          {selected.size && <span>Size: <span className="text-prose-muted">{selected.size}</span></span>}
        </div>
      )}

      {/* Qty stepper */}
      <div className="flex items-center gap-3">
        <p className="text-xs text-prose-faint uppercase tracking-widest">Qty</p>
        <QtyStepper value={qty} onChange={setQty} min={1} max={10} itemLabel="this item" />
      </div>

      {/* Add to cart */}
      <button
        onClick={handleAddToCart}
        disabled={!selected?.in_stock || loading}
        aria-live="polite"
        className={buttonVariants({ variant: added ? 'success' : 'primary', size: 'lg', className: 'w-full' })}
      >
        {loading
          ? 'Adding…'
          : added
          ? 'Added to Cart!'
          : !selected
          ? 'Unavailable'
          : !selected.in_stock
          ? 'Out of Stock'
          : `Add to Cart · ${formatPrice(selected.retail_price_cents)}`}
      </button>

      {error && (
        <p role="alert" className="text-sm font-medium text-danger-ink">{error}</p>
      )}

      {everAdded && (
        <Link href="/cart" className={buttonVariants({ variant: 'outline', size: 'lg', className: 'w-full' })}>
          View cart
        </Link>
      )}
    </div>
  )
}

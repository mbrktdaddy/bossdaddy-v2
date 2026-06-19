'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/merch'
import { dispatchCartUpdated } from '@/lib/cart-events'

interface Variant {
  id: string
  size: string | null
  color: string | null
  retail_price_cents: number
  in_stock: boolean
}

// Canonical size order so XS…5XL render left-to-right regardless of DB order.
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', 'ONE SIZE', 'OS']
function sizeRank(s: string) {
  const i = SIZE_ORDER.indexOf(s.toUpperCase())
  return i === -1 ? 500 : i
}

export default function AddToCartForm({ variants }: { variants: Variant[] }) {
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
  const [error, setError] = useState<string | null>(null)

  const selected = variants.find(
    v => (v.color ?? null) === (color ?? null) && (v.size ?? null) === (size ?? null),
  )

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
    if (!selected?.in_stock) return
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
    <div className="flex flex-col gap-5 mt-auto">
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
                  onClick={() => selectColor(c)}
                  disabled={!avail}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                    color === c
                      ? 'bg-accent border-accent text-white'
                      : avail
                      ? 'bg-surface border-strong text-prose-muted hover:border-accent hover:text-prose'
                      : 'bg-surface/50 border-soft text-prose-faint cursor-not-allowed line-through'
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
                  onClick={() => setSize(s)}
                  disabled={!avail}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors min-w-[52px] ${
                    size === s
                      ? 'bg-accent border-accent text-white'
                      : avail
                      ? 'bg-surface border-strong text-prose-muted hover:border-accent hover:text-prose'
                      : 'bg-surface/50 border-soft text-prose-faint cursor-not-allowed line-through'
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
        <div className="flex items-center gap-1 bg-surface border border-soft rounded-xl px-2 py-1">
          <button
            onClick={() => setQty(q => Math.max(1, q - 1))}
            className="w-8 h-8 flex items-center justify-center text-prose-muted hover:text-prose transition-colors text-lg leading-none"
          >
            −
          </button>
          <span className="w-7 text-center text-sm font-bold text-prose tabular-nums">{qty}</span>
          <button
            onClick={() => setQty(q => Math.min(10, q + 1))}
            className="w-8 h-8 flex items-center justify-center text-prose-muted hover:text-prose transition-colors text-lg leading-none"
          >
            +
          </button>
        </div>
      </div>

      {/* Add to cart */}
      <button
        onClick={handleAddToCart}
        disabled={!selected?.in_stock || loading || added}
        className={`py-3.5 px-6 rounded-xl font-bold text-base transition-all ${
          added
            ? 'bg-green-700 text-white cursor-default'
            : selected?.in_stock
            ? 'bg-accent hover:bg-accent-hover active:bg-accent-hover text-white disabled:opacity-60'
            : 'bg-surface-raised text-prose-faint cursor-not-allowed'
        }`}
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

      {error && <p className="text-sm text-red-700">{error}</p>}

      {added && (
        <a href="/cart" className="text-center text-sm text-accent-text-soft hover:text-accent transition-colors font-medium">
          View Cart →
        </a>
      )}
    </div>
  )
}
